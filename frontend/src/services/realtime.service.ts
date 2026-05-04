import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

const resolveSocketUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export const realtimeService = {
  /**
   * Backend Socket.IO middleware requires JWT (handshake.auth.token hoặc query.token).
   * Tạo lại socket nếu access_token thay đổi (đăng nhập / refresh).
   */
  connect: (userId?: string) => {
    const token = getAccessToken();
    const prev = socket as (Socket & { _vkslabToken?: string | null }) | null;
    if (socket && prev?._vkslabToken !== token) {
      socket.disconnect();
      socket = null;
    }

    if (!socket) {
      socket = io(resolveSocketUrl(), {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        autoConnect: false,
        auth: { token: token ?? '' },
        query: {
          ...(userId ? { userId } : {}),
          ...(token ? { token } : {}),
        },
      });
      (socket as Socket & { _vkslabToken?: string | null })._vkslabToken = token;
    } else if (userId) {
      socket.io.opts.query = { ...socket.io.opts.query, userId };
    }

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  },

  disconnect: () => {
    if (socket?.connected) {
      socket.disconnect();
    }
  },

  subscribeProject: (projectId: string) => {
    if (!socket) return;
    socket.emit('subscribe_project', projectId);
  },

  /** Đăng ký phòng dashboard (BE: join `dashboard_${userId}`) — gọi sau connect. */
  subscribeDashboard: () => {
    if (!socket) return;
    const run = () => socket?.emit('subscribe_dashboard');
    if (socket.connected) run();
    else socket.once('connect', run);
  },

  onDashboardUpdate: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('dashboard_update', handler);
    return () => socket?.off('dashboard_update', handler);
  },

  onAnnouncement: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('announcement', handler);
    return () => socket?.off('announcement', handler);
  },

  onProjectUpdate: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('project_update', handler);
    return () => socket?.off('project_update', handler);
  },

  onProjectsUpdate: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('projects_update', handler);
    return () => socket?.off('projects_update', handler);
  },

  onResearchPendingSubmitted: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('research:pending-submitted', handler);
    return () => socket?.off('research:pending-submitted', handler);
  },

  onResearchStatusUpdated: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('research:status-updated', handler);
    return () => socket?.off('research:status-updated', handler);
  },

  onCurriculumPendingSubmitted: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('curriculum:pending-submitted', handler);
    return () => socket?.off('curriculum:pending-submitted', handler);
  },

  onCurriculumStatusUpdated: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('curriculum:status-updated', handler);
    return () => socket?.off('curriculum:status-updated', handler);
  },

  onDocumentPendingSubmitted: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('document:pending-submitted', handler);
    return () => socket?.off('document:pending-submitted', handler);
  },

  onDocumentStatusUpdated: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('document:status-changed', handler);
    return () => socket?.off('document:status-changed', handler);
  },

  /** Duyệt hồ sơ nhà khoa học (trưởng lab / viện trưởng) — danh sách thay đổi */
  onScientistApplicationListChanged: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('scientist-application:list-changed', handler);
    return () => socket?.off('scientist-application:list-changed', handler);
  },

  onMemberDashboardTaskCompleted: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('member-dashboard:task-completed', handler);
    return () => socket?.off('member-dashboard:task-completed', handler);
  },

  /** Thông báo in-app (BE: io.to(user_).emit('notification', ...)) */
  onNotification: (handler: (payload: unknown) => void) => {
    if (!socket) return () => {};
    socket.on('notification', handler);
    return () => socket?.off('notification', handler);
  },
};
