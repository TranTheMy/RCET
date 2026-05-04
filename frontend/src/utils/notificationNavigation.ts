import type { NavigateFunction } from 'react-router-dom';

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '');
}

function toInternalPath(url: URL): string {
  const path = `${url.pathname}${url.search}${url.hash}`;
  return path || '/';
}

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

  if (/^(https?:)?\/\//i.test(t)) {
    try {
      const current = window.location;
      const u = new URL(t, current.origin);

      // Consider different scheme (http/https) and www variants as same app host.
      const sameHost =
        /^https?:$/i.test(u.protocol) &&
        normalizeHostname(u.hostname) === normalizeHostname(current.hostname);

      if (sameHost) {
        navigate(toInternalPath(u));
        return;
      }

      window.location.assign(u.toString());
      return;
    } catch {
      navigate('/');
      return;
    }
  }

  navigate(t.startsWith('/') ? t : `/${t.replace(/^\/+/, '')}`);
}
