import api from '../config/api';
import type { ApiResponse, Commitment } from '../types';

/** Backend bọc payload trong `{ success, message, data }` — chỉ lấy `data`. */
function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

export type UpdateCommitmentStatusPayload = {
  status: 'b_approved' | 'b_rejected';
  reason?: string;
};

export type ArchiveCommitmentsPayload = {
  commitmentIds: string[];
};

export const commitmentService = {
  /**
   * Lấy danh sách các cam kết của người dùng hiện tại.
   */
  getMyCommitments: () =>
    api.get<ApiResponse<Commitment[]>>('/commitments/me').then(pickData),

  /**
   * Cập nhật trạng thái của một cam kết (Phê duyệt/Từ chối).
   * @param id - ID của cam kết.
   * @param payload - Dữ liệu cập nhật (status và reason nếu có).
   */
  updateStatus: (id: string, payload: UpdateCommitmentStatusPayload) =>
    api.patch<ApiResponse<Commitment>>(`/commitments/${id}/status`, payload).then(pickData),

  /**
 * Tải về file ZIP chứa các bản cam kết của một dự án.
 * @param projectId - ID của dự án.
 * @param ids - (Tùy chọn) Danh sách ID cam kết cụ thể để xuất file.
 */
exportZip: (projectId: string, ids?: string[]) =>
  api.get(`/commitments/projects/${projectId}/export`, {
    responseType: 'blob',
    params: {
      ids: ids && ids.length > 0 ? ids.join(',') : undefined
    }
  }).then(res => res.data),

  /**
   * Lưu trữ (chốt) hàng loạt các bản cứng cam kết.
   * @param payload - Mảng các ID của cam kết.
   */
  archiveHardcopies: (payload: ArchiveCommitmentsPayload) =>
    api.post<ApiResponse<{ message: string }>>('/commitments/bulk-archive', payload).then(pickData),
};