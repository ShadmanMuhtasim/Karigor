using System.Threading.Tasks;
using Karigor.Api.Hubs;
using Karigor.Application.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Karigor.Api.Realtime;

public class SignalRRealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<KarigorHub> _hubContext;
    private readonly BookingAccess _access;

    public SignalRRealtimeNotifier(IHubContext<KarigorHub> hubContext, BookingAccess access)
    {
        _hubContext = hubContext;
        _access = access;
    }

    public async Task NotifyUserAsync(string userId, string eventName, object data)
    {
        if (!await _access.IsActiveUserAsync(userId)) return;
        await _hubContext.Clients.Group($"user_{userId}").SendAsync(eventName, data);
    }

    public async Task NotifyBookingGroupAsync(int bookingId, string eventName, object data)
    {
        var participants = await _access.GetParticipantsAsync(bookingId);
        if (participants is null) return;
        foreach (var userId in participants.UserIds)
            await NotifyUserAsync(userId, eventName, data);
    }

    public async Task NotifyAdminsAsync(string eventName, object data)
    {
        foreach (var userId in await _access.GetAdminUserIdsAsync())
            await NotifyUserAsync(userId, eventName, data);
    }

    public async Task BroadcastPublicRefreshAsync(string eventName)
    {
        await _hubContext.Clients.All.SendAsync(eventName, new { refresh = true });
    }

    public Task NotifyWorkersRefreshAsync(string eventName) =>
        _hubContext.Clients.Group("Workers").SendAsync(eventName, new { refresh = true });
}
