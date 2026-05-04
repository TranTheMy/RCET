// ==================== USER ====================
export interface User {
  id: string;
  full_name: string;
  email: string;
  /** Khi API search active-users kèm check_capacity: member đã có đủ số dự án (planning/active/paused) với tư cách chủ trì hoặc đã vào nhóm — không tính chỉ pending cam kết */
  at_project_limit?: boolean;
  student_code?: string;
  department?: string;
  /** Số điện thoại từ DB (GET /auth/me) */
  phone_number?: string | null;
  avatar?: string | null;
  system_role: SystemRole | null;
  status: UserStatus;
  email_verified: boolean;
  created_at: string;
  updated_at?: string;
}

/** Vai trò tài khoản. Chủ trì dự án: `ProjectRole` + leader_id — không có system_role `leader`. */
export type SystemRole = 'admin' | 'vien_truong' | 'truong_lab' | 'member' | 'user';
export type UserStatus = 'pending' | 'active' | 'rejected' | 'locked';

// ==================== FORUM (/api/forum) ====================
export interface ForumAuthor {
  id: string;
  full_name: string;
  email: string;
  system_role: string | null;
  /** URL ảnh đại diện (đầy đủ hoặc từ profile) */
  avatar?: string | null;
}

export interface ForumPostListItem {
  id: string;
  title: string;
  content: string;
  user_id: string;
  author?: ForumAuthor;
  likes_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ForumListPayload {
  posts: ForumPostListItem[];
  pagination: ForumPagination;
}

export interface ForumCommentItem {
  id: string;
  content: string;
  user_id: string;
  author?: ForumAuthor;
  created_at: string;
  updated_at: string;
}

export interface ForumPostDetail {
  id: string;
  title: string;
  content: string;
  author: ForumAuthor;
  comments: ForumCommentItem[];
  likes_count: number;
  liked_by: string[];
  created_at: string;
  updated_at: string;
}

// ==================== AUTH ====================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  student_code?: string;
  department?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  full_name?: string;
  student_code?: string;
  department?: string;
  phone_number?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ==================== API RESPONSE ====================
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: { field: string; message: string }[];
}

// ==================== MEMBER DASHBOARD (GET /api/members/dashboard) ====================
export interface MemberDashboardPersonal {
  id: string;
  full_name: string;
  email: string;
  student_code?: string | null;
  department?: string | null;
  system_role: string;
  joined_at: string;
}

export interface MemberDashboardProjectTaskStats {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  review?: number;
  overdue: number;
}

export interface MemberDashboardNextMilestone {
  title: string;
  due_date: string;
  done: boolean;
}

export interface MemberDashboardProject {
  id: string;
  name: string;
  code: string;
  role: string;
  joined_at: string;
  tasks: MemberDashboardProjectTaskStats;
  report_rate: number;
  at_risk: boolean;
  next_milestones: MemberDashboardNextMilestone[];
}

export interface MemberDashboardTaskItem {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  project: { id: string; name: string; code: string };
}

export interface MemberDashboardTasks {
  in_progress: MemberDashboardTaskItem[];
  todo: MemberDashboardTaskItem[];
  done_this_week: MemberDashboardTaskItem[];
  overdue: MemberDashboardTaskItem[];
}

export interface MemberDashboardReportHistoryItem {
  week: number;
  year: number;
  status: string;
  submitted_at: string | null;
  due_date: string | null;
}

export interface MemberDashboardReports {
  history: MemberDashboardReportHistoryItem[];
  rate: number;
  streak: number;
  next_due: string | null;
}

export interface MemberDashboardMetrics {
  task_completion_rate: number;
  report_submission_rate: number;
  average_completion_time: number;
  team_ranking: { position: number; total_members: number; percentile: number };
  achievements: string[];
}

export interface MemberDashboardActivity {
  type: string;
  description: string;
  project?: string;
  timestamp: string;
  icon?: string;
}

export interface MemberDashboardData {
  personal: MemberDashboardPersonal;
  projects: MemberDashboardProject[];
  tasks: MemberDashboardTasks;
  reports: MemberDashboardReports;
  metrics: MemberDashboardMetrics;
  activities: MemberDashboardActivity[];
}

export interface PaginatedData<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Hồ sơ CV nhà khoa học (API trả camelCase theo Sequelize) */
export type ScientistApplicationStatus =
  | 'pending_lab_review'
  | 'lab_rejected'
  | 'pending_director_review'
  | 'director_rejected'
  | 'approved';

export interface ScientistApplicationItem {
  id: number;
  userId: string;
  fullName: string;
  email: string;
  position: string;
  phone?: string | null;
  portfolioUrl?: string | null;
  coverLetter?: string | null;
  fileUrl?: string | null;
  status: ScientistApplicationStatus;
  labReviewedBy?: string | null;
  labComment?: string | null;
  labReviewedAt?: string | null;
  directorReviewedBy?: string | null;
  directorComment?: string | null;
  directorReviewedAt?: string | null;
  contractSummary?: string | null;
  contractFileUrl?: string | null;
  contractCreatedAt?: string | null;
  contractCreatedBy?: string | null;
  contractConfirmedAt?: string | null;
  contractConfirmedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== NOTIFICATIONS ====================
export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface NotificationListData {
  items: NotificationItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UnreadCountData {
  unread_count: number;
}

// ==================== PROJECT ====================
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done' | 'archived';
export type ProjectTag = 'AI/ML' | 'FPGA' | 'Robotics' | 'Embedded' | 'DSP' | 'IoT' | 'Other';

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  tag?: ProjectTag;
  status: ProjectStatus;
  leader_id?: string | null;
  start_date: string;
  end_date: string;
  budget?: number;
  git_repo_url?: string;
  git_provider?: GitProvider;
  git_default_branch?: string;
  git_visibility?: GitVisibility;
  git_last_commit_sha?: string;
  git_last_commit_author?: string;
  git_last_commit_message?: string;
  git_last_commit_date?: string;
  created_at: string;
  updated_at: string;
  // Included associations
  leader?: User;
  members?: ProjectMember[];
  commitments?: Commitment[];
  // Computed fields from API
  member_count?: number;
  task_progress?: { done: number; total: number };
  report_rate?: number;
  at_risk?: boolean;
  is_joined?: boolean;
  /** Matrix: member có lời mời cam kết chờ xác nhận (chưa vào ProjectMember) */
  pending_commitment_invite?: boolean;
  /** Bản ghi ProjectMember của user đang xem (chi tiết dự án) */
  viewer_membership?: { id: string; role: ProjectRole } | null;
  /** TAG: chủ trì chưa được chỉ định sau khi từ chối / rút */
  awaiting_leader_assignment?: boolean;
  /** SELF_JOIN: số thành viên cần để đóng slot tự join */
  required_members?: number | null;
}

export interface TaskSummary {
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  total: number;
}

export interface CreateProjectRequest {
  code: string;
  name: string;
  description?: string;
  tag?: ProjectTag;
  status?: ProjectStatus;
  leader_id: string;
  start_date: string;
  end_date: string;
  budget?: number;
  members?: string[];
  git_repo_url?: string;
  model_type?: string;
  party_a_id?: string;
  party_b_id?: string;
  party_a_percent?: number;
  party_b_percent?: number;
}

export interface ActivateProjectRequest {
  leader_id?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  tag?: ProjectTag;
  status?: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

// ==================== COMMITMENT ====================
export type CommitmentStatus =
  | 'pending_a_approval'
  | 'a_approved'
  | 'a_rejected'
  | 'pending_b_approval'
  | 'b_approved'
  | 'b_rejected'
  | 'active'
  | 'terminated';

export interface Commitment {
  id: string;
  project_id: string;
  user_id: string;
  status: CommitmentStatus;
  reject_reason?: string;
  hardcopy_filed_at?: string;
  created_at: string;
  updated_at: string;
  user?: User; // Có thể include để lấy thông tin người dùng
}

// ==================== PROJECT MEMBER ====================
export type ProjectRole = 'leader' | 'member';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  joined_at: string;
  user?: User;
  // Computed
  task_count?: number;
  report_rate?: number;
}

export interface AddMemberRequest {
  user_id: string;
  role?: ProjectRole;
}

export type ProjectMemberListResponse = {
  members: ProjectMember[];
  total: number;
  page: number;
  limit: number;
};

// ==================== TASK ====================
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  created_by: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  assignee?: User;
  creator?: User;
}

export interface MemberWorkloadSummary {
  active_projects: number;
  open_tasks: number;
  overdue_tasks: number;
  limits: {
    max_open_tasks: number;
    warn_active_projects: number;
    warn_overdue_tasks: number;
  };
  exceeds_open_task_limit: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: string;
}

// ==================== MILESTONE ====================
export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  due_date: string;
  done: boolean;
  done_at?: string;
  created_at: string;
  updated_at: string;
  linkedTasks?: Task[];
  checklists?: Checklist[];
  /** Backend gắn khi liệt kê milestone (UI timeline) */
  color?: string;
  /** Backend khi đánh dấu done còn task chưa xong */
  warning?: string;
}

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  due_date: string;
  /** Khớp backend Joi `linked_tasks` (UUID task) */
  linked_tasks?: string[];
}

export interface UpdateMilestoneRequest {
  title?: string;
  description?: string;
  due_date?: string;
  done?: boolean;
  linked_tasks?: string[];
}

// ==================== CHECKLIST ====================

export type ChecklistCategory = 'hardware' | 'software' | 'integration' | 'testing';

export type ChecklistItemStatus = 'pending' | 'pass' | 'fail' | 'na';

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  description?: string;
  expected_value?: string;
  actual_value?: string;
  status: ChecklistItemStatus;
  notes?: string;
  order_index: number;
  checked_at?: string;
  checked_by?: {
    id: string;
    full_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Checklist {
  id: string;
  milestone_id: string;
  title: string;
  category: ChecklistCategory;
  description?: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: {
    id: string;
    full_name: string;
  };
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateChecklistRequest {
  title: string;
  category?: ChecklistCategory;
  description?: string;
  items?: {
    title: string;
    description?: string;
    expected_value?: string;
  }[];
}

export interface UpdateChecklistRequest {
  title?: string;
  category?: ChecklistCategory;
  description?: string;
}

export interface UpdateChecklistItemRequest {
  actual_value?: string;
  status: ChecklistItemStatus;
  notes?: string;
}

export interface AddChecklistItemRequest {
  title: string;
  description?: string;
  expected_value?: string;
}

// ==================== WEEKLY REPORT ====================
export type ReportStatus = 'submitted' | 'late' | 'missing';

export interface WeeklyReport {
  id: string;
  project_id: string;
  user_id: string;
  week_number: number;
  year: number;
  content?: string;
  source_type?: 'text' | 'upload' | 'link';
  file_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  link_url?: string | null;
  selected_tasks?: { id: string; title: string }[];
  status: ReportStatus;
  submitted_at?: string;
  due_date: string;
  created_at: string;
  user?: User;
}

export interface CreateReportRequest {
  week_number: number;
  year: number;
  content?: string;
  source_type?: 'text' | 'upload' | 'link';
  link_url?: string;
  file?: File;
  task_ids?: string[];
}

/** Comment trên báo cáo tuần — bảng `Comments`, API `/api/:weeklyReportId/comments` */
export interface WeeklyReportComment {
  id: string;
  weekly_report_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

/** Ma trận tuân thủ — khớp `GET .../reports/compliance` (mảng theo thành viên) */
export interface ComplianceMatrixRow {
  user: User;
  weeks: { week_number: number; year: number; status: string }[];
}

// ==================== GIT REPO ====================
export type GitProvider = 'github' | 'gitlab' | 'bitbucket';
export type GitVisibility = 'private' | 'public' | 'internal';

export interface GitRepoInfo {
  repo_url?: string;
  provider?: GitProvider;
  default_branch?: string;
  visibility?: GitVisibility;
  last_commit?: {
    sha: string;
    author: string;
    message: string;
    date: string;
  };
}

export interface UpdateGitRepoRequest {
  git_repo_url: string;
  git_provider: GitProvider;
  git_default_branch?: string;
  git_visibility?: GitVisibility;
}

// ==================== PROJECT OVERVIEW ====================
export interface ProjectOverview {
  // Spread of Project fields + enriched data
  task_counts: Record<string, number>;
  report_chart: { week_number: number; year: number; status: string }[];
  nearest_milestones: Milestone[];
  members_preview: { total: number; members: User[] };
}

// ==================== APPROVAL ====================
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  user_id: string;
  status: ApprovalStatus;
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  updated_at: string;
  user?: User;
  reviewer?: User;
}

// ==================== RESEARCH ====================
export type ResearchStatus = 'pending' | 'approved' | 'rejected';
export type ResearchSourceType = 'upload' | 'link';
export type ResearchImpactRank = 'No Rank' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ResearchItem {
  id: string;
  title: string;
  authors: string;
  published_date: string;
  journal: string;
  volume: number;
  issue: number;
  pages: string;
  publisher: string;
  description: string;
  total_citations: number;
  pdf_url?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  source_type: ResearchSourceType;
  impact_rank: ResearchImpactRank;
  is_peer_reviewed: boolean;
  is_open_access: boolean;
  doi: string;
  created_by: string;
  status: ResearchStatus;
  is_public?: boolean;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
  /** Soft-delete — có khi include_deleted hoặc viện trưởng xem thu hồi */
  deleted_at?: string | null;
  /** Từ khóa / nhãn (phân loại, tìm kiếm) */
  tags?: string[];
}

/** Meta phân trang khi gọi GET /research/public|internal với `limit`. */
export interface ResearchListPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ResearchListPayload = {
  items: ResearchItem[];
  pagination?: ResearchListPaginationMeta;
};

export interface ResearchListQueryParams {
  page?: number;
  limit?: number;
  q?: string;
  tags?: string[];
  impact_ranks?: ResearchImpactRank[];
  peer_reviewed?: 'all' | 'yes' | 'no';
  open_access?: 'all' | 'yes' | 'no';
  source_type?: 'all' | 'upload' | 'link';
  readonly_highlight?: boolean;
  /** Lọc kho DB: có file tải / chỉ tham khảo link. */
  segment?: 'downloadable' | 'readonly';
}

export interface ResearchSubmitRequest {
  title: string;
  authors: string;
  published_date: string;
  journal: string;
  volume: number;
  issue: number;
  pages: string;
  publisher: string;
  description: string;
  total_citations?: number;
  source_type: ResearchSourceType;
  pdf_url?: string;
  impact_rank: ResearchImpactRank;
  is_peer_reviewed?: boolean;
  is_open_access?: boolean;
  doi: string;
  file?: File;
  /** Nhãn tùy chọn — gửi dạng mảng, backend lưu JSON */
  tags?: string[];
  /** Viện trưởng: tự duyệt, có thể bật hiển thị trên trang công khai */
  is_public?: boolean;
}

// ==================== CATEGORY ====================
export interface Category {
  id: string;
  name: string;
  description?: string | null;
}

// ==================== CURRICULUM (BOOKS) — workflow giống Document ====================
export type CurriculumStatus =
  | 'draft'
  | 'pending'
  | 'revision'
  | 'approved'
  | 'archived'
  | 'rejected';
export type CurriculumSourceType = 'upload' | 'link';

export interface CurriculumItem {
  id: string;
  title: string;
  category_id: string;
  category?: { id: string; name: string };
  description?: string | null;
  authors?: string | null;

  pdf_url?: string | null;
  file_path?: string | null;
  source_type: CurriculumSourceType;

  status: CurriculumStatus;
  version_group_id?: string | null;
  version_number?: number;
  parent_curriculum_id?: string | null;
  is_latest?: boolean;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;

  created_by: string;
  created_at: string;
  updated_at?: string;

  creator?: { id: string; full_name: string; system_role: SystemRole | null; email?: string };
  reviewer?: { id: string; full_name: string; system_role: SystemRole | null };
}

export interface CurriculumCreateRequest {
  title: string;
  category_id?: string;
  category?: string;
  description?: string | null;
  pdf_url?: string;
  file?: File;
  authors?: string;
}

/** Phân trang list công khai (documents, curriculum, …). */
export interface PaginatedListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type CurriculumListPayload = {
  items: CurriculumItem[];
  pagination?: PaginatedListMeta;
};

export interface CurriculumListQueryParams {
  category_id?: string;
  q?: string;
  source_type?: 'upload' | 'link';
  sort?: 'newest' | 'oldest' | 'title';
  page?: number;
  limit?: number;
}

// ==================== DOCUMENTS (BOOKS) ====================
export type DocumentStatus = 'draft' | 'pending' | 'revision' | 'published' | 'archived' | 'rejected';
export type DocumentSourceType = 'upload' | 'link';
export type DocumentType = 'datasheet' | 'manual' | 'schematic';

export interface DocumentItem {
  id: string;
  title: string;
  description?: string | null;
  category_id: string;
  category?: { id: string; name: string };

  doc_type?: DocumentType | null;
  manufacturer?: string | null;
  technical_metadata?: unknown;

  pdf_url?: string | null;
  file_path?: string | null;
  source_type: DocumentSourceType;

  status: DocumentStatus;
  checksum_sha256?: string | null;
  version_group_id?: string | null;
  version_number?: number;
  parent_document_id?: string | null;
  is_latest?: boolean;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
  published_at?: string | null;
  archived_at?: string | null;

  created_by: string;
  created_at: string;
  updated_at?: string;

  creator?: { id: string; full_name: string; system_role: SystemRole | null; email?: string };
  reviewer?: { id: string; full_name: string; system_role: SystemRole | null };
}

export type DocumentListPayload = {
  items: DocumentItem[];
  pagination?: PaginatedListMeta;
};

export interface DocumentListQueryParams {
  category_id?: string;
  q?: string;
  doc_type?: string;
  sort?: 'newest' | 'oldest' | 'title';
  page?: number;
  limit?: number;
}

export interface DocumentCreateRequest {
  title: string;
  description?: string | null;
  /** Một trong hai: category_id hoặc category (tên — backend findOrCreate) */
  category_id?: string;
  category?: string;
  doc_type?: DocumentType | null;
  manufacturer?: string | null;
  technical_metadata?: unknown;
  pdf_url?: string;
  file?: File;
}

// ==================== VERILOG (/api/verilog) ====================
export type VerilogLevel = 'easy' | 'medium' | 'hard';
export type VerilogUserProblemStatus = 'not_attempted' | 'attempted' | 'accepted';

export interface VerilogPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VerilogProblemListItem {
  id: string;
  logic_id: number;
  name: string;
  level: VerilogLevel;
  tags: string[];
  total_grade: number;
  testcase_count: number;
  submitted_users: number;
  ac_users: number;
  created_at: string;
  user_status?: VerilogUserProblemStatus;
  owner?: { id: string; full_name: string };
}

export interface VerilogProblemsPayload {
  problems: VerilogProblemListItem[];
  pagination: VerilogPagination;
}

export interface VerilogTestCasePublic {
  id: string;
  name: string;
  grade: number;
  order_index: number;
}

export interface VerilogProblemDetail {
  id: string;
  logic_id: number;
  name: string;
  description: string | null;
  description_input: string | null;
  description_output: string | null;
  level: VerilogLevel;
  tags: string[];
  template_code: string | null;
  testbench_type?: string;
  /** Chỉ khi gọi API với quyền admin */
  testbench?: string | null;
  deadline: string | null;
  is_published: boolean;
  created_at: string;
  testcases?: VerilogTestCasePublic[];
  owner?: { id: string; full_name: string };
}

export interface VerilogSubmitResponse {
  id: string;
  status: string;
  message: string;
}

export type VerilogSubmissionStatus = 'PENDING' | 'JUDGING' | 'DONE' | 'ERROR';
export type VerilogFailureCode = 'CE' | 'RLE' | 'TLE' | 'WA' | 'NONE' | 'NA';

export interface VerilogSubmissionResultItem {
  id: string;
  testcase_id: string;
  status: VerilogSubmissionStatus;
  possible_failure: VerilogFailureCode;
  grade: number;
  log: string | null;
  testcase?: { id: string; name: string; grade: number; order_index: number };
}

export interface VerilogSubmissionDetail {
  id: string;
  problem_id: string;
  user_id: string;
  code: string;
  language: string;
  status: VerilogSubmissionStatus;
  total_grade: number;
  max_grade: number;
  passed_count: number;
  total_count: number;
  overall_failure: VerilogFailureCode;
  judge_log: string | null;
  judge_method: string | null;
  created_at: string;
  problem?: { id: string; name: string; level: VerilogLevel };
  user?: { id: string; full_name: string };
  results?: VerilogSubmissionResultItem[];
}

export interface VerilogSubmissionListItem {
  id: string;
  problem_id: string;
  user_id: string;
  language: string;
  status: VerilogSubmissionStatus;
  total_grade: number;
  max_grade: number;
  passed_count: number;
  total_count: number;
  overall_failure: VerilogFailureCode;
  created_at: string;
  problem?: { id: string; name: string; level: VerilogLevel };
  user?: { id: string; full_name: string };
}

export interface VerilogSubmissionsPayload {
  submissions: VerilogSubmissionListItem[];
  pagination: VerilogPagination;
}

export interface VerilogUserStats {
  submitted_problems: number;
  accepted_problems: number;
  total_score: number;
}

/* ================================================================== */
/*  Admin / CRUD types for Verilog Management                          */
/* ================================================================== */

export type VerilogTestbenchType = 'auto_generated' | 'custom_uploaded';
export type VerilogTestCaseType = 'SIM' | 'SYNTHSIM';
export type VerilogFailureType = 'CE' | 'RLE' | 'TLE' | 'WA' | 'NONE' | 'NA';
export type VerilogResultStatus = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'ERROR';

export interface VerilogProblem {
  id: string;
  logic_id: number;
  name: string;
  description?: string;
  description_input?: string;
  description_output?: string;
  level: VerilogLevel;
  tags: string[];
  template_code?: string;
  testbench_type: VerilogTestbenchType;
  owner_id: string;
  deadline?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  total_grade?: number;
  testcase_count?: number;
  submitted_users?: number;
  ac_users?: number;
  user_status?: 'accepted' | 'attempted';
}

export interface VerilogTestCase {
  id: string;
  problem_id: string;
  name: string;
  type: VerilogTestCaseType;
  grade: number;
  input?: string;
  expected_output?: string;
  testbench_code?: string;
  expected_vcd?: string;
  time_limit: number;
  mem_limit: number;
  order_index: number;
  /** Khớp với trường `id` trong block VKSLAB_SUBTESTS_JSON — chấm một lần sim, chia điểm */
  subtest_key?: string | null;
  synced_from_tb?: boolean;
}

export interface VerilogSubmission {
  id: string;
  problem_id: string;
  user_id: string;
  code: string;
  language: string;
  status: VerilogSubmissionStatus;
  total_grade: number;
  max_grade: number;
  passed_count: number;
  total_count: number;
  overall_failure: VerilogFailureType;
  judge_log?: string;
  judge_method?: string;
  created_at: string;
  updated_at: string;
  problem?: VerilogProblem;
  results?: VerilogSubmissionResult[];
}

export interface VerilogSubmissionResult {
  id: string;
  submission_id: string;
  testcase_id: string;
  status: VerilogResultStatus;
  possible_failure: VerilogFailureType;
  grade: number;
  log?: string;
  app_data?: Record<string, unknown>;
  testcase?: VerilogTestCase;
}

export interface CreateVerilogProblemRequest {
  name: string;
  description?: string;
  description_input?: string;
  description_output?: string;
  level?: VerilogLevel;
  tags?: string[];
  template_code?: string;
  testbench?: string;
  testbench_type?: VerilogTestbenchType;
  deadline?: string;
  is_published?: boolean;
}

export type UpdateVerilogProblemRequest = Partial<CreateVerilogProblemRequest>;

export interface CreateVerilogTestCaseRequest {
  name: string;
  type?: VerilogTestCaseType;
  grade?: number;
  input?: string;
  expected_output?: string;
  testbench_code?: string;
  expected_vcd?: string;
  time_limit?: number;
  mem_limit?: number;
  order_index?: number;
}

export type UpdateVerilogTestCaseRequest = Partial<CreateVerilogTestCaseRequest>;

export interface SubmitVerilogCodeRequest {
  code: string;
  language?: 'verilog' | 'systemverilog';
}