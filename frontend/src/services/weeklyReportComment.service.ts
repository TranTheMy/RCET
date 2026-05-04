import api from '../config/api';
import type { ApiResponse, WeeklyReportComment } from '../types';

function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

/**
 * Comment trên weekly report — mount tại `/api` (không nằm dưới `/projects`).
 * - GET/POST `/:weeklyReportId/comments`
 * - PUT/DELETE `/comments/:commentId`
 */
export const weeklyReportCommentService = {
  list: (weeklyReportId: string) =>
    api.get<ApiResponse<WeeklyReportComment[]>>(`/${weeklyReportId}/comments`).then(pickData),

  create: (weeklyReportId: string, content: string) =>
    api
      .post<ApiResponse<WeeklyReportComment>>(`/${weeklyReportId}/comments`, { content })
      .then(pickData),

  update: (commentId: string, content: string) =>
    api.put<ApiResponse<WeeklyReportComment>>(`/comments/${commentId}`, { content }).then(pickData),

  delete: async (commentId: string) => {
    await api.delete<ApiResponse<unknown>>(`/comments/${commentId}`);
  },
};
