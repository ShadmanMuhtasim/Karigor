using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Karigor.Application.Notifications.DTOs;
using Karigor.Application.Realtime;
using Karigor.Infrastructure.Models;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Application.Notifications;

public class NotificationService : INotificationService
{
    private readonly KarigorDbContext _db;
    private readonly IRealtimeNotifier _notifier;

    public NotificationService(KarigorDbContext db, IRealtimeNotifier notifier)
    {
        _db = db;
        _notifier = notifier;
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(string userId)
    {
        var notifications = await _db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new NotificationDto
            {
                Id              = n.Id,
                UserId          = n.UserId,
                Type            = n.Type,
                Message         = n.Message,
                IsRead          = n.IsRead,
                RelatedEntityId = n.RelatedEntityId,
                CreatedAt       = n.CreatedAt
            })
            .ToListAsync();

        return notifications;
    }

    public async Task<NotificationDto> MarkAsReadAsync(string userId, int notificationId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);

        if (notification is null)
            throw new KeyNotFoundException("Notification not found.");

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return new NotificationDto
        {
            Id              = notification.Id,
            UserId          = notification.UserId,
            Type            = notification.Type,
            Message         = notification.Message,
            IsRead          = notification.IsRead,
            RelatedEntityId = notification.RelatedEntityId,
            CreatedAt       = notification.CreatedAt
        };
    }

    public async Task MarkAllAsReadAsync(string userId)
    {
        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();

        foreach (var n in unread)
        {
            n.IsRead = true;
        }

        await _db.SaveChangesAsync();
    }

    public async Task<NotificationDto> CreateNotificationAsync(CreateNotificationDto dto)
    {
        var notification = new Notification
        {
            UserId          = dto.UserId,
            Type            = dto.Type,
            Message         = dto.Message,
            RelatedEntityId = dto.RelatedEntityId,
            IsRead          = false,
            CreatedAt       = DateTime.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        var result = new NotificationDto
        {
            Id              = notification.Id,
            UserId          = notification.UserId,
            Type            = notification.Type,
            Message         = notification.Message,
            IsRead          = notification.IsRead,
            RelatedEntityId = notification.RelatedEntityId,
            CreatedAt       = notification.CreatedAt
        };

        // Real-time SignalR push to recipient
        await _notifier.NotifyUserAsync(dto.UserId, "ReceiveNotification", result);

        return result;
    }
}
