using System.ComponentModel.DataAnnotations;

namespace Karigor.Application.Messaging.DTOs;

public class SendMessageDto
{
    public int? BookingId { get; set; }

    public string? ReceiverId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Message cannot be empty.")]
    [MaxLength(4000, ErrorMessage = "Message cannot exceed 4000 characters.")]
    public string Content { get; set; } = string.Empty;
}
