import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { realtimeService } from '../services/realtime.service';
import { useAuthStore } from '../store/authStore';

const TOKEN_REFRESH = 'vkslab-access-token-refreshed';

/**
 * Một kết nối Socket.IO cho toàn app khi đã đăng nhập: join dashboard, thông báo hệ thống.
 * Không gọi disconnect khi đổi route — chỉ ngắt khi logout (authStore).
 */
export default function GlobalRealtimeBridge() {
  const initialized = useAuthStore((s) => s.initialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!initialized || !isAuthenticated || !userId) return;
    if (!localStorage.getItem('access_token')) return;

    realtimeService.connect(userId);
    realtimeService.subscribeDashboard();

    const onTokenRefresh = () => {
      const uid = useAuthStore.getState().user?.id;
      if (!uid || !localStorage.getItem('access_token')) return;
      realtimeService.connect(uid);
      realtimeService.subscribeDashboard();
    };
    window.addEventListener(TOKEN_REFRESH, onTokenRefresh);

    const unsubAnnouncement = realtimeService.onAnnouncement((raw) => {
      const payload = raw as { message?: string; level?: string };
      const msg = String(payload?.message || '').trim();
      if (!msg) return;
      const level = payload?.level;
      if (level === 'error') toast.error(msg);
      else if (level === 'warning') toast(msg, { icon: '⚠️' });
      else if (level === 'success') toast.success(msg);
      else toast(msg);
    });

    return () => {
      window.removeEventListener(TOKEN_REFRESH, onTokenRefresh);
      unsubAnnouncement();
    };
  }, [initialized, isAuthenticated, userId]);

  return null;
}
