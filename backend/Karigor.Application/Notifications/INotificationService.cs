using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Notifications.DTOs;

namespace Karigor.Application.Notifications;

public interface INotificationService
{
    Task<List<NotificationDto>> GetUserNotificationsAsync(string userId);
    Task<NotificationDto> MarkAsReadAsync(string userId, int notificationId);
    Task MarkAllAsReadAsync(string userId);
    Task<NotificationDto> CreateNotificationAsync(CreateNotificationDto dto);
}
