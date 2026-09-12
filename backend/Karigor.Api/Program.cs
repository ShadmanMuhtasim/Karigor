using System.Text;
using System.IO;
using Karigor.Api.Middleware;
using Karigor.Application.Auth;
using Karigor.Infrastructure.Models;
using Karigor.Infrastructure.Upload;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Karigor.Abstractions.Worker;


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

    builder.Services.AddAuthorization();

    // DI: IUploadPathProvider using host web root with directory initialization
    var webRoot = builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
    var configuredUploadPath = builder.Configuration["Storage:UploadPath"];
    var uploadRoot = !string.IsNullOrWhiteSpace(configuredUploadPath)
        ? configuredUploadPath
        : Path.Combine(webRoot, "uploads", "worker-documents");

    if (!Directory.Exists(uploadRoot))
    {
        Directory.CreateDirectory(uploadRoot);
    }

    builder.Services.AddScoped<IUploadPathProvider>(sp =>
        new HostWebRootUploadPathProvider(webRoot));

    // Configuration overrides for Application layer
    // Removed hard-coded path override; path will be provided via DI

    builder.Services.AddSignalR();

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

    // Seed roles and initial admin on startup (idempotent)
    using (var scope = app.Services.CreateScope())
    {
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var roleName in new[] { "Customer", "Worker", "Admin" })
        {
            if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult())
            {
                roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
            }
        }

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        const string adminEmail = "admin@karigor.com";
        var existingAdmin = userManager.FindByEmailAsync(adminEmail).GetAwaiter().GetResult();
        if (existingAdmin == null)
        {
            var adminUser = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true
            };
            var createRes = userManager.CreateAsync(adminUser, "Admin123!").GetAwaiter().GetResult();
            if (createRes.Succeeded)
            {
                userManager.AddToRoleAsync(adminUser, "Admin").GetAwaiter().GetResult();
                Log.Information("Seeded default Administrator account: {AdminEmail}", adminEmail);
            }
        }
        else
        {
            if (!userManager.IsInRoleAsync(existingAdmin, "Admin").GetAwaiter().GetResult())
            {
                userManager.AddToRoleAsync(existingAdmin, "Admin").GetAwaiter().GetResult();
            }
        }

        // Service categories are required during worker registration.  Seed them
        // here so a new developer database works without manually running SQL.
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();

        // Ensure database schema migrations (idempotent)
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

            IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'PaymentStatus' AND Object_ID = Object_ID(N'dbo.Bookings'))
            BEGIN
                ALTER TABLE [dbo].[Bookings]
                ADD [PaymentStatus] nvarchar(50) NOT NULL DEFAULT 'Unpaid';
            END

            IF OBJECT_ID(N'[dbo].[Payments]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[Payments] (
                    [Id]              int            NOT NULL IDENTITY,
                    [BookingId]       int            NOT NULL,
                    [TransactionId]   nvarchar(100)  NOT NULL,
                    [ValId]           nvarchar(100)  NULL,
                    [BankTranId]      nvarchar(100)  NULL,
                    [CardType]        nvarchar(100)  NULL,
                    [Currency]        nvarchar(10)   NOT NULL DEFAULT 'BDT',
                    [TotalAmount]     decimal(18, 2) NOT NULL,
                    [PlatformFee]     decimal(18, 2) NOT NULL,
                    [ServiceCharge]   decimal(18, 2) NOT NULL DEFAULT 0.00,
                    [WorkerAmount]    decimal(18, 2) NOT NULL,
                    [Status]          nvarchar(50)   NOT NULL DEFAULT 'Initiated',
                    [CreatedAt]       datetime2      NOT NULL DEFAULT SYSUTCDATETIME(),
                    [PaidAt]          datetime2      NULL,
                    [GatewayResponse] nvarchar(max)  NULL,
                    CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_Payments_Bookings_BookingId]
                        FOREIGN KEY ([BookingId]) REFERENCES [dbo].[Bookings] ([Id]) ON DELETE CASCADE,
                    CONSTRAINT [UQ_Payments_TransactionId] UNIQUE ([TransactionId])
                );

                CREATE INDEX [IX_Payments_BookingId] ON [dbo].[Payments] ([BookingId]);
                CREATE INDEX [IX_Payments_Status] ON [dbo].[Payments] ([Status]);
            END
            ELSE
            BEGIN
                IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE Name = N'ServiceCharge' AND Object_ID = Object_ID(N'dbo.Payments'))
                BEGIN
                    ALTER TABLE [dbo].[Payments] ADD [ServiceCharge] decimal(18, 2) NOT NULL DEFAULT 0.00;
                END
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

    // Swagger enabled for all environments (academic project requirement)
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Karigor API v1");
        c.RoutePrefix = "swagger";
    });

    app.UseHttpsRedirection();
    app.UseDefaultFiles();  // serves index.html by default
    app.UseStaticFiles();   // serves wwwroot/assets, wwwroot/uploads, etc.
    app.UseCors(CorsPolicyName);
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<Karigor.Api.Hubs.KarigorHub>("/hubs/chat");
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
