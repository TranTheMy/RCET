import api from '../config/api';
import type {
  ApiResponse,
  CurriculumCreateRequest,
  CurriculumItem,
  CurriculumListPayload,
  CurriculumListQueryParams,
} from '../types';

export const curriculumService = {
  /** Giáo trình đã duyệt (approved) — thư viện công khai */
  listPublic: (params?: CurriculumListQueryParams) =>
    api.get<ApiResponse<CurriculumListPayload>>('/curriculum', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<CurriculumItem>>(`/curriculum/${id}`).then((r) => r.data),

  listMine: () =>
    api
      .get<ApiResponse<{ items: CurriculumItem[] }>>('/curriculum/mine', { params: { _t: Date.now() } })
      .then((r) => r.data),

  listPending: (params?: { category_id?: string; q?: string }) =>
    api.get<ApiResponse<{ items: CurriculumItem[] }>>('/curriculum/pending/list', { params }).then((r) => r.data),

  listHistory: (version_group_id: string) =>
    api
      .get<ApiResponse<{ items: CurriculumItem[] }>>('/curriculum/history', { params: { version_group_id } })
      .then((r) => r.data),

  approve: (id: string, review_note?: string) =>
    api.patch<ApiResponse<CurriculumItem>>(`/curriculum/${id}/approve`, { review_note }).then((r) => r.data),

  reject: (id: string, review_note: string) =>
    api.patch<ApiResponse<CurriculumItem>>(`/curriculum/${id}/reject`, { review_note }).then((r) => r.data),

  submit: (id: string) =>
    api.post<ApiResponse<CurriculumItem>>(`/curriculum/${id}/submit`).then((r) => r.data),

  createVersion: (id: string) =>
    api.post<ApiResponse<CurriculumItem>>(`/curriculum/${id}/versions`).then((r) => r.data),

  getDownloadUrl: (id: string) =>
    api.get<ApiResponse<{ url: string; expires_in: number | null }>>(`/curriculum/${id}/download-url`).then((r) => r.data),

  /** PDF xem trước qua backend (JWT) — tránh CORS / chặn iframe từ CDN */
  getPreviewBlob: async (id: string): Promise<Blob> => {
    try {
      const res = await api.get<Blob>(`/curriculum/${id}/preview`, { responseType: 'blob' });
      return res.data;
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: unknown; headers?: Record<string, string> };
      };
      const resp = ax.response;
      const body = resp?.data;
      if (body instanceof Blob && resp?.status && resp.status >= 400) {
        const ct = String(resp.headers?.['content-type'] || '');
        let msg = 'Không tải được xem trước';
        if (ct.includes('application/json')) {
          const text = await body.text();
          try {
            const j = JSON.parse(text) as { message?: string };
            if (j?.message) msg = j.message;
          } catch {
            /* giữ msg mặc định */
          }
        }
        throw new Error(msg);
      }
      throw err;
    }
  },

  create: (data: CurriculumCreateRequest) => {
    const form = new FormData();
    form.append('title', data.title);
    if (data.description !== undefined && data.description !== null) form.append('description', data.description);
    if (data.category_id) form.append('category_id', data.category_id);
    if (data.category) form.append('category', data.category);
    if (data.authors) form.append('authors', data.authors);
    if (data.file) form.append('file', data.file);
    if (data.pdf_url) form.append('pdf_url', data.pdf_url);

    return api.post<ApiResponse<CurriculumItem>>('/curriculum', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  update: (id: string, data: Partial<CurriculumCreateRequest>) => {
    const form = new FormData();
    if (data.title) form.append('title', data.title);
    if (data.description !== undefined) form.append('description', data.description ?? '');
    if (data.category_id) form.append('category_id', data.category_id);
    if (data.category !== undefined) form.append('category', data.category ?? '');
    if (data.authors !== undefined) form.append('authors', data.authors ?? '');
    if (data.file) form.append('file', data.file);
    if (data.pdf_url !== undefined) form.append('pdf_url', data.pdf_url ?? '');

    return api.put<ApiResponse<CurriculumItem>>(`/curriculum/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  remove: (id: string, body?: { reason?: string }) =>
    api.delete<ApiResponse>(`/curriculum/${id}`, { data: body || {} }).then((r) => r.data),
  restore: (id: string) => api.patch<ApiResponse<CurriculumItem>>(`/curriculum/${id}/restore`).then((r) => r.data),
};
