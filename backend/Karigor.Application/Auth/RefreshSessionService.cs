using System.Security.Claims;
using Karigor.Application.Auth.DTOs;
using Karigor.Infrastructure.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;

namespace Karigor.Application.Auth;

public sealed class RefreshConflictException : Exception;

/// <summary>SQL owns consumption and revocation. Lock order: user, session, token.</summary>
public sealed class RefreshSessionService(KarigorDbContext db, ITokenService tokens,
    UserManager<ApplicationUser> users, IConfiguration config, TimeProvider clock)
{
    private sealed class NoRetryStrategy(KarigorDbContext context) : ExecutionStrategy(context, 0, TimeSpan.Zero)
    {
        protected override bool ShouldRetryOn(Exception exception) => false;
    }
    private DateTime Now => clock.GetUtcNow().UtcDateTime;
    private static UnauthorizedAccessException Denied() => new("Session unavailable. Sign in again.");

    // Deliberately no automatic transaction retry: an unknown commit result requires sign-in.
    // Registration already owns its transaction. No raw token is returned before its commit.
    private async Task<T> Transaction<T>(Func<Task<T>> action)
    {
        if (db.Database.CurrentTransaction is not null) return await action();
        return await new NoRetryStrategy(db).ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            var result = await action();
            await tx.CommitAsync();
            return result;
        });
    }

    private Task<ApplicationUser> LockUser(string id) => db.Users
        .FromSqlInterpolated($"SELECT * FROM dbo.AspNetUsers WITH (UPDLOCK,HOLDLOCK) WHERE Id={id}")
        .AsNoTracking().SingleAsync();

    private Task<RefreshSession> LockSession(Guid id) => db.RefreshSessions
        .FromSqlInterpolated($"SELECT * FROM dbo.RefreshSessions WITH (UPDLOCK,HOLDLOCK) WHERE Id={id}")
        .AsNoTracking().SingleAsync();

    private void RequireActive(ApplicationUser user, RefreshSession? session = null)
    {
        if (user.LockoutEnd > clock.GetUtcNow() ||
            (session is not null && (session.UserId != user.Id || session.RevokedAt is not null || session.ExpiresAt <= Now)))
            throw Denied();
    }

    public Task<(AuthResultDto result, string rawRefreshToken)> CreateAsync(string userId, string? expectedSecurityStamp = null) => Transaction(async () =>
    {
        var user = await LockUser(userId);
        RequireActive(user);
        if (expectedSecurityStamp is not null && user.SecurityStamp != expectedSecurityStamp) throw Denied();
        var days = config.GetValue("Jwt:RefreshTokenExpiryDays", 7);
        if (days <= 0 || days > 365) throw new InvalidOperationException("Invalid refresh session lifetime.");
        var session = new RefreshSession { Id = Guid.NewGuid(), UserId = userId, CreatedAt = Now, ExpiresAt = Now.AddDays(days) };
        db.RefreshSessions.Add(session);
        var raw = tokens.GenerateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken { UserId = userId, SessionId = session.Id,
            TokenHash = tokens.HashToken(raw), CreatedAt = Now, ExpiresAt = session.ExpiresAt });
        await db.SaveChangesAsync();
        return (await Result(user, session), raw);
    });

    public async Task<(AuthResultDto result, string rawRefreshToken)> RefreshAsync(string raw)
    {
        if (raw.Length > 128) throw Denied();
        var hash = tokens.HashToken(raw);
        // This observation defines overlap, not a grace interval. Capture once, outside retries.
        var observed = await db.RefreshTokens.AsNoTracking().TagWith("F6: initial token observation")
            .SingleOrDefaultAsync(t => t.TokenHash == hash);
        if (observed is null || observed.ExpiresAt <= Now || observed.SessionId is null) throw Denied();
        var outcome = await Transaction(async () =>
        {
            var user = await LockUser(observed.UserId);
            var session = await LockSession(observed.SessionId.Value);
            var current = await db.RefreshTokens.AsNoTracking().SingleAsync(t => t.Id == observed.Id);
            // Expiration always precedes replay handling, including expiry while waiting for a lock.
            if (current.ExpiresAt <= Now) throw Denied();
            RequireActive(user, session);
            if (current.RevokedAt is not null)
            {
                if (observed.RevokedAt is null) throw new RefreshConflictException();
                await Revoke(session.Id, "Replay");
                return ((AuthResultDto result, string rawRefreshToken)?)null;
            }
            var successor = tokens.GenerateRefreshToken();
            var successorHash = tokens.HashToken(successor);
            var now = Now;
            var consumed = await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE dbo.RefreshTokens SET RevokedAt={now}, ReplacedByToken={successorHash}
                WHERE Id={current.Id} AND RowVersion={observed.RowVersion} AND RevokedAt IS NULL AND ExpiresAt>{now}
                """);
            if (consumed != 1) throw new RefreshConflictException();
            db.RefreshTokens.Add(new RefreshToken { UserId = user.Id, SessionId = session.Id,
                ParentTokenId = current.Id, TokenHash = successorHash, CreatedAt = now, ExpiresAt = session.ExpiresAt });
            await db.SaveChangesAsync();
            return ((AuthResultDto result, string rawRefreshToken)?)(await Result(user, session), successor);
        });
        return outcome ?? throw Denied(); // Replay revocation must commit before the 401 is returned.
    }

    public async Task LogoutAsync(string raw)
    {
        if (raw.Length > 128) return;
        var hash = tokens.HashToken(raw);
        var token = await db.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(t => t.TokenHash == hash);
        if (token?.SessionId is not Guid id) return;
        await Transaction(async () =>
        {
            await LockUser(token.UserId);
            await LockSession(id);
            await Revoke(id, "Logout");
            return true;
        });
    }

    private Task<int> Revoke(Guid id, string reason)
    {
        var now = Now;
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE dbo.RefreshSessions SET RevokedAt={now}, RevocationReason={reason}
            WHERE Id={id} AND RevokedAt IS NULL
            """);
    }

    public Task<IdentityResult> ResetPasswordAsync(string userId, string token, string password) => Transaction(async () =>
    {
        await LockUser(userId);
        // Reload after acquiring the same lock used by login, refresh and suspension.
        var user = await users.FindByIdAsync(userId) ?? throw Denied();
        await db.Entry(user).ReloadAsync();
        var result = await users.ResetPasswordAsync(user, token, password);
        if (!result.Succeeded) return result;
        var now = Now;
        // Password reset signs out every device. Use F6's existing Logout reason;
        // the production constraint intentionally permits only Logout/Replay/Suspension.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE dbo.RefreshSessions SET RevokedAt={now}, RevocationReason=N'Logout'
            WHERE UserId={userId} AND RevokedAt IS NULL;
            UPDATE dbo.RefreshTokens SET RevokedAt={now}
            WHERE UserId={userId} AND RevokedAt IS NULL;
            """);
        return result;
    });

    public Task<bool> SetSuspensionAsync(string userId, bool suspend) => Transaction(async () =>
    {
        await LockUser(userId);
        DateTimeOffset? end = suspend ? clock.GetUtcNow().AddYears(100) : null;
        var stamp = Guid.NewGuid().ToString();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE dbo.AspNetUsers SET LockoutEnabled=1, LockoutEnd={end}, ConcurrencyStamp={stamp} WHERE Id={userId}
            """);
        if (suspend)
        {
            // The user lock excludes every family mutation, including new logins.
            var now = Now;
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE dbo.RefreshSessions SET RevokedAt={now}, RevocationReason=N'Suspension'
                WHERE UserId={userId} AND RevokedAt IS NULL
                """);
        }
        return true;
    });

    public Task<bool> IsActiveAsync(string? userId, Guid sessionId, CancellationToken cancellation = default)
    {
        var now = Now;
        var offset = clock.GetUtcNow();
        return db.RefreshSessions.AsNoTracking().AnyAsync(s => s.Id == sessionId && s.UserId == userId &&
            s.RevokedAt == null && s.ExpiresAt > now && (s.User.LockoutEnd == null || s.User.LockoutEnd <= offset), cancellation);
    }

    public Task<bool> IsActiveAsync(ClaimsPrincipal? principal, CancellationToken cancellation = default)
    {
        if (!Guid.TryParse((principal?.FindFirstValue("sid") ?? principal?.FindFirstValue(ClaimTypes.Sid)), out var sid) ||
            !long.TryParse(principal?.FindFirstValue("exp"), out var exp) || exp <= clock.GetUtcNow().ToUnixTimeSeconds())
            return Task.FromResult(false);
        return IsActiveAsync(principal?.FindFirstValue(ClaimTypes.NameIdentifier), sid, cancellation);
    }

    private async Task<AuthResultDto> Result(ApplicationUser user, RefreshSession session)
    {
        var roles = await users.GetRolesAsync(user);
        var (jwt, expiry) = tokens.GenerateAccessToken(user, roles, session.Id, session.ExpiresAt);
        return new AuthResultDto { AccessToken = jwt, AccessTokenExpiry = expiry, UserId = user.Id,
            Email = user.Email!, Role = roles.FirstOrDefault() ?? "", SessionId = session.Id,
            RefreshTokenExpiry = session.ExpiresAt };
    }
}
