import api from '../config/api';
import type {
  ApiResponse,
  DocumentCreateRequest,
  DocumentItem,
  DocumentListPayload,
  DocumentListQueryParams,
} from '../types';

export const documentService = {
  /** Tài liệu đã publish (APPROVED) — trang Document */
  listPublic: (params?: DocumentListQueryParams) =>
    api.get<ApiResponse<DocumentListPayload>>('/documents', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get<ApiResponse<DocumentItem>>(`/documents/${id}`).then((r) => r.data),

  /** Tất cả tài liệu của tôi — My Documents */
  listMine: () =>
    api.get<ApiResponse<{ items: DocumentItem[] }>>('/documents/mine').then((r) => r.data),

  /** Viện trưởng — chờ duyệt */
  listPending: (params?: { category_id?: string; q?: string }) =>
    api.get<ApiResponse<{ items: DocumentItem[] }>>('/documents/pending/list', { params }).then((r) => r.data),

  listHistory: (version_group_id: string) =>
    api
      .get<ApiResponse<{ items: DocumentItem[] }>>('/documents/history', { params: { version_group_id } })
      .then((r) => r.data),

  approve: (id: string, review_note?: string) =>
    api.patch<ApiResponse<DocumentItem>>(`/documents/${id}/approve`, { review_note }).then((r) => r.data),

  reject: (id: string, review_note: string) =>
    api.patch<ApiResponse<DocumentItem>>(`/documents/${id}/reject`, { review_note }).then((r) => r.data),

  submit: (id: string) =>
    api.post<ApiResponse<DocumentItem>>(`/documents/${id}/submit`).then((r) => r.data),

  /** Tạo version mới từ bản REJECTED (bản nháp) */
  createVersion: (id: string) =>
    api.post<ApiResponse<DocumentItem>>(`/documents/${id}/versions`).then((r) => r.data),

  getDownloadUrl: (id: string) =>
    api.get<ApiResponse<{ url: string; expires_in: number | null }>>(`/documents/${id}/download-url`).then(r => r.data),

  getPreviewBlob: async (id: string): Promise<Blob> => {
    try {
      const res = await api.get<Blob>(`/documents/${id}/preview`, { responseType: 'blob' });
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

  create: (data: DocumentCreateRequest) => {
    const form = new FormData();
    form.append('title', data.title);
    if (data.description !== undefined && data.description !== null) form.append('description', data.description);
    if (data.category_id) form.append('category_id', data.category_id);
    if (data.category) form.append('category', data.category);

    if (data.doc_type) form.append('doc_type', data.doc_type);
    if (data.manufacturer) form.append('manufacturer', data.manufacturer);
    if (data.technical_metadata !== undefined) {
      form.append('technical_metadata', typeof data.technical_metadata === 'string' ? data.technical_metadata : JSON.stringify(data.technical_metadata));
    }

    if (data.file) form.append('file', data.file);
    if (data.pdf_url) form.append('pdf_url', data.pdf_url);

    return api.post<ApiResponse<DocumentItem>>('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  update: (id: string, data: Partial<DocumentCreateRequest>) => {
    const form = new FormData();
    if (data.title) form.append('title', data.title);
    if (data.description !== undefined) form.append('description', data.description ?? '');
    if (data.category_id) form.append('category_id', data.category_id);
    if (data.category !== undefined) form.append('category', data.category ?? '');
    if (data.doc_type) form.append('doc_type', data.doc_type);
    if (data.manufacturer) form.append('manufacturer', data.manufacturer);
    if (data.technical_metadata !== undefined) {
      form.append('technical_metadata', typeof data.technical_metadata === 'string' ? data.technical_metadata : JSON.stringify(data.technical_metadata));
    }

    if (data.file) form.append('file', data.file);
    if (data.pdf_url !== undefined) form.append('pdf_url', data.pdf_url ?? '');

    return api.put<ApiResponse<DocumentItem>>(`/documents/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  remove: (id: string, body?: { reason?: string }) =>
    api.delete<ApiResponse>(`/documents/${id}`, { data: body || {} }).then((r) => r.data),
  restore: (id: string) => api.patch<ApiResponse<DocumentItem>>(`/documents/${id}/restore`).then(r => r.data),
};