import api from '../config/api';
import type {
  ApiResponse,
  VerilogProblemDetail,
  VerilogProblemsPayload,
  VerilogSubmitResponse,
  VerilogSubmissionDetail,
  VerilogSubmissionsPayload,
  VerilogUserStats,
  VerilogProblem,
  VerilogTestCase,
  CreateVerilogProblemRequest,
  UpdateVerilogProblemRequest,
  CreateVerilogTestCaseRequest,
  UpdateVerilogTestCaseRequest,
} from '../types';

function pickData<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

export const verilogService = {
  listProblems: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
    tag?: string;
  }) =>
    api.get<ApiResponse<VerilogProblemsPayload>>('/verilog/problems', { params }).then(pickData),

  getProblem: (id: string) =>
    api.get<ApiResponse<VerilogProblemDetail>>(`/verilog/problems/${id}`).then(pickData),

  createProblem: (data: CreateVerilogProblemRequest) =>
    api.post<ApiResponse<VerilogProblem>>('/verilog/problems', data).then((r) => r.data),

  updateProblem: (id: string, data: UpdateVerilogProblemRequest) =>
    api.put<ApiResponse<VerilogProblem>>(`/verilog/problems/${id}`, data).then((r) => r.data),

  deleteProblem: (id: string) =>
    api.delete<ApiResponse<void>>(`/verilog/problems/${id}`).then((r) => r.data),

  /** Đọc VKSLAB_SUBTESTS_JSON từ testbench đã lưu DB → tạo/cập nhật testcase + subtest_key */
  syncSubtestsFromTestbench: (problemId: string) =>
    api
      .post<ApiResponse<{ testcases: VerilogTestCase[]; message: string }>>(
        `/verilog/problems/${problemId}/sync-subtests-from-testbench`,
      )
      .then(pickData),

  // ======== TEST CASES ========
  listTestCases: (problemId: string) =>
    api.get<ApiResponse<VerilogTestCase[]>>(`/verilog/problems/${problemId}/testcases`).then((r) => r.data),

  createTestCase: (problemId: string, data: CreateVerilogTestCaseRequest) =>
    api.post<ApiResponse<VerilogTestCase>>(`/verilog/problems/${problemId}/testcases`, data).then((r) => r.data),

  updateTestCase: (problemId: string, testcaseId: string, data: UpdateVerilogTestCaseRequest) =>
    api.put<ApiResponse<VerilogTestCase>>(`/verilog/problems/${problemId}/testcases/${testcaseId}`, data).then((r) => r.data),

  deleteTestCase: (problemId: string, testcaseId: string) =>
    api.delete<ApiResponse<void>>(`/verilog/problems/${problemId}/testcases/${testcaseId}`).then((r) => r.data),

  // ======== TESTBENCH FILE UPLOAD ========
  uploadTestbench: (problemId: string, file: File) => {
    const formData = new FormData();
    formData.append('testbench_file', file);
    return api.post<ApiResponse<{ filename: string; size: number; testbench_type: string }>>(
      `/verilog/problems/${problemId}/upload-testbench`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ).then((r) => r.data);
  },

  // ======== ADMIN: ALL SUBMISSIONS ========
  listAllSubmissions: (params?: {
    page?: number;
    limit?: number;
    problem_id?: string;
    user_id?: string;
    status?: string;
  }) =>
    api.get<ApiResponse<VerilogSubmissionsPayload>>('/verilog/admin/submissions', { params }).then(pickData),

  submit: (body: { problem_id: string; code: string; language?: string }) =>
    api.post<ApiResponse<VerilogSubmitResponse>>('/verilog/submit', body).then(pickData),

  listSubmissions: (params?: {
    page?: number;
    limit?: number;
    problem_id?: string;
    status?: string;
  }) =>
    api.get<ApiResponse<VerilogSubmissionsPayload>>('/verilog/submissions', { params }).then(pickData),

  getSubmission: (id: string) =>
    api.get<ApiResponse<VerilogSubmissionDetail>>(`/verilog/submissions/${id}`).then(pickData),

  getStats: () =>
    api.get<ApiResponse<VerilogUserStats>>('/verilog/stats').then(pickData),
};
