using System.Text;
using System.IO;
using Karigor.Api.Middleware;
using Karigor.Application.Auth;
using Karigor.Infrastructure.Models;
using Karigor.Infrastructure.Upload;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Karigor.Abstractions.Worker;
using Karigor.Api.Administration;
using Karigor.Api.Email;
using Microsoft.AspNetCore.DataProtection;

// Explicit operator mode runs before web configuration, logging, startup seeding or listener creation.
if (AdminBootstrapCommand.IsRequested(args))
{
    Environment.ExitCode = await AdminBootstrapCommand.RunAsync(args[1..]);
    return;
}

// ---------------------------------------------------------------------------
// Bootstrap Serilog early so all startup events are captured
// ---------------------------------------------------------------------------
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting Karigor.Api");

    var builder = WebApplication.CreateBuilder(args);

    // -------------------------------------------------------------------------
    // Serilog — replace default .NET logging with Serilog
    // -------------------------------------------------------------------------
    builder.Host.UseSerilog((ctx, services, config) =>
        config
            .ReadFrom.Configuration(ctx.Configuration)
            .ReadFrom.Services(services)
            .WriteTo.Console()
            .Enrich.FromLogContext());

    // -------------------------------------------------------------------------
    // DbContext — KarigorDev via Windows Authentication with resilience & timeout
    // -------------------------------------------------------------------------
    builder.Services.AddDbContext<KarigorDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sqlOptions =>
            {
                sqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorNumbersToAdd: null);
                sqlOptions.CommandTimeout(30);
            }));

    // -------------------------------------------------------------------------
    // ASP.NET Core Identity
    // -------------------------------------------------------------------------
    builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength        = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.User.RequireUniqueEmail         = true;
    })
    .AddEntityFrameworkStores<KarigorDbContext>()
    .AddDefaultTokenProviders();

    builder.Services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromMinutes(20));
    var keyDirectory = new PrivateUploadPathProvider(builder.Environment.ContentRootPath,
        builder.Configuration["DataProtection:KeyPath"] ?? "App_Data/DataProtectionKeys", builder.Environment.WebRootPath);
    builder.Services.AddDataProtection().SetApplicationName("Karigor")
        .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory.GetUploadRoot()));
    builder.Services.AddScoped<PasswordResetService>();
    builder.Services.AddSingleton<PasswordResetEmailQueue>();
    builder.Services.AddScoped<IPasswordResetEmailSender, SmtpPasswordResetEmailSender>();
    builder.Services.AddHostedService<PasswordResetEmailWorker>();

    // -------------------------------------------------------------------------
    // JWT Authentication
    // -------------------------------------------------------------------------
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Key is not set. Use 'dotnet user-secrets set \"Jwt:Key\" \"...\"'.");

    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew                = TimeSpan.Zero  // no slack on expiry
        };

        // SignalR sends access token in query string on WebSocket handshake
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var sessions = context.HttpContext.RequestServices.GetRequiredService<RefreshSessionService>();
                if (!await sessions.IsActiveAsync(context.Principal, context.HttpContext.RequestAborted))
                    context.Fail("Session unavailable.");
            },
            OnAuthenticationFailed = context =>
            {
                if (context.Exception is SecurityTokenExpiredException)
                {
                    Log.Information("[Auth] Access token expired on {Method} {Path}",
                        context.Request.Method, context.Request.Path);
                }
                else
                {
                    Log.Warning(context.Exception, "[Auth] JWT Authentication failed on {Method} {Path}",
                        context.Request.Method, context.Request.Path);
                }
                return Task.CompletedTask;
            },
            OnForbidden = context =>
            {
                var userSub = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
                var userRole = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "none";
                Log.Warning("[Auth 403 Forbidden] User {UserId} (Role: {Role}) lacks permission for {Method} {Path}",
                    userSub, userRole, context.Request.Method, context.Request.Path);
                return Task.CompletedTask;
            }
        };
    });

    builder.Services.AddSingleton(TimeProvider.System);
    builder.Services.AddScoped<RefreshSessionService>();
    builder.Services.AddSingleton<Karigor.Api.Realtime.SessionConnections>();
    builder.Services.AddAuthorization();

    // -------------------------------------------------------------------------
    // Rate Limiting — three named sliding-window policies, all limits from config
    //
    // AuthLimiter            10 req/min   per client IP
    // PublicLimiter          60 req/min   per client IP
    // AuthenticatedLimiter  120 req/min   per user identity (sub claim),
    //                                   falling back to IP when anonymous
    //
    // Rejections: HTTP 429 + Retry-After header + structured JSON body.
    // -------------------------------------------------------------------------
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddPolicy<string>("PasswordResetLimiter", context => RateLimitPartition.GetSlidingWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(5), SegmentsPerWindow = 5,
                PermitLimit = builder.Configuration.GetValue("RateLimiting:Policies:PasswordResetLimiter:PermitLimit", 5),
                QueueLimit = 0, AutoReplenishment = true
            }));

        // Global safety net: a generous default so any endpoint that does NOT
        // opt into a named limiter is still protected (no magic 429s during demo).
        options.GlobalLimiter = PartitionedRateLimiter
            .Create<HttpContext, string>(
                httpContext => RateLimitPartition.GetSlidingWindowLimiter<string>(
                    "global",
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        Window            = TimeSpan.FromSeconds(
                            builder.Configuration.GetValue("RateLimiting:WindowSeconds", 60)),
                        SegmentsPerWindow = 60,
                        AutoReplenishment = true,
                        PermitLimit       = 1000,
                        QueueLimit        = 0
                    }));

        options.OnRejected = async (context, cancellationToken) =>
        {
            // Read the configured window duration to build a conservative
            // Retry-After value (seconds until the window rolls over).
            var retryAfterSeconds = builder.Configuration
                .GetValue("RateLimiting:WindowSeconds", 60);
            if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                retryAfterSeconds = (int)Math.Ceiling(retryAfter.TotalSeconds);

            // Standard HTTP header
            context.HttpContext.Response.Headers
                .Append("Retry-After", retryAfterSeconds.ToString());

            // Structured JSON body (matches the format required by the task)
            var body = new
            {
                statusCode        = 429,
                message           = "Too many requests. Please try again later.",
                retryAfterSeconds
            };
            context.HttpContext.Response.ContentType = "application/json";
            context.HttpContext.Response.StatusCode  = StatusCodes.Status429TooManyRequests;
            await context.HttpContext.Response.WriteAsync(
                System.Text.Json.JsonSerializer.Serialize(body), cancellationToken);
        };

        // — AuthLimiter: 10 req / 60 s per IP —
        options.AddPolicy<string>(
            "AuthLimiter",
            context =>
            {
                var section = builder.Configuration
                    .GetSection("RateLimiting:Policies:AuthLimiter");
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetSlidingWindowLimiter(
                    ip,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        Window            = TimeSpan.FromSeconds(
                            section.GetValue("WindowSeconds", 60)),
                        SegmentsPerWindow = 60,
                        AutoReplenishment = true,
                        PermitLimit       = section.GetValue("PermitLimit", 10),
                        QueueLimit        = 0
                    });
            });

        // — PublicLimiter: 60 req / 60 s per IP —
        options.AddPolicy<string>(
            "PublicLimiter",
            context =>
            {
                var section = builder.Configuration
                    .GetSection("RateLimiting:Policies:PublicLimiter");
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                return RateLimitPartition.GetSlidingWindowLimiter(
                    ip,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        Window            = TimeSpan.FromSeconds(
                            section.GetValue("WindowSeconds", 60)),
                        SegmentsPerWindow = 60,
                        AutoReplenishment = true,
                        PermitLimit       = section.GetValue("PermitLimit", 60),
                        QueueLimit        = 0
                    });
            });

        // — AuthenticatedLimiter: 120 req / 60 s per user sub claim —
        //   Falls back to IP address when the user is not authenticated.
        options.AddPolicy<string>(
            "AuthenticatedLimiter",
            context =>
            {
                var section = builder.Configuration
                    .GetSection("RateLimiting:Policies:AuthenticatedLimiter");
                var windowSec = section.GetValue("WindowSeconds", 60);
                var permit    = section.GetValue("PermitLimit", 120);

                // Prefer the authenticated user's identity; fall back to IP.
                var userId = context.User?.FindFirst(
                    System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                var partitionKey = userId ??
                    (context.Connection.RemoteIpAddress?.ToString() ?? "unknown");

                return RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        Window            = TimeSpan.FromSeconds(windowSec),
                        SegmentsPerWindow = 60,
                        AutoReplenishment = true,
                        PermitLimit       = permit,
                        QueueLimit        = 0
                    });
            });
    });

    // DI: IUploadPathProvider — uploads live OUTSIDE the web root so they can
    // never be served by the static-file middleware. The only way to read an
    // uploaded file is through the authenticated streaming endpoint
    // (WorkerDocumentFileController.GetDocumentFile).
    var contentRoot = builder.Environment.ContentRootPath
        ?? Path.Combine(AppContext.BaseDirectory, "..", "..", "..");
    var configuredUploadPath = builder.Configuration["Storage:UploadPath"];
    var privateUploads = new PrivateUploadPathProvider(contentRoot, configuredUploadPath, builder.Environment.WebRootPath);
    privateUploads.GetUploadRoot(); // Both consumers use the validated effective root.
    builder.Services.AddSingleton<IUploadPathProvider>(privateUploads);

    builder.Services.AddSignalR();
    builder.Services.AddScoped<Karigor.Application.Realtime.BookingAccess>();

    // -------------------------------------------------------------------------
    // Application services
    // -------------------------------------------------------------------------
    builder.Services.AddScoped<ITokenService, TokenService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<Karigor.Application.Worker.IWorkerService, Karigor.Application.Worker.WorkerService>();
    builder.Services.AddScoped<Karigor.Application.Customer.ICustomerService, Karigor.Application.Customer.CustomerService>();
    builder.Services.AddScoped<Karigor.Application.Marketplace.IMarketplaceService, Karigor.Application.Marketplace.MarketplaceService>();
    builder.Services.AddScoped<Karigor.Application.Location.ILocationService, Karigor.Application.Location.LocationService>();
    builder.Services.AddScoped<Karigor.Application.Realtime.IRealtimeNotifier, Karigor.Api.Realtime.SignalRRealtimeNotifier>();
    builder.Services.AddScoped<Karigor.Application.Notifications.INotificationService, Karigor.Application.Notifications.NotificationService>();
    builder.Services.AddScoped<Karigor.Application.Messaging.IMessagingService, Karigor.Application.Messaging.MessagingService>();
    builder.Services.AddScoped<Karigor.Application.Reviews.IReviewService, Karigor.Application.Reviews.ReviewService>();
    builder.Services.AddScoped<Karigor.Application.Admin.IAdminService, Karigor.Application.Admin.AdminService>();
    builder.Services.AddScoped<Karigor.Application.Sos.ISosService, Karigor.Application.Sos.SosService>();

    // SSLCommerz Payment Gateway
    builder.Services.Configure<Karigor.Application.Payments.SslCommerz.SslCommerzOptions>(options =>
    {
        builder.Configuration.GetSection(Karigor.Application.Payments.SslCommerz.SslCommerzOptions.SectionName).Bind(options);

        var envStoreId = Environment.GetEnvironmentVariable("SSLCOMMERZ_STORE_ID");
        if (!string.IsNullOrWhiteSpace(envStoreId)) options.StoreId = envStoreId;

        var envStorePassword = Environment.GetEnvironmentVariable("SSLCOMMERZ_STORE_PASSWORD");
        if (!string.IsNullOrWhiteSpace(envStorePassword)) options.StorePassword = envStorePassword;

        var envSandbox = Environment.GetEnvironmentVariable("SSLCOMMERZ_SANDBOX");
        if (!string.IsNullOrWhiteSpace(envSandbox) && bool.TryParse(envSandbox, out var isSandbox))
            options.IsSandbox = isSandbox;

        var envAppBaseUrl = Environment.GetEnvironmentVariable("SSLCOMMERZ_APP_BASE_URL");
        if (!string.IsNullOrWhiteSpace(envAppBaseUrl)) options.AppBaseUrl = envAppBaseUrl;

        var envClientBaseUrl = Environment.GetEnvironmentVariable("SSLCOMMERZ_CLIENT_BASE_URL");
        if (!string.IsNullOrWhiteSpace(envClientBaseUrl)) options.ClientBaseUrl = envClientBaseUrl;
    });

    builder.Services.AddHttpClient<Karigor.Application.Payments.SslCommerz.SslCommerzClient>();
    builder.Services.AddScoped<Karigor.Application.Payments.IPaymentService, Karigor.Application.Payments.PaymentService>();

    // -------------------------------------------------------------------------
    // CORS — configure allowed origins dynamically (with localhost fallback)
    // -------------------------------------------------------------------------
    const string CorsPolicyName = "DefaultCorsPolicy";
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173" };

    builder.Services.AddCors(options =>
        options.AddPolicy(CorsPolicyName, policy =>
        {
            if (allowedOrigins.Length > 0 && !allowedOrigins.Contains("*"))
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            }
            else
            {
                policy.AllowAnyOrigin()
                      .AllowAnyHeader()
                      .AllowAnyMethod();
            }
        }));

    // -------------------------------------------------------------------------
    // Controllers + Swagger (with JWT Bearer security scheme)
    // -------------------------------------------------------------------------
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "Karigor API", Version = "v1" });
    });

    // -------------------------------------------------------------------------
    // Build
    // -------------------------------------------------------------------------
    var app = builder.Build();

    // Seed ordinary roles only. Administrator accounts require explicit operator bootstrap.
    using (var scope = app.Services.CreateScope())
    {
        F5SchemaGate.Verify(scope.ServiceProvider.GetRequiredService<KarigorDbContext>());
        PaymentSchemaGate.Verify(scope.ServiceProvider.GetRequiredService<KarigorDbContext>());
        RefreshSessionSchemaGate.Verify(scope.ServiceProvider.GetRequiredService<KarigorDbContext>());
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        IdentityRoleSeeder.EnsureAsync(roleManager, "Customer", "Worker", "Admin").GetAwaiter().GetResult();

        // Service categories are required during worker registration.  Seed them
        // here so a new developer database works without manually running SQL.
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();

        // Legacy booking verification compatibility only. Payment DDL belongs to versioned SQL.
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'VerificationCodeHash' AND Object_ID = Object_ID(N'dbo.Bookings'))
            BEGIN
                ALTER TABLE [dbo].[Bookings]
                ADD 
                    [VerificationCodeHash]      nvarchar(256) NULL,
                    [VerificationCodeExpiresAt] datetime2     NULL,
                    [VerificationAttempts]      int           NOT NULL DEFAULT 0,
                    [CheckedInAt]               datetime2     NULL;
            END

        ");
        var starterCategories = new (string Name, string IconUrl)[]
        {
            ("Electrician", "https://cdn.karigor.app/icons/electrician.svg"),
            ("Plumber", "https://cdn.karigor.app/icons/plumber.svg"),
            ("Carpenter", "https://cdn.karigor.app/icons/carpenter.svg"),
            ("Mechanic", "https://cdn.karigor.app/icons/mechanic.svg"),
            ("AC Technician", "https://cdn.karigor.app/icons/ac-technician.svg"),
            ("Painter", "https://cdn.karigor.app/icons/painter.svg"),
            ("Cleaner", "https://cdn.karigor.app/icons/cleaner.svg"),
            ("Welder", "https://cdn.karigor.app/icons/welder.svg"),
            ("Mason", "https://cdn.karigor.app/icons/mason.svg"),
            ("Driver", "https://cdn.karigor.app/icons/driver.svg")
        };
        var existingNames = db.ServiceCategories.Select(c => c.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missingCategories = starterCategories
            .Where(c => !existingNames.Contains(c.Name))
            .Select(c => new ServiceCategory { Name = c.Name, IconUrl = c.IconUrl })
            .ToList();
        if (missingCategories.Count > 0)
        {
            db.ServiceCategories.AddRange(missingCategories);
            db.SaveChanges();
            Log.Information("Seeded {CategoryCount} missing service categories", missingCategories.Count);
        }
    }

    // -------------------------------------------------------------------------
    // Middleware pipeline (ordering matters)
    // -------------------------------------------------------------------------
    app.UseMiddleware<ExceptionHandlingMiddleware>();  // must be first — catches everything

    app.UseSerilogRequestLogging();
    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/reset-password"))
        {
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            context.Response.Headers.CacheControl = "no-store";
        }
        await next();
    });

    // Swagger enabled for all environments (academic project requirement)
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Karigor API v1");
        c.RoutePrefix = "swagger";
    });

    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }
    app.UseDefaultFiles();  // serves index.html by default
    // Reserve the document namespace for authorized MVC delivery, including old public copies.
    app.UseWhen(context => !context.Request.Path.StartsWithSegments("/uploads/worker-documents", StringComparison.OrdinalIgnoreCase),
        staticFiles => staticFiles.UseStaticFiles());
    app.UseCors(CorsPolicyName);
    app.UseAuthentication();

    // Rate limiting runs AFTER authentication (so [EnableRateLimiting] can
    // partition by the authenticated user's identity via the AuthenticatedLimiter)
    // and BEFORE authorization / MapControllers.
    app.UseRateLimiter();

    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<Karigor.Api.Hubs.KarigorHub>("/hubs/chat", options => options.CloseOnAuthenticationExpiration = true);
    app.MapFallbackToFile("index.html");  // SPA client-side fallback

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
