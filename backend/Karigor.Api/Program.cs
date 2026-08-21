using System.Text;
using Karigor.Api.Middleware;
using Karigor.Application.Auth;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;


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

    // -------------------------------------------------------------------------
    // Application services
    // -------------------------------------------------------------------------
    builder.Services.AddScoped<ITokenService, TokenService>();
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddScoped<Karigor.Application.Worker.IWorkerService, Karigor.Application.Worker.WorkerService>();

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
