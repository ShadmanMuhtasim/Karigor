using Karigor.Api.Middleware;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sqlOptions => sqlOptions.EnableRetryOnFailure()));

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
    // CORS — allow Vite dev server
    // -------------------------------------------------------------------------
    const string CorsPolicyName = "ViteDev";
    builder.Services.AddCors(options =>
        options.AddPolicy(CorsPolicyName, policy =>
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials()));

    // -------------------------------------------------------------------------
    // Controllers + Swagger
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
