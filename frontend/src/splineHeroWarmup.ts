import { HERO_SPLINE_SCENE } from './config/splineScenes';

/**
 * Side-effect import từ Home.tsx (route lazy) — chỉ chạy khi vào trang Home.
 * Fetch sớm để .splinecode vào HTTP cache trước khi Spline load(), tránh xung đột với
 * `<link rel="preload">` toàn app (credentials / route không dùng hero).
 */
if (typeof window !== 'undefined') {
  void fetch(HERO_SPLINE_SCENE, { mode: 'cors', credentials: 'omit' }).catch(() => {});
}
