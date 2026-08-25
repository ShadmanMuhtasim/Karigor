using System.Threading.Tasks;

namespace Karigor.Application.Realtime;

public interface IRealtimeNotifier
{
    Task NotifyUserAsync(string userId, string eventName, object data);
    Task NotifyBookingGroupAsync(int bookingId, string eventName, object data);
    Task BroadcastAsync(string eventName, object data);
}
