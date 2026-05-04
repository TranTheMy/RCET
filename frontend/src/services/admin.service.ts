import api from '../config/api';
import type { ApiResponse } from '../types';

export interface ApprovalRequestItem {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    student_code?: string;
    department?: string;
    status: string;
    email_verified: boolean;
    created_at: string;
  };
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  student_code?: string;
  department?: string;
  system_role?: string | null;
  status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  action: string;
  performed_by: string | null;
  target_user_id: string | null;
  metadata?: Record<string, unknown> | string | null;
  created_at: string;
  performer?: { id: string; full_name: string; email: string } | null;
  target?: { id: string; full_name: string; email: string } | null;
}

export const adminService = {
  getApprovalRequests: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ requests: ApprovalRequestItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>('/admin/approval-requests', { params }).then((r) => r.data),

  approveUser: (requestId: string, data: { system_role: string; review_note?: string }) =>
    api.post<ApiResponse>(`/admin/approval/${requestId}/approve`, data).then((r) => r.data),

  rejectUser: (requestId: string, data: { review_note?: string }) =>
    api.post<ApiResponse>(`/admin/approval/${requestId}/reject`, data).then((r) => r.data),

  getUsers: (params?: { status?: string; role?: string; search?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<{ users: AdminUser[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>(
      '/admin/users',
      { params },
    ).then((r) => r.data),

  banUser: (userId: string) =>
    api.patch<ApiResponse>(`/admin/users/${userId}/ban`).then((r) => r.data),

  unbanUser: (userId: string) =>
    api.patch<ApiResponse>(`/admin/users/${userId}/unban`).then((r) => r.data),

  getAuditLogs: (params?: { action?: string; page?: number; limit?: number }) =>
    api
      .get<
        ApiResponse<{
          logs: AuditLogRow[];
          pagination: { total: number; page: number; limit: number; totalPages: number };
        }>
      >('/admin/audit-logs', { params })
      .then((r) => r.data),
};
