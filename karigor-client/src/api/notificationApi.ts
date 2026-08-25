import { apiClient } from './client';

export interface NotificationDto {
  id: number;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  relatedEntityId?: number;
  createdAt: string;
}

export const notificationApi = {
  getNotifications: async (): Promise<NotificationDto[]> => {
    const response = await apiClient.get<NotificationDto[]>('/notifications');
    return response.data;
  },

  markRead: async (id: number): Promise<NotificationDto> => {
    const response = await apiClient.put<NotificationDto>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  },
};
