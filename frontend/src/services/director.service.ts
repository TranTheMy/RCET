import api from '../config/api';
import type { ApiResponse } from '../types';

export interface DirectorLabStaffUser {
  id: string;
  full_name: string;
  email: string;
  student_code?: string | null;
  department?: string | null;
  system_role?: string | null;
  status: string;
  email_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const directorService = {
  listLabStaff: (params?: { role?: string; search?: string; page?: number; limit?: number }) =>
    api
      .get<
        ApiResponse<{
          users: DirectorLabStaffUser[];
          pagination: { total: number; page: number; limit: number; totalPages: number };
        }>
      >('/director/lab-staff', { params })
      .then((r) => r.data),

  updateLabStaffSystemRole: (userId: string, body: { system_role: 'member' | 'truong_lab'; note?: string | null }) =>
    api.patch<ApiResponse<{ message?: string; user?: DirectorLabStaffUser }>>(`/director/lab-staff/${userId}/system-role`, body).then((r) => r.data),
};
