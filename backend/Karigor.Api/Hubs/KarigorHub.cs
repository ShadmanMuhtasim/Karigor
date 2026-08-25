using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Karigor.Api.Hubs;

[Authorize]
public class KarigorHub : Hub
{
    private string? GetUserId() =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinBooking(int bookingId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"booking_{bookingId}");
    }

    public async Task LeaveBooking(int bookingId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"booking_{bookingId}");
    }

    public async Task SendTyping(int bookingId, bool isTyping)
    {
        var userId = GetUserId();
        await Clients.OthersInGroup($"booking_{bookingId}").SendAsync("UserTyping", new
        {
            BookingId = bookingId,
            UserId = userId,
            IsTyping = isTyping
        });
    }
}
