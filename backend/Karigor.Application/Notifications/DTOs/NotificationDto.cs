using System;

namespace Karigor.Application.Notifications.DTOs;

public class NotificationDto
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public int? RelatedEntityId { get; set; }
    public DateTime CreatedAt { get; set; }
}
