using System.Threading.Tasks;
using Karigor.Api.Hubs;
using Karigor.Application.Realtime;
using Microsoft.AspNetCore.SignalR;

namespace Karigor.Api.Realtime;

public class SignalRRealtimeNotifier : IRealtimeNotifier
{
    private readonly IHubContext<KarigorHub> _hubContext;

    public SignalRRealtimeNotifier(IHubContext<KarigorHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyUserAsync(string userId, string eventName, object data)
    {
        await _hubContext.Clients.Group($"user_{userId}").SendAsync(eventName, data);
    }

    public async Task NotifyBookingGroupAsync(int bookingId, string eventName, object data)
    {
        await _hubContext.Clients.Group($"booking_{bookingId}").SendAsync(eventName, data);
    }

    public async Task BroadcastAsync(string eventName, object data)
    {
        await _hubContext.Clients.All.SendAsync(eventName, data);
    }
}
