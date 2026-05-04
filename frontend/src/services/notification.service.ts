import api from '../config/api';
import type {
  ApiResponse,
  NotificationItem,
  NotificationListData,
  UnreadCountData,
} from '../types';

export type { NotificationItem };

export const notificationService = {
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get<ApiResponse<NotificationListData>>('/notifications', { params }).then((r) => r.data),

  getUnreadCount: () =>
    api.get<ApiResponse<UnreadCountData>>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: string) =>
    api.patch<ApiResponse<NotificationItem>>(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    api.patch<ApiResponse<{ updated: number }>>('/notifications/read-all').then((r) => r.data),
};
