using System.Collections.Concurrent;
using System.Security.Claims;
using Karigor.Application.Auth;
using Microsoft.AspNetCore.SignalR;

namespace Karigor.Api.Realtime;

/// <summary>Local transport routing, never an authorization cache. Every private send reads SQL.</summary>
public sealed class SessionConnections(TimeProvider clock)
{
    private sealed record Connection(string UserId, Guid SessionId, long Expiry);
    private readonly ConcurrentDictionary<string, Connection> connections = new();

    public void Add(HubCallerContext context)
    {
        var user = context.User!;
        connections[context.ConnectionId] = new(user.FindFirstValue(ClaimTypes.NameIdentifier)!,
            Guid.Parse(user.FindFirstValue("sid") ?? user.FindFirstValue(ClaimTypes.Sid)!),
            long.Parse(user.FindFirstValue("exp")!));
    }

    public void Remove(string id) => connections.TryRemove(id, out _);

    public async Task<string[]> AuthorizedConnections(string userId, RefreshSessionService sessions)
    {
        var candidates = connections.Where(c => c.Value.UserId == userId &&
            c.Value.Expiry > clock.GetUtcNow().ToUnixTimeSeconds()).ToArray();
        var valid = new List<string>();
        foreach (var family in candidates.GroupBy(c => c.Value.SessionId))
            if (await sessions.IsActiveAsync(userId, family.Key))
                valid.AddRange(family.Where(c => c.Value.Expiry > clock.GetUtcNow().ToUnixTimeSeconds()).Select(c => c.Key));
        return valid.ToArray();
    }
}
