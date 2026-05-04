import api from '../config/api';
import type { ApiResponse, MemberDashboardData } from '../types';

function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

export const memberDashboardService = {
  getDashboard: () =>
    api.get<ApiResponse<MemberDashboardData>>('/members/dashboard').then(pickData),
  completeTask: (taskId: string) =>
    api.patch<ApiResponse<null>>(`/members/dashboard/tasks/${taskId}/complete`).then(pickData),
};
