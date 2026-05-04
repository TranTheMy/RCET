import api from '../config/api';
import type { ApiResponse } from '../types';

function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

export type RewardSheetUser = {
  full_name: string;
  email: string;
  system_role: string;
};

export type RewardSheetDetailRow = {
  id: string;
  sheet_id?: string;
  user_id: string;
  role: string;
  model_type: number | null;
  base_share: string | number;
  model_cut_amount: string | number;
  report_grade: string | null;
  grade_multiplier: string | number;
  late_task_count: number;
  penalty_amount: string | number;
  calculated_amount: string | number;
  final_override_amount: string | number | null;
  is_overridden: boolean;
  appeal_status: string;
  appeal_reason?: string | null;
  penalty_metadata?: string | null;
  user?: RewardSheetUser;
};

export type RewardSheetData = {
  id: string;
  project_id: string;
  total_budget: string | number;
  status: string;
  generated_by: string;
  finalized_by?: string | null;
  finalized_at?: string | null;
  created_at?: string;
  updated_at?: string;
  details: RewardSheetDetailRow[];
};

export type FinalizeSummary = {
  total_budget: number;
  total_payout: number;
  budget_saved: number;
};

export type RewardSheetFinalizeResponse = RewardSheetData & {
  summary?: FinalizeSummary;
};

export function parseExportFilename(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null;
  const utf = /filename\*=UTF-8''([^;\n]+)/i.exec(contentDisposition);
  if (utf?.[1]) return decodeURIComponent(utf[1].trim());
  const plain = /filename="([^"]+)"/i.exec(contentDisposition);
  if (plain?.[1]) return plain[1].trim();
  const loose = /filename=([^;\n]+)/i.exec(contentDisposition);
  return loose ? loose[1].replace(/"/g, '').trim() : null;
}

export const rewardService = {
  getByProject: (projectId: string) =>
    api.get<ApiResponse<RewardSheetData>>(`/rewards/project/${projectId}`).then(pickData),

  recalculate: (projectId: string) =>
    api.post<ApiResponse<RewardSheetData>>(`/rewards/project/${projectId}/recalculate`).then(pickData),

  updateOverride: (detailId: string, final_override_amount: number | null) =>
    api
      .put<ApiResponse<RewardSheetDetailRow>>(`/rewards/detail/${detailId}/override`, {
        final_override_amount,
      })
      .then(pickData),

  finalize: (projectId: string) =>
    api.post<ApiResponse<RewardSheetFinalizeResponse>>(`/rewards/project/${projectId}/finalize`).then(pickData),

  appeal: (detailId: string, reason: string) =>
    api.post<ApiResponse<RewardSheetDetailRow>>(`/rewards/detail/${detailId}/appeal`, { reason }).then(pickData),

  resolveAppeal: (detailId: string, resolutionStatus: 'RESOLVED' | 'REJECTED') =>
    api
      .put<ApiResponse<RewardSheetDetailRow>>(`/rewards/detail/${detailId}/resolve-appeal`, {
        resolutionStatus,
      })
      .then(pickData),

  exportExcel: (projectId: string) =>
    api.get<Blob>(`/rewards/project/${projectId}/export`, { responseType: 'blob' }),

  importExcel: (projectId: string, file: File) => {
    const fd = new FormData();
    fd.append('excel_file', file);
    return api
      .post<ApiResponse<{ successCount: number }>>(`/rewards/project/${projectId}/import`, fd)
      .then(pickData);
  },
};
