import { apiClient } from './client';

export interface SendMessageDto {
  bookingId?: number;
  receiverId?: string;
  content: string;
}

export interface MessageDto {
  id: number;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverId: string;
  receiverName: string;
  bookingId?: number;
  content: string;
  sentAt: string;
  isRead: boolean;
  isMine: boolean;
}

export interface ConversationSummaryDto {
  bookingId?: number;
  categoryName: string;
  otherPartyUserId: string;
  otherPartyName: string;
  otherPartyRole: string;
  lastMessage: string;
  lastMessageSentAt: string;
  unreadCount: number;
}

export const messagingApi = {
  sendMessage: async (data: SendMessageDto): Promise<MessageDto> => {
    const response = await apiClient.post<MessageDto>('/messages', data);
    return response.data;
  },

  getBookingMessages: async (bookingId: number): Promise<MessageDto[]> => {
    const response = await apiClient.get<MessageDto[]>(`/messages/booking/${bookingId}`);
    return response.data;
  },

  getConversations: async (): Promise<ConversationSummaryDto[]> => {
    const response = await apiClient.get<ConversationSummaryDto[]>('/messages/conversations');
    return response.data;
  },

  markBookingRead: async (bookingId: number): Promise<void> => {
    await apiClient.put(`/messages/booking/${bookingId}/read`);
  },
};
