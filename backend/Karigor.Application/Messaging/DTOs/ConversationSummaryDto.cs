using System;

namespace Karigor.Application.Messaging.DTOs;

public class ConversationSummaryDto
{
    public int? BookingId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string OtherPartyUserId { get; set; } = string.Empty;
    public string OtherPartyName { get; set; } = string.Empty;
    public string OtherPartyRole { get; set; } = string.Empty;
    public string LastMessage { get; set; } = string.Empty;
    public DateTime LastMessageSentAt { get; set; }
    public int UnreadCount { get; set; }
}
