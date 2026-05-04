import type { NavigateFunction } from 'react-router-dom';

/**
 * Backend lưu action_url dạng absolute (http://host/projects/...).
 * navigate(fullUrl) khiến React Router coi là path tương đối → URL lồng .../http://...
 * Chuẩn hoá về pathname nội bộ hoặc mở URL ngoài domain.
 */
export function followNotificationLink(navigate: NavigateFunction, link: string | null | undefined) {
  if (link == null) return;
  const t = String(link).trim();
  if (!t) return;

  if (t.startsWith('/')) {
    navigate(t);
    return;
  }

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (u.origin === window.location.origin) {
        const path = `${u.pathname}${u.search}${u.hash}`;
        navigate(path || '/');
        return;
      }
      window.location.assign(t);
      return;
    } catch {
      navigate('/');
      return;
    }
  }

  navigate(t.startsWith('/') ? t : `/${t.replace(/^\/+/, '')}`);
}
