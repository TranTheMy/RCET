const verilogService = require('../services/verilog.service');
const judgeService = require('../services/verilog.judge');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/* ================================================================== */
/*  PROBLEMS                                                           */
/* ================================================================== */

exports.listProblems = async (req, res) => {
  try {
    const query = { ...req.query };
    // Non-admin users can only see published problems
    if (!req.user || !['admin', 'truong_lab', 'vien_truong'].includes(req.user.system_role)) {
      query.is_published = 'true';
    }
    const result = await verilogService.listProblems(query);

    // If user is logged in, attach their problem statuses
    if (req.user) {
      const statuses = await verilogService.getUserProblemStatuses(req.user.id);
      result.problems = result.problems.map((p) => ({
        ...p,
        user_status: statuses[p.id] || 'not_attempted',
      }));
    }

    return ApiResponse.success(res, result);
  } catch (err) {
    logger.error('listProblems:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.getProblem = async (req, res) => {
  try {
    const problem = await verilogService.getProblemById(req.params.id);
    if (!problem) return ApiResponse.notFound(res, 'Problem not found');

    const json = problem.toJSON();

    // Hide testbench content for non-admin users
    if (!req.user || !['admin', 'truong_lab', 'vien_truong'].includes(req.user.system_role)) {
      delete json.testbench;
      if (json.testcases) {
        json.testcases = json.testcases.map((tc) => ({
          id: tc.id,
          name: tc.name,
          grade: tc.grade,
          order_index: tc.order_index,
          // Hide input/expected_output for non-admins to prevent cheating
        }));
      }
    }

    return ApiResponse.success(res, json);
  } catch (err) {
    logger.error('getProblem:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.createProblem = async (req, res) => {
  try {
    const data = { ...req.body, owner_id: req.user.id };
    const problem = await verilogService.createProblem(data);
    return ApiResponse.created(res, problem);
  } catch (err) {
    logger.error('createProblem:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.updateProblem = async (req, res) => {
  try {
    const problem = await verilogService.updateProblem(req.params.id, req.body);
    if (!problem) return ApiResponse.notFound(res, 'Problem not found');
    return ApiResponse.success(res, problem);
  } catch (err) {
    logger.error('updateProblem:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.syncSubtestsFromTestbench = async (req, res) => {
  try {
    const testcases = await verilogService.syncSubtestsFromTestbench(req.params.id);
    return ApiResponse.success(res, {
      testcases,
      message:
        'Đã đồng bộ testcase từ block VKSLAB_SUBTESTS_JSON trong testbench. Sinh viên nộp bài sẽ chấm một lần sim và chia điểm theo dòng VKSLAB_SUBTEST.',
    });
  } catch (err) {
    logger.error('syncSubtestsFromTestbench:', err);
    return ApiResponse.error(res, err.message || 'Sync failed');
  }
};

exports.deleteProblem = async (req, res) => {
  try {
    const ok = await verilogService.deleteProblem(req.params.id);
    if (!ok) return ApiResponse.notFound(res, 'Problem not found');
    return ApiResponse.success(res, null, 'Problem deleted');
  } catch (err) {
    logger.error('deleteProblem:', err);
    return ApiResponse.error(res, err.message);
  }
};

/* ================================================================== */
/*  TEST CASES                                                         */
/* ================================================================== */

exports.listTestCases = async (req, res) => {
  try {
    const tcs = await verilogService.listTestCases(req.params.problemId);
    return ApiResponse.success(res, tcs);
  } catch (err) {
    logger.error('listTestCases:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.createTestCase = async (req, res) => {
  try {
    const data = { ...req.body, problem_id: req.params.problemId };
    const tc = await verilogService.createTestCase(data);
    return ApiResponse.created(res, tc);
  } catch (err) {
    logger.error('createTestCase:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.updateTestCase = async (req, res) => {
  try {
    const tc = await verilogService.updateTestCase(req.params.tcId, req.body);
    if (!tc) return ApiResponse.notFound(res, 'Test case not found');
    return ApiResponse.success(res, tc);
  } catch (err) {
    logger.error('updateTestCase:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.deleteTestCase = async (req, res) => {
  try {
    const ok = await verilogService.deleteTestCase(req.params.tcId);
    if (!ok) return ApiResponse.notFound(res, 'Test case not found');
    return ApiResponse.success(res, null, 'Test case deleted');
  } catch (err) {
    logger.error('deleteTestCase:', err);
    return ApiResponse.error(res, err.message);
  }
};

/* ================================================================== */
/*  SUBMISSIONS                                                        */
/* ================================================================== */

exports.listSubmissions = async (req, res) => {
  try {
    // Non-admin users only see their own submissions
    const filters = { ...req.query };
    if (req.user && !['admin', 'truong_lab', 'vien_truong'].includes(req.user.system_role)) {
      filters.user_id = req.user.id;
    }
    const result = await verilogService.listSubmissions(filters);
    return ApiResponse.success(res, result);
  } catch (err) {
    logger.error('listSubmissions:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.listAllSubmissions = async (req, res) => {
  try {
    const filters = { ...req.query };
    // Admin endpoint — no user_id filter forced
    const result = await verilogService.listSubmissions(filters);
    return ApiResponse.success(res, result);
  } catch (err) {
    logger.error('listAllSubmissions:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.getSubmission = async (req, res) => {
  try {
    const submission = await verilogService.getSubmissionById(req.params.id);
    if (!submission) return ApiResponse.notFound(res, 'Submission not found');

    // Only owner or admin can view
    if (
      req.user.id !== submission.user_id &&
      !['admin', 'truong_lab', 'vien_truong'].includes(req.user.system_role)
    ) {
      return ApiResponse.forbidden(res);
    }

    return ApiResponse.success(res, submission);
  } catch (err) {
    logger.error('getSubmission:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.submit = async (req, res) => {
  try {
    const { problem_id, code, language } = req.body;

    if (!problem_id || !code) {
      return ApiResponse.badRequest(res, 'problem_id and code are required');
    }

    // Check problem exists
    const problem = await verilogService.getProblemById(problem_id);
    if (!problem) return ApiResponse.notFound(res, 'Problem not found');

    // Check deadline
    if (problem.deadline && new Date(problem.deadline) < new Date()) {
      return ApiResponse.badRequest(res, 'Submission deadline has passed');
    }

    // Calculate max grade
    const testcases = problem.testcases || [];
    const maxGrade = testcases.reduce((s, t) => s + t.grade, 0);

    // Create submission
    const submission = await verilogService.createSubmission({
      problem_id,
      user_id: req.user.id,
      code,
      language: language || 'verilog',
      status: 'PENDING',
      total_count: testcases.length,
      max_grade: maxGrade,
    });

    // Trigger async judging
    const judge = judgeService.getInstance();
    judge.judgeSubmission(submission.id).catch(async (err) => {
      logger.error('Background judging error:', err);
      try {
        await verilogService.updateSubmission(submission.id, {
          status: 'ERROR',
          overall_failure: 'RLE',
        });
      } catch (updateErr) {
        logger.error('Failed to update submission status to ERROR:', updateErr);
      }
    });

    return ApiResponse.created(res, {
      id: submission.id,
      status: 'PENDING',
      message: 'Submission queued for evaluation',
    });
  } catch (err) {
    logger.error('submit:', err);
    return ApiResponse.error(res, err.message);
  }
};

/* ================================================================== */
/*  UPLOAD TESTBENCH FILE                                              */
/* ================================================================== */

exports.uploadTestbench = async (req, res) => {
  try {
    if (!req.file) {
      return ApiResponse.badRequest(res, 'Vui lòng chọn file testbench');
    }

    const problemId = req.params.id;
    const problem = await verilogService.getProblemById(problemId);
    if (!problem) return ApiResponse.notFound(res, 'Không tìm thấy bài tập');

    // Read file content
    const filePath = req.file.path;
    const content = fs.readFileSync(filePath, 'utf8');

    // Update problem with testbench content and set type to custom_uploaded
    await verilogService.updateProblem(problemId, {
      testbench: content,
      testbench_type: 'custom_uploaded',
    });

    // Also copy to testbenches directory with problem name
    const safeName = problem.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const destPath = path.join(__dirname, '../testbenches', `${safeName}_tb.v`);
    fs.copyFileSync(filePath, destPath);

    return ApiResponse.success(res, {
      filename: req.file.originalname,
      size: req.file.size,
      testbench_type: 'custom_uploaded',
    }, 'Đã tải lên testbench thành công');
  } catch (err) {
    logger.error('uploadTestbench:', err);
    return ApiResponse.error(res, err.message);
  }
};

/* ================================================================== */
/*  USER STATS                                                         */
/* ================================================================== */

exports.getUserStats = async (req, res) => {
  try {
    // Non-admin users can only see their own stats
    let userId = req.params.userId || req.user.id;
    if (
      req.params.userId &&
      req.params.userId !== req.user.id &&
      !['admin', 'truong_lab', 'vien_truong'].includes(req.user.system_role)
    ) {
      return ApiResponse.forbidden(res);
    }
    const stats = await verilogService.getUserStats(userId);
    return ApiResponse.success(res, stats);
  } catch (err) {
    logger.error('getUserStats:', err);
    return ApiResponse.error(res, err.message);
  }
};
