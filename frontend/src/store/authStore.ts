import { create } from 'zustand';
import type { User } from '../types';
import { authService } from '../services/auth.service';
import { realtimeService } from '../services/realtime.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  initialized: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; student_code?: string; department?: string }) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  initialized: false,

  initialize: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ initialized: true, isAuthenticated: false, user: null });
      return;
    }
    try {
      const res = await authService.getMe();
      set({ user: res.data, isAuthenticated: true, initialized: true });
    } catch {
      realtimeService.disconnect();
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await authService.login({ email, password });
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      // Fetch full profile after login (login response has limited fields)
      try {
        const me = await authService.getMe();
        set({ user: me.data, isAuthenticated: true, loading: false });
      } catch {
        set({ user: res.data.user, isAuthenticated: true, loading: false });
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      await authService.register(data);
      set({ loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: () => {
    realtimeService.disconnect();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    try {
      const res = await authService.getMe();
      set({ user: res.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: true }),
}));
