using System.Collections.Generic;
using System.Threading.Tasks;
using Karigor.Application.Messaging.DTOs;

namespace Karigor.Application.Messaging;

public interface IMessagingService
{
    Task<MessageDto> SendMessageAsync(string senderUserId, SendMessageDto dto);
    Task<List<MessageDto>> GetBookingMessagesAsync(string userId, int bookingId);
    Task<List<ConversationSummaryDto>> GetConversationsAsync(string userId);
    Task MarkMessagesAsReadAsync(string userId, int bookingId);
}
