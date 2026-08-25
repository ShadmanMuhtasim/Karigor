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
    // DbContext — KarigorDev via Windows Authentication
    // -------------------------------------------------------------------------
    builder.Services.AddDbContext<KarigorDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection")));

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
    });

    builder.Services.AddAuthorization();

    // DI: IUploadPathProvider using host web root
    builder.Services.AddScoped<IUploadPathProvider>(sp =>
        new HostWebRootUploadPathProvider(
            builder.Environment.WebRootPath ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot")
        ));

    // Configuration overrides for Application layer
    // Removed hard-coded path override; path will be provided via DI

    // -------------------------------------------------------------------------
    // Application services
    // -------------------------------------------------------------------------
    builder.Services.AddScoped<ITokenService, TokenService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<Karigor.Application.Worker.IWorkerService, Karigor.Application.Worker.WorkerService>();
    builder.Services.AddScoped<Karigor.Application.Customer.ICustomerService, Karigor.Application.Customer.CustomerService>();
    builder.Services.AddScoped<Karigor.Application.Marketplace.IMarketplaceService, Karigor.Application.Marketplace.MarketplaceService>();
    builder.Services.AddScoped<Karigor.Application.Location.ILocationService, Karigor.Application.Location.LocationService>();

    // -------------------------------------------------------------------------
    // CORS — allow Vite dev server with credentials (for httpOnly cookie)
    // -------------------------------------------------------------------------
    const string CorsPolicyName = "ViteDev";
    builder.Services.AddCors(options =>
        options.AddPolicy(CorsPolicyName, policy =>
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials()));

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

    // Seed roles on startup (idempotent) - inline seed to avoid RoleSeeder dependency
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

        // Service categories are required during worker registration.  Seed them
        // here so a new developer database works without manually running SQL.
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
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

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Karigor API v1");
            c.RoutePrefix = "swagger";
        });
    }

    app.UseHttpsRedirection();
    app.UseStaticFiles();   // serves wwwroot/uploads/worker-documents/*
    app.UseCors(CorsPolicyName);
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();

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
