using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Karigor.Application.Auth;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Classification", "GreenBaseline")]
public sealed class PasswordResetSecurityTests(SecurityApplicationFixture fixture)
{
    private static string Password() => Guid.NewGuid().ToString("N") + "Aa9!";
    private async Task<ApplicationUser> Create(string role)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = Guid.NewGuid().ToString("N") + "@security.invalid";
        var user = new ApplicationUser { UserName = email, Email = email };
        Assert.True((await users.CreateAsync(user, Password())).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
        return user;
    }
    private async Task<string> Token(ApplicationUser user)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await users.GeneratePasswordResetTokenAsync((await users.FindByIdAsync(user.Id))!)));
    }
    private Task<HttpResponseMessage> Reset(string email, string token, string password, string? confirmation = null) =>
        fixture.Client().PostAsJsonAsync("/api/auth/reset-password", new { email, token, newPassword = password, confirmPassword = confirmation ?? password });

    [Theory]
    [InlineData("Customer"), InlineData("Worker"), InlineData("Admin")]
    public async Task EveryRoleReceivesGenericResponseAndUsablePrivateFrontendLink(string role)
    {
        var user = await Create(role);
        using var client = fixture.Client();
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "  " + user.Email!.ToUpperInvariant() + "  " });
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Guid.NewGuid() + "@security.invalid" });
        Assert.Equal(HttpStatusCode.OK, known.StatusCode); Assert.Equal(known.StatusCode, unknown.StatusCode);
        var body = await known.Content.ReadAsStringAsync();
        Assert.Equal(body, await unknown.Content.ReadAsStringAsync());
        Assert.Equal(PasswordResetService.GenericMessage, JsonDocument.Parse(body).RootElement.GetProperty("message").GetString());
        Assert.DoesNotContain(user.Email, body, StringComparison.OrdinalIgnoreCase);
        var link = new Uri(await fixture.Email.WaitAsync(user.Email));
        Assert.Equal("https://karigor.runasp.net", link.GetLeftPart(UriPartial.Authority));
        Assert.Equal("/reset-password", link.AbsolutePath); Assert.Empty(link.Query);
        var values = QueryHelpers.ParseQuery(link.Fragment[1..]);
        Assert.Equal(user.Email, values["email"]);
        var token = values["token"].ToString();
        Assert.DoesNotContain(token, body);
        var password = Password();
        var result = await Reset(user.Email, token, password);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var resetBody = await result.Content.ReadAsStringAsync();
        Assert.DoesNotContain(token, resetBody); Assert.DoesNotContain(password, resetBody);
        using var scope = fixture.Factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        Assert.True(await users.CheckPasswordAsync((await users.FindByIdAsync(user.Id))!, password));
        Assert.Equal(HttpStatusCode.BadRequest, (await Reset(user.Email, token, Password())).StatusCode);
    }

    [Theory]
    [InlineData("invalid"), InlineData("expired"), InlineData("confirmation"), InlineData("policy"), InlineData("unknown")]
    public async Task UnsafeInputsAreRejectedWithoutChangingPasswordOrExposingSecrets(string kind)
    {
        var user = await Create("Customer");
        var token = await Token(user);
        var password = kind == "policy" ? new string('7', 8) : Password();
        var options = fixture.Factory.Services.GetRequiredService<IOptions<DataProtectionTokenProviderOptions>>().Value;
        var lifetime = options.TokenLifespan;
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        var before = (await db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).PasswordHash;
        try
        {
            if (kind == "expired") options.TokenLifespan = TimeSpan.FromMinutes(-1);
            var result = await Reset(kind == "unknown" ? Guid.NewGuid() + "@security.invalid" : user.Email!,
                kind == "invalid" ? "invalid!" : token, password, kind == "confirmation" ? Password() : password);
            Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
            var body = await result.Content.ReadAsStringAsync();
            Assert.DoesNotContain(password, body); Assert.DoesNotContain(token, body);
            Assert.DoesNotContain("Exception", body); Assert.DoesNotContain("AspNet", body);
            if (kind is "invalid" or "expired" or "unknown") Assert.Contains(PasswordResetService.InvalidLink, body);
            if (kind == "confirmation") Assert.Contains("do not match", body);
            if (kind == "policy") Assert.Contains("uppercase", body);
        }
        finally { options.TokenLifespan = lifetime; }
        Assert.Equal(before, (await db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).PasswordHash);
    }

    [Fact]
    public async Task ResetRevokesAllDevicesRejectsAccessAndRefreshReplayAndStaleLogin()
    {
        var user = await Create("Customer");
        using var scope = fixture.Factory.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        var first = await sessions.CreateAsync(user.Id);
        var second = await sessions.CreateAsync(user.Id);
        var rotated = await sessions.RefreshAsync(first.rawRefreshToken);
        var result = await Reset(user.Email!, await Token(user), Password());
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        Assert.False(await sessions.IsActiveAsync(user.Id, first.result.SessionId));
        Assert.False(await sessions.IsActiveAsync(user.Id, second.result.SessionId));
        foreach (var raw in new[] { first.rawRefreshToken, second.rawRefreshToken, rotated.rawRefreshToken })
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => sessions.RefreshAsync(raw));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => sessions.CreateAsync(user.Id, user.SecurityStamp));
        using var oldAccess = fixture.Client(rotated.result.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await oldAccess.GetAsync("/api/customer/profile")).StatusCode);
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        Assert.All(await db.RefreshSessions.AsNoTracking().Where(s => s.UserId == user.Id).ToListAsync(), s => Assert.Equal("Logout", s.RevocationReason));
        Assert.All(await db.RefreshTokens.AsNoTracking().Where(t => t.UserId == user.Id).ToListAsync(), t => Assert.NotNull(t.RevokedAt));
    }

    [Fact]
    public async Task PersistentKeysValidateAcrossProviderRecreationAndAreNotPublic()
    {
        var user = await Create("Worker");
        var token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(await Token(user)));
        using var scope = fixture.Factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var provider = DataProtectionProvider.Create(new DirectoryInfo(Path.Combine(fixture.UploadRoot, "keys")),
            settings => settings.SetApplicationName("Karigor"));
        var validator = new DataProtectorTokenProvider<ApplicationUser>(provider,
            Options.Create(new DataProtectionTokenProviderOptions { TokenLifespan = TimeSpan.FromMinutes(20) }),
            NullLogger<DataProtectorTokenProvider<ApplicationUser>>.Instance);
        Assert.True(await validator.ValidateAsync("ResetPassword", token, users, user));
        var file = Directory.GetFiles(Path.Combine(fixture.UploadRoot, "keys"), "key-*.xml").First();
        var response = await fixture.Client().GetAsync("/App_Data/DataProtectionKeys/" + Path.GetFileName(file));
        Assert.DoesNotContain("<masterKey", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ForgotRequestsAreRateLimitedWithoutAccountDisclosure()
    {
        await using var app = fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimiting:Policies:PasswordResetLimiter:PermitLimit"] = "2" })));
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        client.DefaultRequestHeaders.Add("X-Karigor-CSRF", "1");
        for (var i = 0; i < 2; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Guid.NewGuid() + "@security.invalid" })).StatusCode);
        var limited = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = Guid.NewGuid() + "@security.invalid" });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.NotNull(limited.Headers.RetryAfter);
    }

    [Fact]
    public async Task RevocationFailureRollsBackPasswordChange()
    {
        var user = await Create("Customer");
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        await scope.ServiceProvider.GetRequiredService<RefreshSessionService>().CreateAsync(user.Id);
        var before = (await db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).PasswordHash;
        await db.Database.ExecuteSqlRawAsync("CREATE TRIGGER dbo.FixtureResetFailure ON dbo.RefreshSessions AFTER UPDATE AS THROW 51000, 'Fixture reset failure', 1;");
        try
        {
            Assert.Equal(HttpStatusCode.ServiceUnavailable, (await Reset(user.Email!, await Token(user), Password())).StatusCode);
            Assert.Equal(before, (await db.Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).PasswordHash);
            Assert.Null((await db.RefreshSessions.AsNoTracking().SingleAsync(s => s.UserId == user.Id)).RevokedAt);
        }
        finally { await db.Database.ExecuteSqlRawAsync("DROP TRIGGER dbo.FixtureResetFailure;"); }
    }
}
