import api from '../config/api';
import type {
  ApiResponse,
  ResearchItem,
  ResearchListPayload,
  ResearchListQueryParams,
  ResearchSubmitRequest,
} from '../types';

function serializeResearchListParams(
  p?: ResearchListQueryParams,
): Record<string, string | number | undefined> {
  if (!p) return {};
  const out: Record<string, string | number | undefined> = {};
  if (p.page != null) out.page = p.page;
  if (p.limit != null) out.limit = p.limit;
  if (p.q != null && String(p.q).trim() !== '') out.q = String(p.q).trim();
  if (p.tags && p.tags.length > 0) out.tags_json = JSON.stringify(p.tags);
  if (p.impact_ranks && p.impact_ranks.length > 0) {
    out.impact_rank = p.impact_ranks.join(',');
  }
  if (p.peer_reviewed && p.peer_reviewed !== 'all') out.peer_reviewed = p.peer_reviewed;
  if (p.open_access && p.open_access !== 'all') out.open_access = p.open_access;
  if (p.source_type && p.source_type !== 'all') out.source_type = p.source_type;
  if (p.readonly_highlight) out.readonly_highlight = '1';
  if (p.segment) out.segment = p.segment;
  return out;
}

export const researchService = {
  // ===== PUBLIC =====
  listPublic: (params?: ResearchListQueryParams) =>
    api
      .get<ApiResponse<ResearchListPayload>>('/research/public', {
        params: serializeResearchListParams(params),
      })
      .then((r) => r.data),

  getPublicOne: (id: string) =>
    api.get<ApiResponse<ResearchItem>>(`/research/public/${id}`)
      .then(r => r.data),

  // ===== AUTHENTICATED INTERNAL =====
  listApprovedAll: (params?: ResearchListQueryParams) =>
    api
      .get<ApiResponse<ResearchListPayload>>('/research/internal', {
        params: serializeResearchListParams(params),
      })
      .then((r) => r.data),

  tagFacetsPublic: () =>
    api
      .get<ApiResponse<{ tagCounts: Record<string, number> }>>('/research/public/facets/tags')
      .then((r) => r.data),

  tagFacetsInternal: () =>
    api
      .get<ApiResponse<{ tagCounts: Record<string, number> }>>('/research/internal/facets/tags')
      .then((r) => r.data),

  getApprovedOne: (id: string) =>
    api.get<ApiResponse<ResearchItem>>(`/research/${id}`)
      .then(r => r.data),

  /**
   * Xem trước file đính kèm (chỉ bài upload). `publicRoute`: khách dùng /research/public/:id/preview.
   */
  getPreviewBlob: async (id: string, options?: { publicRoute?: boolean }): Promise<Blob> => {
    const path = options?.publicRoute
      ? `/research/public/${id}/preview`
      : `/research/${id}/preview`;
    try {
      const res = await api.get<Blob>(path, { responseType: 'blob' });
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

  // ===== USER =====
  listMine: (params?: { include_deleted?: boolean }) =>
    api
      .get<ApiResponse<{ items: ResearchItem[] }>>('/research/mine', {
        params:
          params?.include_deleted === true ? { include_deleted: '1' } : undefined,
      })
      .then((r) => r.data),

  // ===== DIRECTOR =====
  listPending: () =>
    api.get<ApiResponse<{ items: ResearchItem[] }>>('/research/pending')
      .then(r => r.data),

  listWithdrawn: () =>
    api
      .get<ApiResponse<{ items: ResearchItem[] }>>('/research/withdrawn')
      .then((r) => r.data),

  approve: (id: string, isPublic: boolean, review_note?: string) =>
    api.patch<ApiResponse<ResearchItem>>(`/research/${id}/approve`, {
      isPublic,
      review_note,
    }).then(r => r.data),

  reject: (id: string, review_note: string) =>
    api.patch<ApiResponse<ResearchItem>>(`/research/${id}/reject`, {
      review_note,
    }).then(r => r.data),

  // ===== SUBMIT =====
  submit: (data: ResearchSubmitRequest) => {
    const form = new FormData();

    // ===== REQUIRED =====
    form.append('title', data.title);
    form.append('authors', data.authors);
    form.append('published_date', data.published_date);
    form.append('journal', data.journal);
    form.append('pages', data.pages);
    form.append('publisher', data.publisher);
    form.append('description', data.description);
    form.append('source_type', data.source_type);
    form.append('impact_rank', data.impact_rank);
    form.append('doi', data.doi);

    // ===== OPTIONAL =====
    if (data.volume !== undefined) form.append('volume', String(data.volume));
    if (data.issue !== undefined) form.append('issue', String(data.issue));
    if (data.total_citations !== undefined)
      form.append('total_citations', String(data.total_citations));

    if (data.is_peer_reviewed !== undefined)
      form.append('is_peer_reviewed', String(data.is_peer_reviewed));

    if (data.is_open_access !== undefined)
      form.append('is_open_access', String(data.is_open_access));

    // ===== SOURCE =====
    if (data.source_type === 'link') {
      form.append('pdf_url', data.pdf_url || '');
    }

    if (data.source_type === 'upload' && data.file) {
      form.append('file', data.file);
    }

    if (data.tags !== undefined && data.tags.length > 0) {
      form.append('tags', JSON.stringify(data.tags));
    }

    if (data.is_public !== undefined) {
      form.append('is_public', String(data.is_public));
    }

    return api.post<ApiResponse<ResearchItem>>('/research', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  // ===== UPDATE =====
  update: (id: string, data: ResearchSubmitRequest) => {
    const form = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'file') {
        form.append(key, String(value));
      }
    });

    if (data.file) {
      form.append('file', data.file);
    }

    return api.put<ApiResponse<ResearchItem>>(`/research/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  // ===== DELETE / RESTORE =====
  remove: (id: string, body?: { reason?: string }) =>
    api
      .delete<ApiResponse<unknown>>(`/research/${id}`, { data: body || {} })
      .then((r) => r.data),

  restore: (id: string) =>
    api
      .patch<ApiResponse<ResearchItem>>(`/research/${id}/restore`)
      .then((r) => r.data),
};