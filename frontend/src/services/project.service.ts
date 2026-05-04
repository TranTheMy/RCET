import api from '../config/api';
import type {
  AddMemberRequest,
  ActivateProjectRequest,
  AddChecklistItemRequest,
  ApiResponse,
  Checklist,
  ComplianceMatrixRow,
  CreateChecklistRequest,
  CreateMilestoneRequest,
  CreateProjectRequest,
  CreateReportRequest,
  CreateTaskRequest,
  GitRepoInfo,
  Milestone,
  Project,
  ProjectMember,
  ProjectOverview,
  Task,
  MemberWorkloadSummary,
  UpdateChecklistItemRequest,
  UpdateChecklistRequest,
  UpdateGitRepoRequest,
  UpdateMilestoneRequest,
  UpdateProjectRequest,
  UpdateTaskRequest,
  User,
  WeeklyReport,
} from '../types';

/** Backend bọc payload trong `{ success, message, data }` — chỉ lấy `data`. */
function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

export type ProjectListPayload = {
  projects: Project[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export type TaskListPayload = {
  tasks: Task[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export type ReportListPayload = {
  reports: WeeklyReport[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export type MilestoneListPayload = {
  progress: { done: number; total: number };
  milestones: Milestone[];
};

export const projectService = {
  // ======== PROJECTS ========
  list: (params?: { status?: string; tag?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<ProjectListPayload>>('/projects', { params }).then(pickData),

  /** Tổng dự án active (toàn hệ thống) — không cần đăng nhập */
  getPublicActiveCount: () =>
    api.get<ApiResponse<{ total: number }>>('/projects/public/active-count').then(pickData),

  checkCode: (code: string) =>
    api.get<ApiResponse<{ exists: boolean }>>('/projects/check-code', { params: { code } }).then(pickData),

  create: (data: CreateProjectRequest) =>
    api.post<ApiResponse<Project>>('/projects', data).then(pickData),

  getDetail: (id: string) => api.get<ApiResponse<Project>>(`/projects/${id}`).then(pickData),

  update: (id: string, data: UpdateProjectRequest) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, data).then(pickData),

  getOverview: (id: string) =>
    api.get<ApiResponse<ProjectOverview>>(`/projects/${id}/overview`).then(pickData),

  // [MỚI] Member hoặc Leader từ chối tham gia
  rejectProject: (id: string, data: { reason: string }) =>
    api.post<ApiResponse<{ message: string }>>(`/projects/${id}/reject`, data).then(pickData),

  /** TAG: chủ trì dự kiến đã tham gia (MEMBER) → xác nhận nhận vai trò chủ trì */
  acceptLeaderRole: (id: string) =>
    api.post<ApiResponse<{ message: string }>>(`/projects/${id}/accept-leader`).then(pickData),

  /** TAG: từ chối làm chủ trì, vẫn là thành viên */
  declineLeaderRole: (id: string, data?: { reason?: string }) =>
    api.post<ApiResponse<{ message: string }>>(`/projects/${id}/decline-leader`, data || {}).then(pickData),

  // [MỚI] Viện trưởng chỉ định Leader mới khi dự án bị Paused
  assignNewLeader: (id: string, newLeaderId: string) =>
    api.patch<ApiResponse<{ message: string }>>(`/projects/${id}/assign-leader`, { newLeaderId }).then(pickData),

  // ======== TASKS ========
  listTasks: (id: string, params?: { status?: string; priority?: string; assignee_id?: string }) =>
    api
      .get<ApiResponse<TaskListPayload>>(`/projects/${id}/tasks`, { params })
      .then(pickData),

  createTask: (id: string, data: CreateTaskRequest) =>
    api.post<ApiResponse<Task>>(`/projects/${id}/tasks`, data).then(pickData),

  getTask: (id: string, taskId: string) =>
    api.get<ApiResponse<Task>>(`/projects/${id}/tasks/${taskId}`).then(pickData),

  getMemberWorkload: (id: string, userId: string) =>
    api.get<ApiResponse<MemberWorkloadSummary>>(`/projects/${id}/workload/${userId}`).then(pickData),

  updateTask: (id: string, taskId: string, data: UpdateTaskRequest) =>
    api.put<ApiResponse<Task>>(`/projects/${id}/tasks/${taskId}`, data).then(pickData),

  // ======== REPORTS ========
  listReports: (id: string, params?: { week_number?: number; year?: number; user_id?: string }) =>
    api
      .get<ApiResponse<ReportListPayload>>(`/projects/${id}/reports`, { params })
      .then(pickData),

  getCompliance: (id: string, params?: { weeks?: number }) =>
    api
      .get<ApiResponse<ComplianceMatrixRow[]>>(`/projects/${id}/reports/compliance`, { params })
      .then(pickData),

  getReportPreviewBlob: (id: string, reportId: string) =>
    api.get<Blob>(`/projects/${id}/reports/${reportId}/preview`, { responseType: 'blob' }).then((res) => res.data),

  /** Danh sách user active — tìm lead / thành viên (cần đăng nhập) */
  searchActiveUsers: (
    q?: string,
    opts?: { excludeVienTruong?: boolean; partyAOnly?: boolean; checkCapacity?: boolean },
  ) =>
    api
      .get<ApiResponse<User[]>>('/projects/active-users', {
        params: {
          q: q ?? '',
          ...(opts?.excludeVienTruong ? { exclude_vien_truong: '1' } : {}),
          ...(opts?.partyAOnly ? { party_a_only: '1' } : {}),
          ...(opts?.checkCapacity ? { check_capacity: '1' } : {}),
        },
      })
      .then(pickData),

  createReport: (id: string, data: CreateReportRequest) =>
    (() => {
      const form = new FormData();
      form.append('week_number', String(data.week_number));
      form.append('year', String(data.year));
      if (data.content != null) form.append('content', data.content);
      if (data.source_type) form.append('source_type', data.source_type);
      if (data.link_url) form.append('link_url', data.link_url);
      if (data.task_ids && data.task_ids.length > 0) {
        data.task_ids.forEach((taskId) => form.append('task_ids', taskId));
      }
      if (data.file) form.append('file', data.file);
      return api.post<ApiResponse<WeeklyReport>>(`/projects/${id}/reports`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(pickData);
    })(),

  // ======== MEMBERS ========
  listMembers: (id: string, params?: any) =>
    api.get<ApiResponse<ProjectMember>>(`/projects/${id}/members`, { params }).then(pickData),

  addMember: (id: string, data: AddMemberRequest) =>
    api.post<ApiResponse<ProjectMember>>(`/projects/${id}/members`, data).then(pickData),

  removeMember: (id: string, memberId: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/projects/${id}/members/${memberId}`).then(pickData),

  joinProject: (id: string) =>
    api.post<ApiResponse<ProjectMember>>(`/projects/${id}/join`).then(pickData),

  activateProject: (id: string, data?: ActivateProjectRequest) =>
    api.post<ApiResponse<Project>>(`/projects/${id}/activate`, data || {}).then(pickData),

  // ======== MILESTONES ========
  listMilestones: (id: string) =>
    api.get<ApiResponse<MilestoneListPayload>>(`/projects/${id}/milestones`).then(pickData),

  createMilestone: (id: string, data: CreateMilestoneRequest) =>
    api.post<ApiResponse<Milestone>>(`/projects/${id}/milestones`, data).then(pickData),

  updateMilestone: (id: string, milestoneId: string, data: UpdateMilestoneRequest) =>
    api.put<ApiResponse<Milestone>>(`/projects/${id}/milestones/${milestoneId}`, data).then(pickData),

  // ======== CHECKLISTS ========
  listChecklists: (projectId: string, milestoneId: string) =>
    api.get<ApiResponse<{ checklists: Checklist[] }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists`).then(pickData),

  createChecklist: (projectId: string, milestoneId: string, data: CreateChecklistRequest) =>
    api.post<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists`, data).then(pickData),

  getChecklist: (projectId: string, milestoneId: string, checklistId: string) =>
    api.get<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/${checklistId}`).then(pickData),

  updateChecklist: (projectId: string, milestoneId: string, checklistId: string, data: UpdateChecklistRequest) =>
    api.put<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/${checklistId}`, data).then(pickData),

  deleteChecklist: (projectId: string, milestoneId: string, checklistId: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/${checklistId}`).then(pickData),

  updateChecklistItem: (projectId: string, milestoneId: string, itemId: string, data: UpdateChecklistItemRequest) =>
    api.put<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/items/${itemId}`, data).then(pickData),

  addChecklistItem: (projectId: string, milestoneId: string, checklistId: string, data: AddChecklistItemRequest) =>
    api.post<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/${checklistId}/items`, data).then(pickData),

  deleteChecklistItem: (projectId: string, milestoneId: string, itemId: string) =>
    api.delete<ApiResponse<{ checklist: Checklist }>>(`/projects/${projectId}/milestones/${milestoneId}/checklists/items/${itemId}`).then(pickData),

  // ======== GIT REPO ========
  getGitRepo: (id: string) => api.get<ApiResponse<GitRepoInfo>>(`/projects/${id}/git`).then(pickData),

  updateGitRepo: (id: string, data: UpdateGitRepoRequest) =>
    api
      .put<ApiResponse<{ message: string; repo_url?: string }>>(`/projects/${id}/git`, data)
      .then(pickData),

  // ======== COMMITMENTS / EXPORT ========

// [MỚI] Tải file ZIP/DOCX hợp đồng (dành cho Admin)
// Cập nhật: Nhận thêm mảng ids để lọc người được xuất cam kết
exportCommitments: (projectId: string, ids?: string[]) =>
  api.get(`/commitments/projects/${projectId}/export`, {
    responseType: 'blob',
    params: {
      // Nếu có ids thì nối lại thành chuỗi "id1,id2" để gửi lên query string
      ids: ids && ids.length > 0 ? ids.join(',') : undefined
    }
  }).then(res => res.data as Blob),
};