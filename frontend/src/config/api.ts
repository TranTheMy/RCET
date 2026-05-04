import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData: bỏ Content-Type mặc định application/json để trình duyệt gửi multipart + boundary.
  // Nếu không, server/multer có thể không nhận được part file → req.file undefined.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers;
    if (h && typeof (h as { delete?: (k: string) => void }).delete === 'function') {
      (h as { delete: (k: string) => void }).delete('Content-Type');
    } else if (h && typeof h === 'object') {
      delete (h as Record<string, unknown>)['Content-Type'];
    }
  }
  return config;
});

// Response interceptor — handle 401 + auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      const requestUrl = (originalRequest?.url || '').toString();
      // Avoid redirect loops for guest bootstrap call (`/auth/me`):
      // zustand `initialize()` will clear tokens/state on failure.
      if (requestUrl.includes('/auth/me')) {
        return Promise.reject(error);
      }

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh-token`, {
            refresh_token: refreshToken,
          });

          if (data.success) {
            localStorage.setItem('access_token', data.data.access_token);
            originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
            window.dispatchEvent(new CustomEvent('vkslab-access-token-refreshed'));
            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        // Chỉ redirect /login khi đã có access/refresh token; khách pure không bị đẩy khỏi trang public.
        const hadCredential =
          !!localStorage.getItem('access_token') ||
          !!localStorage.getItem('refresh_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (hadCredential) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
