using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Messaging.DTOs;
using Karigor.Application.Notifications;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Messaging;

public class MessagingService : IMessagingService
{
    private readonly KarigorDbContext _db;
    private readonly IRealtimeNotifier _notifier;
    private readonly INotificationService _notificationService;

    public MessagingService(
        KarigorDbContext db,
        IRealtimeNotifier notifier,
        INotificationService notificationService)
    {
        _db = db;
        _notifier = notifier;
        _notificationService = notificationService;
    }

    public async Task<MessageDto> SendMessageAsync(string senderUserId, SendMessageDto dto)
    {
        string receiverUserId = dto.ReceiverId ?? string.Empty;
        string categoryName = "Service";

        if (dto.BookingId.HasValue)
        {
            var booking = await _db.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Worker)
                .Include(b => b.ServiceRequest)
                    .ThenInclude(r => r.Category)
                .FirstOrDefaultAsync(b => b.Id == dto.BookingId.Value);

            if (booking is null)
                throw new KeyNotFoundException("Booking not found.");

            var isCustomer = booking.Customer?.UserId == senderUserId;
            var isWorker   = booking.Worker?.UserId == senderUserId;

            if (!isCustomer && !isWorker)
                throw new UnauthorizedAccessException("You are not a participant in this booking.");

            // Always resolve actual other party from booking to prevent spoofing
            receiverUserId = isCustomer
                ? (booking.Worker?.UserId ?? throw new InvalidOperationException("Worker user not found for this booking."))
                : (booking.Customer?.UserId ?? throw new InvalidOperationException("Customer user not found for this booking."));

            categoryName = booking.ServiceRequest?.Category?.Name ?? "Service";
        }
        else
        {
            if (string.IsNullOrWhiteSpace(receiverUserId))
                throw new InvalidOperationException("ReceiverId is required when BookingId is not provided.");

            var receiverExists = await _db.Users.AnyAsync(u => u.Id == receiverUserId);
            if (!receiverExists)
                throw new KeyNotFoundException("Recipient user not found.");
        }

        var message = new Message
        {
            SenderId   = senderUserId,
            ReceiverId = receiverUserId,
            BookingId  = dto.BookingId,
            Content    = dto.Content.Trim(),
            SentAt     = DateTime.UtcNow,
            IsRead     = false
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        // Get sender name & role
        var senderUser = await _db.Users
            .Include(u => u.CustomerProfile)
            .Include(u => u.WorkerProfile)
            .FirstOrDefaultAsync(u => u.Id == senderUserId);

        var senderName = senderUser?.CustomerProfile?.FullName
            ?? senderUser?.Email
            ?? "Karigor User";

        var senderRole = senderUser?.WorkerProfile != null ? "Worker" : "Customer";

        var receiverUser = await _db.Users
            .Include(u => u.CustomerProfile)
            .Include(u => u.WorkerProfile)
            .FirstOrDefaultAsync(u => u.Id == receiverUserId);

        var receiverName = receiverUser?.CustomerProfile?.FullName
            ?? receiverUser?.Email
            ?? "Karigor User";

        var result = new MessageDto
        {
            Id           = message.Id,
            SenderId     = senderUserId,
            SenderName   = senderName,
            SenderRole   = senderRole,
            ReceiverId   = receiverUserId,
            ReceiverName = receiverName,
            BookingId    = message.BookingId,
            Content      = message.Content,
            SentAt       = message.SentAt,
            IsRead       = message.IsRead,
            IsMine       = true
        };

        // Real-time broadcast
        if (dto.BookingId.HasValue)
        {
            await _notifier.NotifyBookingGroupAsync(dto.BookingId.Value, "ReceiveMessage", result);
        }
        await _notifier.NotifyUserAsync(receiverUserId, "ReceiveMessage", result);

        // Create In-App Notification for recipient
        var preview = message.Content.Length > 60 ? message.Content.Substring(0, 57) + "..." : message.Content;
        await _notificationService.CreateNotificationAsync(new CreateNotificationDto
        {
            UserId          = receiverUserId,
            Type            = "NewMessage",
            Message         = $"💬 New message from {senderName} ({categoryName}): \"{preview}\"",
            RelatedEntityId = dto.BookingId
        });

        return result;
    }

    public async Task<List<MessageDto>> GetBookingMessagesAsync(string userId, int bookingId)
    {
        var booking = await _db.Bookings
            .Include(b => b.Customer)
            .Include(b => b.Worker)
            .FirstOrDefaultAsync(b => b.Id == bookingId);

        if (booking is null)
            throw new KeyNotFoundException("Booking not found.");

        var isCustomer = booking.Customer?.UserId == userId;
        var isWorker   = booking.Worker?.UserId == userId;

        if (!isCustomer && !isWorker)
            throw new UnauthorizedAccessException("You are not a participant in this booking.");

        var messages = await _db.Messages
            .Include(m => m.Sender)
                .ThenInclude(u => u.CustomerProfile)
            .Include(m => m.Sender)
                .ThenInclude(u => u.WorkerProfile)
            .Include(m => m.Receiver)
                .ThenInclude(u => u.CustomerProfile)
            .Where(m => m.BookingId == bookingId)
            .OrderBy(m => m.SentAt)
            .ToListAsync();

        // Mark unread messages addressed to the current user as read
        var unread = messages.Where(m => m.ReceiverId == userId && !m.IsRead).ToList();
        if (unread.Count > 0)
        {
            foreach (var m in unread)
            {
                m.IsRead = true;
            }
            await _db.SaveChangesAsync();
        }

        return messages.Select(m => new MessageDto
        {
            Id           = m.Id,
            SenderId     = m.SenderId,
            SenderName   = m.Sender.CustomerProfile?.FullName ?? m.Sender.Email ?? $"User {m.SenderId.Substring(0, 5)}",
            SenderRole   = m.Sender.WorkerProfile != null ? "Worker" : "Customer",
            ReceiverId   = m.ReceiverId,
            ReceiverName = m.Receiver.CustomerProfile?.FullName ?? m.Receiver.Email ?? $"User {m.ReceiverId.Substring(0, 5)}",
            BookingId    = m.BookingId,
            Content      = m.Content,
            SentAt       = m.SentAt,
            IsRead       = m.IsRead,
            IsMine       = m.SenderId == userId
        }).ToList();
    }

    public async Task<List<ConversationSummaryDto>> GetConversationsAsync(string userId)
    {
        // Find all bookings where user is participant
        var customer = await _db.CustomerProfiles.FirstOrDefaultAsync(c => c.UserId == userId);
        var worker   = await _db.WorkerProfiles.FirstOrDefaultAsync(w => w.UserId == userId);

        var customerId = customer?.Id ?? -1;
        var workerId   = worker?.Id ?? -1;

        var bookings = await _db.Bookings
            .Include(b => b.Customer).ThenInclude(c => c.User)
            .Include(b => b.Worker).ThenInclude(w => w.User)
            .Include(b => b.ServiceRequest).ThenInclude(r => r.Category)
            .Where(b => b.CustomerId == customerId || b.WorkerId == workerId)
            .OrderByDescending(b => b.Id)
            .ToListAsync();

        var summaries = new List<ConversationSummaryDto>();

        foreach (var b in bookings)
        {
            var isCustomer = b.CustomerId == customerId;
            var otherUserId = isCustomer ? b.Worker?.UserId : b.Customer?.UserId;
            var otherName = isCustomer
                ? (b.Worker?.User?.Email ?? $"Worker #{b.WorkerId}")
                : (b.Customer?.FullName ?? $"Customer #{b.CustomerId}");
            var otherRole = isCustomer ? "Worker" : "Customer";

            var lastMessage = await _db.Messages
                .Where(m => m.BookingId == b.Id)
                .OrderByDescending(m => m.SentAt)
                .FirstOrDefaultAsync();

            var unreadCount = await _db.Messages
                .CountAsync(m => m.BookingId == b.Id && m.ReceiverId == userId && !m.IsRead);

            summaries.Add(new ConversationSummaryDto
            {
                BookingId         = b.Id,
                CategoryName      = b.ServiceRequest?.Category?.Name ?? "Service",
                OtherPartyUserId  = otherUserId ?? string.Empty,
                OtherPartyName    = otherName,
                OtherPartyRole    = otherRole,
                LastMessage       = lastMessage?.Content ?? $"Booking #{b.Id} scheduled ({b.Status})",
                LastMessageSentAt = lastMessage?.SentAt ?? b.ScheduledDate,
                UnreadCount       = unreadCount
            });
        }

        return summaries
            .OrderByDescending(s => s.UnreadCount > 0)
            .ThenByDescending(s => s.LastMessageSentAt)
            .ToList();
    }

    public async Task MarkMessagesAsReadAsync(string userId, int bookingId)
    {
        var unread = await _db.Messages
            .Where(m => m.BookingId == bookingId && m.ReceiverId == userId && !m.IsRead)
            .ToListAsync();

        if (unread.Count > 0)
        {
            foreach (var m in unread)
            {
                m.IsRead = true;
            }
            await _db.SaveChangesAsync();
        }
    }
}
