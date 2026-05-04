import api from '../config/api';
import type { ApiResponse, ScientistApplicationItem } from '../types';

export type ScientistReviewAction = 'APPROVE' | 'REJECT';

/** Dữ liệu điền vào mẫu Word (POST .../contract/generate) — mặc định Bản cam kết NCKH */
export type ScientistContractGeneratePayload = {
  /** Bên A (GV/NCV): họ và tên */
  partyAName: string;
  partyAEmail: string;
  partyAPhone?: string;
  partyAAddress?: string;
  partyARepresentative?: string;
  partyATitle?: string;
  partyAWorkUnit?: string;
  partyBName: string;
  partyBEmail: string;
  partyBPhone?: string;
  partyBAddress?: string;
  partyBStudentId?: string;
  partyBFaculty?: string;
  /** Ngày trên cam kết (YYYY-MM-DD hoặc chuỗi) */
  contractDate?: string;
  /** Địa điểm lập cam kết (dòng “tại …”) */
  contractLocation?: string;
  contractSummary?: string;
};

export const scientistApplicationService = {
  /** Kiểm tra SĐT (chữ số) chưa bị user/hồ sơ khác dùng */
  checkPhoneAvailable: (phone: string) =>
    api
      .get<{ success: boolean; data: { available: boolean } }>('/scientist-applications/check-phone', {
        params: { phone },
      })
      .then((r) => r.data.data?.available ?? false),

  submit: (data: {
    fullName: string;
    email: string;
    position: string;
    phone?: string;
    coverLetter?: string;
    file: File;
  }) => {
    const form = new FormData();
    form.append('fullName', data.fullName);
    form.append('email', data.email);
    form.append('position', data.position);
    if (data.phone) form.append('phone', data.phone);
    if (data.coverLetter) form.append('coverLetter', data.coverLetter);
    form.append('file', data.file, data.file.name);
    return api.post<ApiResponse<ScientistApplicationItem>>('/scientist-applications', form).then((r) => r.data);
  },

  listMine: (params?: { page?: number; limit?: number }) =>
    api
      .get<ApiResponse<{ total: number; page: number; limit: number; data: ScientistApplicationItem[] }>>(
        '/scientist-applications/mine',
        { params },
      )
      .then((r) => r.data),

  listForReview: (params?: { page?: number; limit?: number }) =>
    api
      .get<ApiResponse<{ total: number; page: number; limit: number; items: ScientistApplicationItem[] }>>(
        '/scientist-applications/for-review',
        { params },
      )
      .then((r) => r.data),

  getOne: (id: number | string) =>
    api.get<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}`).then((r) => r.data),

  labReview: (id: number | string, body: { action: ScientistReviewAction; comment?: string }) =>
    api
      .patch<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/lab-review`, body)
      .then((r) => r.data),

  directorReview: (id: number | string, body: { action: ScientistReviewAction; comment?: string }) =>
    api
      .patch<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/director-review`, body)
      .then((r) => r.data),

  generateContractFromTemplate: (id: number | string, body: ScientistContractGeneratePayload) =>
    api
      .post<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/contract/generate`, body)
      .then((r) => r.data),

  /** Viện trưởng xác nhận hợp đồng → ứng viên thành member */
  confirmContract: (id: number | string) =>
    api
      .post<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/contract/confirm`)
      .then((r) => r.data),

  recordContract: (id: number | string, data: { contractSummary?: string; contractFileUrl?: string; file?: File | null }) => {
    if (data.file) {
      const form = new FormData();
      if (data.contractSummary) form.append('contractSummary', data.contractSummary);
      form.append('file', data.file, data.file.name);
      return api
        .post<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/contract`, form)
        .then((r) => r.data);
    }
    return api
      .post<ApiResponse<ScientistApplicationItem>>(`/scientist-applications/${id}/contract`, {
        contractSummary: data.contractSummary,
        contractFileUrl: data.contractFileUrl,
      })
      .then((r) => r.data);
  },
};
