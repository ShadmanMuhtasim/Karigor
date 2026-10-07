using System.Data.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using Karigor.Api.Controllers;
using Karigor.Application.Auth;
using Karigor.Application.Auth.DTOs;
using Karigor.Infrastructure.Models;
using Karigor.Security.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Karigor.Security.Tests;

[Collection("Security SQL"), Trait("Layer", "Integration"), Trait("Finding", "F6"), Trait("Classification", "GreenBaseline")]
public sealed class RefreshSessionSecurityTests(SecurityApplicationFixture fixture)
{
    public sealed class Clock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan duration) => now += duration;
    }

    // Both SQL SELECTs have completed before either request can acquire its user lock.
    private sealed class ObservationGate(int parties = 1) : DbCommandInterceptor
    {
        public TaskCompletionSource Arrived { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int count;
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("F6: initial token observation"))
            {
                if (Interlocked.Increment(ref count) == parties) Arrived.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }

    private sealed class FailSuccessor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<RefreshToken>().Any(e => e.State == EntityState.Added && e.Entity.ParentTokenId != null))
                throw new InvalidOperationException("Injected successor database failure.");
            return ValueTask.FromResult(result);
        }
    }

    private sealed class HeldUserLock : DbCommandInterceptor
    {
        public bool Armed;
        private int holders;
        public TaskCompletionSource Held { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Contender { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private static bool UserLock(DbCommand command) => command.CommandText.Contains("AspNetUsers WITH (UPDLOCK,HOLDLOCK)");
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (Armed && UserLock(command) && Held.Task.IsCompleted) Contender.TrySetResult();
            return ValueTask.FromResult(result);
        }
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (Armed && UserLock(command) && Interlocked.Increment(ref holders) == 1)
            {
                Held.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }

    private WebApplicationFactory<PaymentsController> Host(Clock? clock = null, IInterceptor? interceptor = null) =>
        fixture.Factory.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            if (clock is not null) { services.RemoveAll<TimeProvider>(); services.AddSingleton<TimeProvider>(clock); }
            if (interceptor is not null) services.AddDbContext<KarigorDbContext>(o => o.AddInterceptors(interceptor));
        }));

    private static HttpClient Client(WebApplicationFactory<PaymentsController> host, string? raw = null)
    {
        var client = host.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        client.DefaultRequestHeaders.Add("X-Karigor-CSRF", "1");
        if (raw is not null) client.DefaultRequestHeaders.Add("Cookie", "karigor_rt=" + Uri.EscapeDataString(raw));
        return client;
    }

    private async Task<(AuthResultDto result, string raw)> Session(WebApplicationFactory<PaymentsController>? host = null, string? userId = null)
    {
        userId ??= (await fixture.SeedAsync()).CustomerUserId;
        using var scope = (host ?? fixture.Factory).Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<RefreshSessionService>().CreateAsync(userId);
    }

    private async Task<(RefreshSession session, RefreshToken[] tokens)> State(Guid id)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
        return (await db.RefreshSessions.AsNoTracking().SingleAsync(s => s.Id == id),
            await db.RefreshTokens.AsNoTracking().Where(t => t.SessionId == id).OrderBy(t => t.Id).ToArrayAsync());
    }

    private static string Cookie(HttpResponseMessage response) => Uri.UnescapeDataString(response.Headers.GetValues("Set-Cookie")
        .Single().Split(';')[0].Split('=', 2)[1]);
    private static void NoCookie(HttpResponseMessage response) => Assert.False(response.Headers.Contains("Set-Cookie"));

    [Theory]
    [InlineData(0)] [InlineData(30)] [InlineData(60)] [InlineData(61)]
    public async Task ConsumedPredecessorNeverMintsCredentialsAndRevokesOnlyItsFamily(int seconds)
    {
        var clock = new Clock();
        await using var host = Host(clock);
        var first = await Session(host);
        var device = await Session(host, first.result.UserId);
        using var client = Client(host, first.raw);
        using var rotated = await client.PostAsJsonAsync("/api/auth/refresh", new { });
        rotated.EnsureSuccessStatusCode();
        var successor = Cookie(rotated);
        Assert.NotEqual(first.raw, successor);
        clock.Advance(TimeSpan.FromSeconds(seconds));
        using var replay = await client.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode); NoCookie(replay);
        Assert.DoesNotContain("accessToken", await replay.Content.ReadAsStringAsync());
        var state = await State(first.result.SessionId);
        Assert.Equal("Replay", state.session.RevocationReason);
        Assert.Equal(2, state.tokens.Length);
        Assert.Equal(state.tokens[0].Id, state.tokens[1].ParentTokenId);
        Assert.All(state.tokens, t => { Assert.Equal(64, t.TokenHash.Length); Assert.DoesNotContain(first.raw, t.TokenHash); });
        using var successorClient = Client(host, successor);
        Assert.Equal(HttpStatusCode.Unauthorized, (await successorClient.PostAsJsonAsync("/api/auth/refresh", new { })).StatusCode);
        using var other = Client(host, device.raw);
        (await other.PostAsJsonAsync("/api/auth/refresh", new { })).EnsureSuccessStatusCode();
        Assert.Null((await State(device.result.SessionId)).session.RevokedAt);
    }

    [Fact]
    public async Task ExpiredPredecessorFailsBeforeReplayAndDoesNotRevokeFamily()
    {
        var clock = new Clock();
        await using var host = Host(clock);
        var first = await Session(host);
        using var client = Client(host, first.raw);
        (await client.PostAsJsonAsync("/api/auth/refresh", new { })).EnsureSuccessStatusCode();
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KarigorDbContext>();
            var token = await db.RefreshTokens.SingleAsync(t => t.SessionId == first.result.SessionId && t.ParentTokenId == null);
            token.ExpiresAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync();
        }
        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); NoCookie(response);
        Assert.Null((await State(first.result.SessionId)).session.RevokedAt);
    }

    [Fact]
    public async Task CoordinatedActiveObservationsProduceOneSuccessorAndCookieFreeConflictWithoutRevokingWinner()
    {
        var gate = new ObservationGate(2);
        await using var host = Host(interceptor: gate);
        var first = await Session(host);
        using var left = Client(host, first.raw); using var right = Client(host, first.raw);
        var a = left.PostAsJsonAsync("/api/auth/refresh", new { });
        var b = right.PostAsJsonAsync("/api/auth/refresh", new { });
        await gate.Arrived.Task.WaitAsync(TimeSpan.FromSeconds(15)); gate.Release.SetResult();
        var responses = await Task.WhenAll(a, b);
        var winner = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        NoCookie(Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict));
        var state = await State(first.result.SessionId);
        Assert.Null(state.session.RevokedAt); Assert.Equal(2, state.tokens.Length);
        Assert.Single(state.tokens, t => t.RevokedAt == null);
        Assert.NotNull(state.tokens[0].RevokedAt);
        using var successor = Client(host, Cookie(winner));
        (await successor.PostAsJsonAsync("/api/auth/refresh", new { })).EnsureSuccessStatusCode();
        Assert.Null((await State(first.result.SessionId)).session.RevokedAt);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task RevocationWinsAgainstRefreshThatAlreadyObservedActive(bool suspend)
    {
        var gate = new ObservationGate();
        await using var host = Host(interceptor: gate);
        var first = await Session(host);
        using var client = Client(host, first.raw);
        var refresh = client.PostAsJsonAsync("/api/auth/refresh", new { });
        await gate.Arrived.Task.WaitAsync(TimeSpan.FromSeconds(15));
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
            if (suspend) await sessions.SetSuspensionAsync(first.result.UserId, true);
            else await sessions.LogoutAsync(first.raw);
        }
        gate.Release.SetResult();
        var response = await refresh;
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); NoCookie(response);
        var state = await State(first.result.SessionId);
        Assert.NotNull(state.session.RevokedAt); Assert.Single(state.tokens);
        if (suspend)
        {
            using var scope = fixture.Factory.Services.CreateScope();
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => scope.ServiceProvider.GetRequiredService<RefreshSessionService>().CreateAsync(first.result.UserId));
        }
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task RevocationAfterCommittedRefreshInvalidatesSuccessorAndOldJwt(bool suspend)
    {
        var first = await Session();
        using var client = Client(fixture.Factory, first.raw);
        var rotated = await client.PostAsJsonAsync("/api/auth/refresh", new { }); rotated.EnsureSuccessStatusCode();
        using var scope = fixture.Factory.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        if (suspend) await sessions.SetSuspensionAsync(first.result.UserId, true);
        else await sessions.LogoutAsync(first.raw); // Even a consumed predecessor identifies the family.
        Assert.False(await sessions.IsActiveAsync(first.result.UserId, first.result.SessionId));
        using var oldJwt = fixture.Client(first.result.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await oldJwt.GetAsync("/api/notifications")).StatusCode);
        using var successor = Client(fixture.Factory, Cookie(rotated));
        var response = await successor.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode); NoCookie(response);
        Assert.Equal(2, (await State(first.result.SessionId)).tokens.Length);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public async Task RefreshHoldingUserLockCannotEscapeQueuedLogoutOrSuspension(bool suspend)
    {
        var gate = new HeldUserLock();
        await using var host = Host(interceptor: gate);
        var first = await Session(host);
        gate.Armed = true;
        using var client = Client(host, first.raw);
        var refresh = client.PostAsJsonAsync("/api/auth/refresh", new { });
        await gate.Held.Task.WaitAsync(TimeSpan.FromSeconds(15));
        using var scope = host.Services.CreateScope();
        var sessions = scope.ServiceProvider.GetRequiredService<RefreshSessionService>();
        Task revoke = suspend ? sessions.SetSuspensionAsync(first.result.UserId, true) : sessions.LogoutAsync(first.raw);
        await gate.Contender.Task.WaitAsync(TimeSpan.FromSeconds(15));
        Assert.False(revoke.IsCompleted);
        gate.Release.SetResult();
        var winner = await refresh; winner.EnsureSuccessStatusCode(); await revoke;
        var state = await State(first.result.SessionId);
        Assert.Equal(2, state.tokens.Length); Assert.NotNull(state.session.RevokedAt);
        using var successor = Client(host, Cookie(winner));
        var denied = await successor.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode); NoCookie(denied);
        Assert.False(await sessions.IsActiveAsync(first.result.UserId, first.result.SessionId));
    }

    [Fact]
    public async Task RegistrationAndPasswordLoginCreateSeparateSidFamiliesAndLegacyJwtIsRejected()
    {
        using var client = Client(fixture.Factory);
        var email = Guid.NewGuid() + "@security.invalid";
        var registered = await client.PostAsJsonAsync("/api/auth/register/customer", new
            { email, password = "FixturePassword123", fullName = "F6 fixture" });
        registered.EnsureSuccessStatusCode();
        var first = (await registered.Content.ReadFromJsonAsync<AuthResultDto>())!;
        var loggedIn = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "FixturePassword123" });
        loggedIn.EnsureSuccessStatusCode();
        var second = (await loggedIn.Content.ReadFromJsonAsync<AuthResultDto>())!;
        Assert.NotEqual(first.SessionId, second.SessionId);
        Assert.Single((await State(first.SessionId)).tokens); Assert.Single((await State(second.SessionId)).tokens);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(second.AccessToken);
        Assert.Equal(second.SessionId.ToString(), jwt.Claims.Single(c => c.Type == "sid").Value);
        var legacy = new JwtSecurityToken(jwt.Issuer, jwt.Audiences.Single(), jwt.Claims.Where(c => c.Type != "sid"),
            expires: DateTime.UtcNow.AddMinutes(5), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes("fixture-only-signing-key-64-characters-never-use-in-production-123456")), SecurityAlgorithms.HmacSha256));
        using var legacyClient = fixture.Client(new JwtSecurityTokenHandler().WriteToken(legacy));
        Assert.Equal(HttpStatusCode.Unauthorized, (await legacyClient.GetAsync("/api/notifications")).StatusCode);
        using var good = fixture.Client(second.AccessToken);
        (await good.GetAsync("/api/notifications")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task SuccessorDatabaseFailureRollsBackConsumptionAndEmitsNoCredentials()
    {
        var first = await Session();
        await using var host = Host(interceptor: new FailSuccessor());
        using var client = Client(host, first.raw);
        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode); NoCookie(response);
        Assert.DoesNotContain("accessToken", await response.Content.ReadAsStringAsync());
        var state = await State(first.result.SessionId);
        Assert.Single(state.tokens); Assert.Null(state.tokens[0].RevokedAt); Assert.Null(state.tokens[0].ReplacedByToken);
        Assert.Null(state.session.RevokedAt);
        using var retry = Client(fixture.Factory, first.raw);
        (await retry.PostAsJsonAsync("/api/auth/refresh", new { })).EnsureSuccessStatusCode();
    }

    [Theory]
    [InlineData("https://evil.invalid", "1", false)]
    [InlineData("null", "1", false)]
    [InlineData("", "1", false)]
    [InlineData("https://localhost", "", false)]
    [InlineData("https://localhost", "1", true)]
    public async Task ExpiredAccessLogoutRequiresTrustedOriginAndCsrfHeader(string origin, string csrf, bool allowed)
    {
        var first = await Session();
        using var client = Client(fixture.Factory, first.raw);
        client.DefaultRequestHeaders.Remove("Origin"); client.DefaultRequestHeaders.Remove("X-Karigor-CSRF");
        if (origin != "") client.DefaultRequestHeaders.Add("Origin", origin);
        if (csrf != "") client.DefaultRequestHeaders.Add("X-Karigor-CSRF", csrf);
        client.DefaultRequestHeaders.Authorization = new("Bearer", ExpiredJwt(first.result));
        var response = await client.PostAsJsonAsync("/api/auth/logout", new { });
        Assert.Equal(allowed ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(allowed, (await State(first.result.SessionId)).session.RevokedAt is not null);
        if (allowed)
        {
            var cookie = response.Headers.GetValues("Set-Cookie").Single().ToLowerInvariant();
            Assert.Contains("httponly", cookie); Assert.Contains("secure", cookie); Assert.Contains("samesite=lax", cookie); Assert.Contains("path=/", cookie);
            Assert.Contains("expires=thu, 01 jan 1970", cookie);
        }
        else NoCookie(response);
    }

    private static string ExpiredJwt(AuthResultDto result)
    {
        var token = new JwtSecurityToken("karigor-security-tests", "karigor-security-tests",
            [new Claim("sub", result.UserId), new Claim("sid", result.SessionId.ToString())],
            expires: DateTime.UtcNow.AddMinutes(-1), signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes("fixture-only-signing-key-64-characters-never-use-in-production-123456")), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Fact]
    public async Task CookieExpiryUsesConfiguredAbsoluteSessionLifetimeAndLogoutUnknownIsGeneric()
    {
        await using var host = fixture.Factory.WithWebHostBuilder(b => b.UseSetting("Jwt:RefreshTokenExpiryDays", "3"));
        var first = await Session(host);
        Assert.InRange(first.result.RefreshTokenExpiry - DateTime.UtcNow, TimeSpan.FromDays(2.99), TimeSpan.FromDays(3.01));
        using var client = Client(host, first.raw);
        var response = await client.PostAsJsonAsync("/api/auth/refresh", new { }); response.EnsureSuccessStatusCode();
        var cookie = Microsoft.Net.Http.Headers.SetCookieHeaderValue.Parse(response.Headers.GetValues("Set-Cookie").Single());
        Assert.True(cookie.HttpOnly); Assert.True(cookie.Secure); Assert.Equal("/", cookie.Path.Value);
        Assert.Equal(Microsoft.Net.Http.Headers.SameSiteMode.Lax, cookie.SameSite);
        Assert.InRange((cookie.Expires!.Value.UtcDateTime - first.result.RefreshTokenExpiry).Duration(), TimeSpan.Zero, TimeSpan.FromSeconds(1));
        Assert.Equal(first.result.RefreshTokenExpiry, (await State(first.result.SessionId)).tokens.Last().ExpiresAt);
        using var unknown = Client(host, "unrecognized");
        var logout = await unknown.PostAsJsonAsync("/api/auth/logout", new { }); logout.EnsureSuccessStatusCode();
        Assert.Equal("{\"message\":\"Logged out successfully.\"}", await logout.Content.ReadAsStringAsync());
    }
}
