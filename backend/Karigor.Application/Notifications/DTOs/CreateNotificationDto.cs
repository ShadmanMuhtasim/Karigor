using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Notifications.DTOs;

public class CreateNotificationDto
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    public int? RelatedEntityId { get; set; }
}
