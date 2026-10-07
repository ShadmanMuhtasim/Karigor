using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Realtime;

public sealed record BookingParticipants(string CustomerUserId, string WorkerUserId)
{
    public bool Contains(string? userId) => !string.IsNullOrEmpty(userId) &&
        (userId == CustomerUserId || userId == WorkerUserId);

    public string[] UserIds => new[] { CustomerUserId, WorkerUserId }.Distinct().ToArray();
}

/// <summary>Current database relationships, never a caller-provided recipient or room membership.</summary>
public sealed class BookingAccess(KarigorDbContext db)
{
    public Task<BookingParticipants?> GetParticipantsAsync(int bookingId, CancellationToken cancellationToken = default) =>
        db.Bookings.AsNoTracking().Where(b => b.Id == bookingId && bookingId > 0)
            .Select(b => new BookingParticipants(b.Customer.UserId, b.Worker.UserId))
            .SingleOrDefaultAsync(cancellationToken);

    public Task<bool> IsActiveUserAsync(string? userId, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        return db.Users.AsNoTracking().AnyAsync(u => u.Id == userId &&
            (!u.LockoutEnd.HasValue || u.LockoutEnd <= now), cancellationToken);
    }

    public Task<List<string>> GetAdminUserIdsAsync() =>
        db.UserRoles.AsNoTracking().Where(ur => db.Roles.Any(r => r.Id == ur.RoleId && r.Name == "Admin"))
            .Select(ur => ur.UserId).Distinct().ToListAsync();
}
