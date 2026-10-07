using Karigor.Abstractions.Worker;
using Karigor.Api.Controllers;
using Karigor.Application.Auth;
using Karigor.Application.Payments.SslCommerz;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Karigor.Security.Tests.Infrastructure;

[CollectionDefinition("Security SQL", DisableParallelization = true)]
public sealed class SecuritySqlCollection : ICollectionFixture<SecurityApplicationFixture> { }

public sealed class SecurityApplicationFixture : IAsyncLifetime
{
    public DisposableSqlDatabase Database { get; } = new();
    public FakePaymentHandler Provider { get; } = new();
    public string UploadRoot { get; } = Path.Combine(Path.GetTempPath(), "Karigor_SecurityTests_" + Guid.NewGuid().ToString("N"));
    public SecurityApplicationFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        try
        {
            await Database.InitializeAsync();
            Directory.CreateDirectory(UploadRoot);
            Factory = new SecurityApplicationFactory(this);
            using var client = Factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
            (await client.GetAsync("/api/categories")).EnsureSuccessStatusCode();
        }
        catch
        {
            await DisposeAsync();
            throw;
        }
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null) await Factory.DisposeAsync();
        Provider.Dispose();
        await Database.DisposeAsync();
        // The exact generated fixture directory, never a configured upload root.
        var resolved = Path.GetFullPath(UploadRoot);
        var tempRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!resolved.StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFileName(resolved).StartsWith("Karigor_SecurityTests_", StringComparison.Ordinal))
            throw new InvalidOperationException("Refusing to delete a non-fixture directory.");
        if (Directory.Exists(resolved)) Directory.Delete(resolved, recursive: true);
    }

    public HttpClient Client(string? token = null)
    {
        var client = Factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        if (token is not null) client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }

    public async Task<Scenario> SeedAsync(string requestStatus = "Open", bool booking = false)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var tokens = scope.ServiceProvider.GetRequiredService<ITokenService>();
        async Task<ApplicationUser> User(string role)
        {
            var id = Guid.NewGuid().ToString("N");
            var user = new ApplicationUser { Id = id, UserName = id + "@security.invalid", Email = id + "@security.invalid" };
            var result = await users.CreateAsync(user);
            if (!result.Succeeded) throw new InvalidOperationException("Fixture identity creation failed.");
            result = await users.AddToRoleAsync(user, role);
            if (!result.Succeeded) throw new InvalidOperationException("Fixture role assignment failed.");
            return user;
        }
        var customerUser = await User("Customer");
        var workerUser = await User("Worker");
        var stranger = await User("Customer");
        var category = await db.ServiceCategories.FirstAsync();
        var customer = new CustomerProfile { UserId = customerUser.Id, FullName = "Fixture customer" };
        var worker = new WorkerProfile
        {
            UserId = workerUser.Id, VerificationStatus = "Verified", HourlyRate = 100,
            Latitude = 23.8103, Longitude = 90.4125, ServiceRadiusKm = 10,
            Categories = [category]
        };
        var request = new ServiceRequest
        {
            Customer = customer, CategoryId = category.Id, Description = "Isolated fixture request",
            Address = "Fixture address", Latitude = 23.8103, Longitude = 90.4125,
            PreferredDate = DateTime.UtcNow.AddDays(7), Status = requestStatus
        };
        db.WorkerProfiles.Add(worker);
        db.ServiceRequests.Add(request);
        Booking? job = null;
        if (booking)
        {
            job = new Booking
            {
                Customer = customer, Worker = worker, ServiceRequest = request,
                AgreedPrice = 1000, ScheduledDate = request.PreferredDate,
                Status = "Completed", PaymentStatus = "Unpaid"
            };
            db.Bookings.Add(job);
        }
        await db.SaveChangesAsync();
        return new Scenario(request.Id, worker.Id, job?.Id,
            customerUser.Id, workerUser.Id,
            tokens.GenerateAccessToken(customerUser, ["Customer"]).token,
            tokens.GenerateAccessToken(workerUser, ["Worker"]).token,
            tokens.GenerateAccessToken(stranger, ["Customer"]).token);
    }
}

public record Scenario(int RequestId, int WorkerId, int? BookingId, string CustomerUserId, string WorkerUserId,
    string CustomerToken, string WorkerToken, string StrangerToken);

/// <summary>The public controller identifies the API assembly; no public Program change is needed.</summary>
public sealed class SecurityApplicationFactory(SecurityApplicationFixture fixture) : WebApplicationFactory<PaymentsController>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        // Host configuration reaches CreateBuilder before its early Jwt/SQL reads.
        builder.ConfigureHostConfiguration(config => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["environment"] = "Production",
            ["ConnectionStrings:DefaultConnection"] = fixture.Database.ConnectionString,
            ["Jwt:Key"] = "fixture-only-signing-key-64-characters-never-use-in-production-123456",
            ["Jwt:Issuer"] = "karigor-security-tests", ["Jwt:Audience"] = "karigor-security-tests",
            ["Storage:UploadPath"] = fixture.UploadRoot
        }));
        return base.CreateHost(builder);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseContentRoot(Path.Combine(fixture.Database.RepositoryRoot, "backend/Karigor.Api"));
        builder.ConfigureServices(services =>
        {
            services.PostConfigure<SslCommerzOptions>(options =>
            {
                options.StoreId = "fixture"; options.StorePassword = "fixture"; options.IsSandbox = false;
                options.AppBaseUrl = "https://localhost"; options.ClientBaseUrl = "https://localhost";
            });
            services.RemoveAll<SslCommerzClient>();
            services.AddScoped(sp => new SslCommerzClient(
                new HttpClient(fixture.Provider, disposeHandler: false),
                sp.GetRequiredService<IOptions<SslCommerzOptions>>(),
                sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<SslCommerzClient>>()));
        });
    }

}
