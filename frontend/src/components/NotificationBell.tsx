import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import { notificationService } from '../services/notification.service';
import { realtimeService } from '../services/realtime.service';
import type { NotificationItem } from '../types';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { followNotificationLink } from '../utils/notificationNavigation';

interface NotificationBellProps {
  isScrolled: boolean;
}

export function NotificationBell({ isScrolled }: NotificationBellProps) {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, initialized } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const canUse = isAuthenticated && user?.status === 'active';

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!initialized) return;
    if (!isAuthenticated || user?.status !== 'active') return;
    if (!localStorage.getItem('access_token')) return;
    try {
      const res = await notificationService.getUnreadCount();
      if (res.success && res.data) setUnreadCount(res.data.unread_count);
    } catch {
      /* 403 hoặc mạng — bỏ qua */
    }
  }, [initialized, isAuthenticated, user?.status]);

  useEffect(() => {
    refreshUnread();
  }, [location.pathname, refreshUnread, user?.id]);

  useEffect(() => {
    if (!initialized || !isAuthenticated || user?.status !== 'active' || !user?.id) return;
    if (!localStorage.getItem('access_token')) return;

    realtimeService.connect(user.id);
    const unsub = realtimeService.onNotification(() => {
      void refreshUnread();
      if (!openRef.current) return;
      void (async () => {
        try {
          const res = await notificationService.list({ limit: 25 });
          if (res.success && res.data) setItems(res.data.items);
        } catch {
          /* ignore */
        }
      })();
    });

    return () => {
      unsub();
    };
  }, [initialized, isAuthenticated, user?.id, user?.status, refreshUnread]);

  useEffect(() => {
    if (!open || !canUse) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await notificationService.list({ limit: 25 });
        if (!cancelled && res.success && res.data) setItems(res.data.items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canUse]);

  if (!canUse) return null;

  const handleMarkAll = async () => {
    try {
      await notificationService.markAllRead();
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleClickItem = async (n: NotificationItem) => {
    try {
      if (!n.read_at) {
        await notificationService.markRead(n.id);
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
    followNotificationLink(navigate, n.link);
  };

  const iconClass = isScrolled
    ? 'text-slate-400 hover:text-cyan-400'
    : 'text-slate-600 hover:text-cyan-600';

  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${iconClass}`}
        aria-label={t('common:notification.ariaLabel')}
        aria-expanded={open}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-cyan-500 text-[9px] font-black text-[#020617]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(100vw-2rem,380px)] bg-[#020617]/95 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[110] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white">{t('common:notification.title')}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[9px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <CheckCheck size={12} aria-hidden />
                {t('common:notification.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-[min(60vh,400px)] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10 px-4">{t('common:notification.empty')}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                    !n.read_at ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <p className={`text-[11px] font-bold ${!n.read_at ? 'text-white' : 'text-slate-400'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[8px] font-mono text-slate-600 mt-2">
                    {new Date(n.created_at).toLocaleString(dateLocale)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
