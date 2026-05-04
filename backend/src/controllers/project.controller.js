const projectService = require('../services/project.service');
const ApiResponse = require('../utils/response');
const realtimeService = require('../services/realtime.service');

// ======== Projects ========

const listProjects = async (req, res, next) => {
  try {
    const { status, tag, page, limit } = req.query;
    const result = await projectService.listProjects(
      { status, tag, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 20 },
      req.user,
    );
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const countActiveProjectsPublic = async (req, res, next) => {
  try {
    const result = await projectService.countActiveProjectsPublic();
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const checkCode = async (req, res, next) => {
  try {
    const code = req.query.code;
    if (!code || typeof code !== 'string') {
      return ApiResponse.badRequest(res, 'Query parameter "code" is required');
    }
    const result = await projectService.checkCodeExists(code);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const result = await projectService.createProject(req.body, req.user.id);

    realtimeService.broadcastProjectsUpdate('project_created', {
      project: result,
      createdBy: req.user.id,
    });
    realtimeService.broadcastProjectUpdate(result.id, 'commitment_updated', {
      source: 'project_created',
    });

    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getProjectDetail = async (req, res, next) => {
  try {
    const result = await projectService.getProjectDetail(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const result = await projectService.updateProject(req.params.id, req.body, req.user);

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'project_updated', {
      project: result
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getProjectOverview = async (req, res, next) => {
  try {
    const result = await projectService.getProjectOverview(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// ======== Tasks ========

const listTasks = async (req, res, next) => {
  try {
    const { assignee_id, priority, status, page, limit } = req.query;
    const result = await projectService.listTasks(
      req.params.id,
      { assignee_id, priority, status, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 50 },
      req.user,
    );
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const createTask = async (req, res, next) => {
  try {
    const result = await projectService.createTask(req.params.id, req.body, req.user);

    // Broadcast realtime update to project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'task_created', {
      task: result,
      createdBy: req.user.id
    });

    // Notify assignee if different from creator
    if (result.assignee_id && result.assignee_id !== req.user.id) {
      realtimeService.sendNotification(result.assignee_id, {
        title: 'New Task Assigned',
        message: `You have been assigned to task: ${result.title}`,
        type: 'task_assigned',
        data: { taskId: result.id, projectId: req.params.id }
      });
    }

    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const result = await projectService.updateTask(req.params.id, req.params.taskId, req.body, req.user);

    // Broadcast realtime update to project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'task_updated', {
      task: result,
      updatedBy: req.user.id
    });

    // Notify assignee if status changed or reassigned
    if (result.assignee_id && result.assignee_id !== req.user.id) {
      const notificationType = req.body.status ? 'task_status_changed' : 'task_updated';
      const message = req.body.status
        ? `Task "${result.title}" status changed to ${result.status}`
        : `Task "${result.title}" has been updated`;

      realtimeService.sendNotification(result.assignee_id, {
        title: 'Task Updated',
        message: message,
        type: notificationType,
        data: { taskId: result.id, projectId: req.params.id }
      });
    }

    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getTaskDetail = async (req, res, next) => {
  try {
    const result = await projectService.getTaskDetail(req.params.id, req.params.taskId, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getMemberWorkload = async (req, res, next) => {
  try {
    const result = await projectService.getMemberWorkload(req.params.id, req.params.userId, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// ======== Members ========

const listMembers = async (req, res, next) => {
  try {
    const result = await projectService.listMembers(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const addMember = async (req, res, next) => {
  try {
    const result = await projectService.addMember(req.params.id, req.body, req.user);

    if (result && result.alreadyInvited) {
      realtimeService.broadcastProjectUpdate(req.params.id, 'commitment_updated', {
        source: 'invite_resend',
        userId: req.body.user_id,
        commitmentId: result.id,
      });
      return ApiResponse.success(
        res,
        result,
        result.message || 'Đã làm mới thông báo mời.',
      );
    }

    realtimeService.broadcastProjectUpdate(req.params.id, 'member_added', {
      member: result,
    });

    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const result = await projectService.removeMember(req.params.id, req.params.memberId, req.user);

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'member_removed', {
      removedMemberId: req.params.memberId,
      removedBy: req.user.id
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const activateProject = async (req, res, next) => {
  try {
    const result = await projectService.activateProject(req.params.id, req.body || {}, req.user);
    realtimeService.broadcastProjectUpdate(req.params.id, 'project_activated', {
      project: result,
      activatedBy: req.user.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// ======== Milestones ========

const listMilestones = async (req, res, next) => {
  try {
    const result = await projectService.listMilestones(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const createMilestone = async (req, res, next) => {
  try {
    const result = await projectService.createMilestone(req.params.id, req.body, req.user);

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'milestone_created', {
      milestone: result
    });

    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const updateMilestone = async (req, res, next) => {
  try {
    const result = await projectService.updateMilestone(req.params.id, req.params.milestoneId, req.body, req.user);

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'milestone_updated', {
      milestone: result
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// ======== Reports ========

const listReports = async (req, res, next) => {
  try {
    const { week_number, year, user_id, page, limit } = req.query;
    const result = await projectService.listReports(
      req.params.id,
      { week_number, year, user_id, page: page ? parseInt(page, 10) : 1, limit: limit ? parseInt(limit, 10) : 50 },
      req.user,
    );
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getComplianceMatrix = async (req, res, next) => {
  try {
    const weeks = req.query.weeks ? parseInt(req.query.weeks, 10) : 8;
    const result = await projectService.getComplianceMatrix(req.params.id, { weeks }, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const createReport = async (req, res, next) => {
  try {
    const result = await projectService.createReport(
      req.params.id,
      { ...req.body, file: req.file || null },
      req.user,
    );

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'report_created', {
      report: result,
      submittedBy: req.user.id,
    });

    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const previewReport = async (req, res, next) => {
  try {
    const { buffer, contentType } = await projectService.getReportPreview(
      req.params.id,
      req.params.reportId,
      req.user,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    return res.send(buffer);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// ======== Git Repo ========

const getGitRepo = async (req, res, next) => {
  try {
    const result = await projectService.getGitRepo(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const updateGitRepo = async (req, res, next) => {
  try {
    const result = await projectService.updateGitRepo(req.params.id, req.body, req.user);

    // Broadcast realtime update to all project members
    realtimeService.broadcastProjectUpdate(req.params.id, 'git_repo_updated', {
      gitRepo: result
    });

    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const handleGitWebhook = async (req, res, next) => {
  try {
    const result = await projectService.handleGitWebhook(req.params.id, req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const searchActiveUsers = async (req, res, next) => {
  try {
    const excludeVienTruong = req.query.exclude_vien_truong === 'true' || req.query.exclude_vien_truong === '1';
    const partyAOnly = req.query.party_a_only === 'true' || req.query.party_a_only === '1';
    const checkCapacity = req.query.check_capacity === 'true' || req.query.check_capacity === '1';
    const result = await projectService.searchActiveUsers(req.query.q || '', {
      excludeVienTruong,
      partyAOnly,
      checkCapacity,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

// 1. Hàm joinProject (Nếu bạn có rồi thì kiểm tra lại xem giống thế này chưa)
const joinProject = async (req, res, next) => {
  try {
    const result = await projectService.joinProject(req.params.id, req.user.id);
    realtimeService.broadcastProjectUpdate(req.params.id, 'member_added', {
      source: 'join_project',
      userId: req.user.id,
    });
    realtimeService.broadcastProjectUpdate(req.params.id, 'commitment_updated', {
      source: 'join_project',
      userId: req.user.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

// 2. Hàm rejectProject (Thêm mới)
const rejectProject = async (req, res, next) => {
  try {
    const result = await projectService.rejectProject(req.params.id, req.user.id, req.body.reason);
    realtimeService.broadcastProjectUpdate(req.params.id, 'member_removed', {
      source: 'reject_participation',
      userId: req.user.id,
    });
    realtimeService.broadcastProjectUpdate(req.params.id, 'commitment_updated', {
      source: 'reject_participation',
      userId: req.user.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const acceptLeaderRole = async (req, res, next) => {
  try {
    const result = await projectService.acceptLeaderRole(req.params.id, req.user.id);
    realtimeService.broadcastProjectUpdate(req.params.id, 'project_updated', {
      projectId: req.params.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const declineLeaderRole = async (req, res, next) => {
  try {
    const result = await projectService.declineLeaderRole(
      req.params.id,
      req.user.id,
      req.body?.reason,
    );
    realtimeService.broadcastProjectUpdate(req.params.id, 'project_updated', {
      projectId: req.params.id,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const assignNewLeader = async (req, res, next) => {
  try {
    const { newLeaderId } = req.body;
    const { id: projectId } = req.params;
    
    const result = await projectService.assignNewLeader(projectId, newLeaderId, req.user.id);
    realtimeService.broadcastProjectUpdate(projectId, 'commitment_updated', {
      source: 'assign_leader',
      newLeaderId,
    });
    realtimeService.broadcastProjectUpdate(projectId, 'project_updated', {
      source: 'assign_leader',
      projectId,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

// Nhớ thêm assignNewLeader vào module.exports ở cuối file nhé!
module.exports = {
  listProjects,
  countActiveProjectsPublic,
  checkCode,
  createProject,
  getProjectDetail,
  updateProject,
  getProjectOverview,
  listTasks,
  createTask,
  updateTask,
  getTaskDetail,
  getMemberWorkload,
  listMembers,
  addMember,
  removeMember,
  joinProject,
  activateProject,
  listMilestones,
  createMilestone,
  updateMilestone,
  listReports,
  getComplianceMatrix,
  createReport,
  previewReport,
  getGitRepo,
  updateGitRepo,
  handleGitWebhook,
  searchActiveUsers,
  joinProject,
  rejectProject,
  acceptLeaderRole,
  declineLeaderRole,
  assignNewLeader,
};
