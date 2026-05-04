import api from '../config/api';
import type {
  ApiResponse,
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  User,
} from '../types';

export const authService = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    api.post<ApiResponse<{ user_id: string }>>('/auth/register', data).then((r) => r.data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post<ApiResponse>('/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<ApiResponse>('/auth/reset-password', data).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<ApiResponse>('/auth/change-password', data).then((r) => r.data),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me').then((r) => r.data),

  updateProfile: (data: UpdateProfileRequest) =>
    api.patch<ApiResponse<User>>('/auth/me', data).then((r) => r.data),

  /** multipart field name `avatar` — JPG/PNG/WEBP/GIF, tối đa 5MB (backend) */
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api.patch<ApiResponse<User>>('/auth/me/avatar', form).then((r) => r.data);
  },

  refreshToken: (refresh_token: string) =>
    api.post<ApiResponse<{ access_token: string }>>('/auth/refresh-token', { refresh_token }).then((r) => r.data),

  getGoogleAuthUrl: () =>
    `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/google`,

  verifyEmail: (token: string) =>
    api.get<ApiResponse<{ message: string }>>('/auth/verify-email', { params: { token } }).then((r) => r.data),
};
