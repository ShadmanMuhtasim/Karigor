using System;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Karigor.Application.Realtime;

namespace Karigor.Api.Hubs;

[Authorize]
public class KarigorHub(BookingAccess access) : Hub
{
    private string? GetUserId() =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

    private bool IsAdmin() =>
        Context.User?.IsInRole("Admin") == true ||
        Context.User?.HasClaim(ClaimTypes.Role, "Admin") == true ||
        Context.User?.HasClaim("role", "Admin") == true;

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        if (!await access.IsActiveUserAsync(userId, Context.ConnectionAborted))
        {
            Context.Abort();
            return;
        }
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        if (IsAdmin())
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
        }

        if (Context.User?.IsInRole("Worker") == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, "Workers");

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        if (IsAdmin())
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, "Admins");
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinBooking(int bookingId)
    {
        await RequireParticipantAsync(bookingId);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"booking_{bookingId}");
    }

    public async Task LeaveBooking(int bookingId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"booking_{bookingId}");
    }

    public async Task SendTyping(int bookingId, bool isTyping)
    {
        var participants = await RequireParticipantAsync(bookingId);
        var userId = GetUserId();
        var otherUserId = participants.CustomerUserId == userId
            ? participants.WorkerUserId : participants.CustomerUserId;
        if (!await access.IsActiveUserAsync(otherUserId, Context.ConnectionAborted)) return;
        await Clients.Group($"user_{otherUserId}").SendAsync("UserTyping", new
        {
            BookingId = bookingId,
            UserId = userId,
            IsTyping = isTyping
        });
    }

    private async Task<BookingParticipants> RequireParticipantAsync(int bookingId)
    {
        // Lookup errors propagate as denied invocations; no cached allow or group fallback.
        var participants = await access.GetParticipantsAsync(bookingId, Context.ConnectionAborted);
        if (participants is null || !participants.Contains(GetUserId()) ||
            !await access.IsActiveUserAsync(GetUserId(), Context.ConnectionAborted))
            throw new HubException("Booking access denied.");
        return participants;
    }
}
