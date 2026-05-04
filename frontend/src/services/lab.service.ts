import api from '../config/api';
import type { ApiResponse } from '../types';

/** User từ bảng Users — hiển thị public (không có password) */
export interface LabDirectoryUser {
  id: string;
  full_name: string;
  email: string;
  system_role: string;
  department: string | null;
  /** URL ảnh đại diện (Cloudinary / public) — có thể null */
  avatar?: string | null;
}

export interface LabInformationData {
  directory_users: LabDirectoryUser[];
  total_directory_units: number;
}

export const labService = {
  getInformation: () =>
    api.get<ApiResponse<LabInformationData>>('/lab/information').then((r) => r.data),
};
