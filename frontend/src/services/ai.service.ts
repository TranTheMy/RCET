import api from '../config/api';

export interface AINotification {
  type: 'info' | 'warning' | 'suggestion' | 'alert';
  title: string;
  message: string;
  action_url?: string;
}

export interface SmartNotificationsResponse {
  notifications: AINotification[];
  suggestions: AINotification[];
  summary: {
    pending_tasks: number;
    overdue_tasks: number;
    today_tasks: number;
    active_projects: number;
    overdue_projects: number;
    report_rate: number | null;
  };
}

export interface StoredNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Gợi ý tài liệu / giáo trình từ DB (POST /ai/chat) */
export interface AiChatLibraryItem {
  id: string;
  title: string;
  category_name?: string | null;
  doc_type?: string | null;
  authors?: string | null;
}

export interface AiChatSuggestions {
  chipDocuments: AiChatLibraryItem[];
  researchCurriculums: AiChatLibraryItem[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AiChatSuggestions;
}

export interface SelectionExplainPayload {
  term: string;
  explanation: string;
}

export const aiService = {
  /** POST /api/tutorial/explain — giải thích thuật ngữ khi bôi đen (cần Bearer token). */
  async explainSelectedText(text: string) {
    const { data } = await api.post('/tutorial/explain', { text });
    return data as { success: boolean; message?: string; data?: SelectionExplainPayload };
  },

  /** Chat with AI assistant (đăng nhập — /api/ai/chat) */
  async chat(message: string, conversationHistory: ChatMessage[] = []) {
    const { data } = await api.post('/ai/chat', {
      message,
      conversation_history: conversationHistory,
    });
    return data as {
      success: boolean;
      message?: string;
      data?: { reply: string; suggestions?: AiChatSuggestions };
    };
  },

  /** Chat thông tin VKsLab cho khách — /api/ai-guest/chat (không auth, systemPrompt) */
  async chatGuest(message: string, conversationHistory: ChatMessage[] = []) {
    const { data } = await api.post('/ai-guest/chat', {
      message,
      conversation_history: conversationHistory,
    });
    return data as {
      message?: string;
      suggestion?: string | null;
      isQualified?: boolean;
      description?: string | null;
      error?: string;
    };
  },

  /** Get smart notifications (generated on-the-fly) */
  async getSmartNotifications() {
    const { data } = await api.get('/ai/notifications/smart');
    return data as { success: boolean; data: SmartNotificationsResponse };
  },

  /** Get stored notifications */
  async getNotifications(params: { page?: number; limit?: number; unread_only?: boolean } = {}) {
    const { data } = await api.get('/ai/notifications', { params });
    return data as {
      success: boolean;
      data: {
        notifications: StoredNotification[];
        unread_count: number;
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    };
  },

  /** Mark notification as read (use "all" for all) */
  async markAsRead(id: string) {
    const { data } = await api.patch(`/ai/notifications/${id}/read`);
    return data;
  },
};
