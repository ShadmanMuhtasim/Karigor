using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Karigor.Api.Administration;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Finding", "F2"), Trait("Classification", "GreenBaseline")]
public sealed class AdminBootstrapSecurityTests : IAsyncLifetime
{
    private readonly DisposableSqlDatabase database = new();
    private static string Email() => "bootstrap-" + Guid.NewGuid().ToString("N") + "@security.invalid";
    private static string Password() => Guid.NewGuid().ToString("N") + "Aa1!";
    public Task InitializeAsync() => database.InitializeAsync();
    public async Task DisposeAsync() => await database.DisposeAsync();
    private IConfiguration Config() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    { ["ConnectionStrings:DefaultConnection"] = database.ConnectionString }).Build();

    private ServiceProvider Services()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<KarigorDbContext>(options => options.UseSqlServer(database.ConnectionString,
            sql => sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(1), null)));
        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.Password.RequiredLength = 8; options.Password.RequireNonAlphanumeric = false;
            options.User.RequireUniqueEmail = true;
        }).AddRoles<IdentityRole>().AddEntityFrameworkStores<KarigorDbContext>();
        services.AddScoped<AdminBootstrapper>();
        return services.BuildServiceProvider();
    }

    private async Task<(int Exit, string Output)> CommandAsync(string email, string password)
    {
        using var output = new StringWriter();
        var code = await AdminBootstrapCommand.RunAsync([], new FixtureInput(email, password), Config(), output);
        Assert.DoesNotContain(password, output.ToString());
        return (code, output.ToString());
    }

    [Fact]
    public async Task ExplicitBootstrapCreatesExactlyOneRequestedAdministrator()
    {
        var email = Email(); var password = Password();
        var result = await CommandAsync(email, password);
        Assert.Equal(0, result.Exit); Assert.Contains("web server was not started", result.Output);
        await using var services = Services(); using var scope = services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var user = await users.FindByEmailAsync(email);
        Assert.NotNull(user); Assert.True(await users.CheckPasswordAsync(user, password));
        Assert.True(await users.IsInRoleAsync(user, "Admin"));
        Assert.NotEqual(password, user.PasswordHash);
        Assert.Equal(1, await db.Users.CountAsync()); Assert.Equal(1, await db.UserRoles.CountAsync());
    }

    [Fact]
    public async Task RepeatedBootstrapAndAdditionalAdministratorAreRejected()
    {
        var email = Email(); var password = Password();
        Assert.Equal(0, (await CommandAsync(email, password)).Exit);
        Assert.Equal(1, (await CommandAsync(email, Password())).Exit);
        Assert.Equal(1, (await CommandAsync(Email(), Password())).Exit);
        await using var services = Services(); using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal(1, await db.Users.CountAsync()); Assert.Equal(1, await db.UserRoles.CountAsync());
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True(await users.CheckPasswordAsync((await users.FindByEmailAsync(email))!, password));
    }

    [Theory]
    [InlineData("email"), InlineData("username")]
    public async Task BootstrapNeverPromotesAnExistingCustomer(string match)
    {
        var target = Email(); var originalPassword = Password();
        await using var services = Services();
        using (var scope = services.CreateScope())
        {
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await IdentityRoleSeeder.EnsureAsync(roles, "Customer");
            var user = new ApplicationUser { UserName = target, Email = match == "email" ? target : Email() };
            Assert.True((await users.CreateAsync(user, originalPassword)).Succeeded);
            Assert.True((await users.AddToRoleAsync(user, "Customer")).Succeeded);
        }
        Assert.Equal(1, (await CommandAsync(target, Password())).Exit);
        using var check = services.CreateScope();
        var manager = check.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var existing = (await manager.FindByNameAsync(target))!;
        Assert.True(await manager.IsInRoleAsync(existing, "Customer"));
        Assert.False(await manager.IsInRoleAsync(existing, "Admin"));
        Assert.True(await manager.CheckPasswordAsync(existing, originalPassword));
    }

    [Theory]
    [InlineData("email"), InlineData("weak-password")]
    public async Task InvalidIdentityInputLeavesNoAccountOrRole(string kind)
    {
        var result = await CommandAsync(kind == "email" ? "not-an-email" : Email(),
            kind == "weak-password" ? new string('x', 3) : Password());
        Assert.Equal(1, result.Exit);
        await using var services = Services(); using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal(0, await db.Users.CountAsync()); Assert.Equal(0, await db.UserRoles.CountAsync());
        Assert.Equal(0, await db.Roles.CountAsync());
    }

    [Fact]
    public async Task RoleAssignmentSqlFailureRollsBackAccountCreation()
    {
        await using var services = Services(); using var scope = services.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        await IdentityRoleSeeder.EnsureAsync(roles, "Admin");
        var role = (await roles.FindByNameAsync("Admin"))!;
        // CHECK literals cannot be parameterized. Only a validated generated Guid is formatted here.
        var roleLiteral = Guid.Parse(role.Id).ToString("D");
        var constraintSql = "ALTER TABLE [dbo].[AspNetUserRoles] ADD CONSTRAINT [CK_F2_FixtureRoleFailure] CHECK ([RoleId] <> '" + roleLiteral + "')";
        await db.Database.ExecuteSqlRawAsync(constraintSql);
        try
        {
            Assert.Equal(1, (await CommandAsync(Email(), Password())).Exit);
            Assert.Equal(0, await db.Users.CountAsync()); Assert.Equal(0, await db.UserRoles.CountAsync());
        }
        finally { await db.Database.ExecuteSqlRawAsync("ALTER TABLE [dbo].[AspNetUserRoles] DROP CONSTRAINT [CK_F2_FixtureRoleFailure]"); }
    }

    [Fact]
    public async Task RejectedRoleIdentityResultIsCheckedWithoutLeakingInput()
    {
        await using var services = Services(); using var scope = services.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var secret = Password();
        roles.RoleValidators.Add(new RejectRole(secret));
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scope.ServiceProvider.GetRequiredService<AdminBootstrapper>().CreateInitialAdministratorAsync(Email(), secret));
        Assert.DoesNotContain(secret, error.Message);
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal(0, await db.Users.CountAsync()); Assert.Equal(0, await db.Roles.CountAsync());
    }

    [Fact]
    public async Task CoordinatedConcurrentBootstrapCreatesOnlyOneAdministrator()
    {
        await using var services = Services();
        using (var setup = services.CreateScope())
            await IdentityRoleSeeder.EnsureAsync(setup.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>(), "Admin");
        var gate = new CreationGate();
        async Task<bool> Create()
        {
            using var scope = services.CreateScope();
            scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().UserValidators.Add(gate);
            try
            {
                await scope.ServiceProvider.GetRequiredService<AdminBootstrapper>().CreateInitialAdministratorAsync(Email(), Password());
                return true;
            }
            catch (InvalidOperationException error) when (error.Message == "An administrator already exists. Initial bootstrap is closed.")
            { return false; }
        }
        var results = await Task.WhenAll(Create(), Create());
        Assert.Equal(2, gate.InitialArrivals);
        Assert.Single(results, result => result);
        using var check = services.CreateScope();
        var db = check.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.Equal(1, await db.Users.CountAsync()); Assert.Equal(1, await db.UserRoles.CountAsync());
    }

    [Fact]
    public async Task NormalStartupDoesNotPromoteDefaultEmailCustomer()
    {
        var isolated = new SecurityApplicationFixture();
        try
        {
            await isolated.InitializeAsync();
            string id; var password = Password();
            using (var scope = isolated.Factory.Services.CreateScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var customer = new ApplicationUser { UserName = "admin@karigor.com", Email = "admin@karigor.com" };
                Assert.True((await users.CreateAsync(customer, password)).Succeeded);
                Assert.True((await users.AddToRoleAsync(customer, "Customer")).Succeeded);
                id = customer.Id;
            }
            await using var restart = new SecurityApplicationFactory(isolated);
            using var client = restart.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
            (await client.GetAsync("/api/categories")).EnsureSuccessStatusCode();
            using var check = restart.Services.CreateScope();
            var manager = check.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var existing = (await manager.FindByIdAsync(id))!;
            Assert.False(await manager.IsInRoleAsync(existing, "Admin"));
            Assert.True(await manager.IsInRoleAsync(existing, "Customer"));
            Assert.True(await manager.CheckPasswordAsync(existing, password));
            var roles = check.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            foreach (var role in new[] { "Customer", "Worker", "Admin" }) Assert.True(await roles.RoleExistsAsync(role));
        }
        finally { await isolated.DisposeAsync(); }
    }

    [Fact]
    public async Task ExistingAdministratorSurvivesStartupAndCanSignIn()
    {
        var isolated = new SecurityApplicationFixture();
        try
        {
            await isolated.InitializeAsync();
            var email = Email(); var password = Password();
            using (var scope = isolated.Factory.Services.CreateScope())
            {
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var admin = new ApplicationUser { UserName = email, Email = email };
                Assert.True((await users.CreateAsync(admin, password)).Succeeded);
                Assert.True((await users.AddToRoleAsync(admin, "Admin")).Succeeded);
            }
            await using var restart = new SecurityApplicationFactory(isolated);
            using var client = restart.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
            using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("Admin", body.RootElement.GetProperty("role").GetString());
        }
        finally { await isolated.DisposeAsync(); }
    }

    private sealed record FixtureInput(string Email, string Password) : IAdminBootstrapInput
    {
        public bool IsInteractive => true;
        public string ReadEmail() => Email;
        public string ReadPassword(bool confirmation) => Password;
    }
    private sealed class RejectRole(string secret) : IRoleValidator<IdentityRole>
    {
        public Task<IdentityResult> ValidateAsync(RoleManager<IdentityRole> manager, IdentityRole role)
            => Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "FixtureRejected", Description = secret }));
    }
    private sealed class CreationGate : IUserValidator<ApplicationUser>
    {
        private readonly TaskCompletionSource ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int arrivals;
        public int InitialArrivals => Math.Min(Volatile.Read(ref arrivals), 2);
        public async Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user)
        {
            if (Interlocked.Increment(ref arrivals) >= 2) ready.TrySetResult();
            await ready.Task.WaitAsync(TimeSpan.FromSeconds(15));
            return IdentityResult.Success;
        }
    }
}
