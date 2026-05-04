const { Op } = require('sequelize');
const {
  Project, ProjectMember, Task, Milestone, MilestoneTask,
  WeeklyReport, User, Commitment, Checklist, ChecklistItem, sequelize,
} = require('../models');
const {
  PROJECT_STATUS, PROJECT_STATUS_TRANSITIONS, PROJECT_ROLES,
  SYSTEM_ROLES, TASK_STATUS, AUDIT_ACTIONS, COMMITMENT_STATUS, PROJECT_LIMITS,
} = require('../config/constants');
const auditService = require('./audit.service');
const rewardService = require('./reward.service');
const notificationService = require('./notification.service');
const env = require('../config/env');
const { sendMail, emailTemplates } = require('../utils/email');
const logger = require('../utils/logger');
const {
  countMemberConfirmedActiveProjects,
  assertMemberUnderProjectLimit,
} = require('../utils/memberProjectLimits');
const { resolveProjectAccess } = require('../utils/projectAccess');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');

const ensureMemberCanJoinMoreProjects = assertMemberUnderProjectLimit;

const WORKLOAD_LIMITS = {
  MAX_OPEN_TASKS: 10,
  WARN_ACTIVE_PROJECTS: 3,
  WARN_OVERDUE_TASKS: 3,
};


// Helper validation date
const validateProjectDates = (start_date, end_date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // So sánh theo ngày, bỏ giờ

  const start = new Date(start_date);
  const end = new Date(end_date);

  if (!start_date || isNaN(start.getTime())) {
    throw { status: 400, message: 'Ngày bắt đầu không hợp lệ.' };
  }

  if (!end_date || isNaN(end.getTime())) {
    throw { status: 400, message: 'Ngày kết thúc không hợp lệ.' };
  }

  if (start < today) {
    throw { status: 400, message: 'Ngày bắt đầu không được nhỏ hơn ngày hôm nay.' };
  }

  if (end <= start) {
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu.' };
  }
};
const isProjectMember = async (projectId, userId) => {
  const member = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId },
  });
  return member;
};

/** Chỉ hiển thị `Project.leader` (User) khi `leader_id` đã là chủ trì thật: có ProjectMember.role = LEADER. */
const LEADER_ROLES_OR_LEGACY = { [Op.in]: [PROJECT_ROLES.LEADER, 'LEADER'] };

async function batchProjectIdsWhereLeaderUserIsShown(projectIdLeaderPairs) {
  const pairs = (projectIdLeaderPairs || []).filter((x) => x && x.id && x.leader_id);
  if (pairs.length === 0) return new Set();
  const uniqProjectIds = [...new Set(pairs.map((x) => x.id))];
  const pms = await ProjectMember.findAll({
    where: {
      project_id: { [Op.in]: uniqProjectIds },
      role: LEADER_ROLES_OR_LEGACY,
    },
    attributes: ['project_id', 'user_id'],
  });
  const pairKeys = new Set(pairs.map((x) => `${x.id}:${x.leader_id}`));
  const out = new Set();
  for (const pm of pms) {
    if (pairKeys.has(`${pm.project_id}:${pm.user_id}`)) out.add(pm.project_id);
  }
  return out;
}

const isProjectLeader = async (projectId, userId) => {
  const project = await Project.findByPk(projectId);
  return project && project.leader_id === userId;
};

const demoteOtherProjectLeaders = async (projectId, keepUserId, transaction) => {
  await ProjectMember.update(
    { role: PROJECT_ROLES.MEMBER },
    {
      where: {
        project_id: projectId,
        user_id: { [Op.ne]: keepUserId },
        role: { [Op.in]: [PROJECT_ROLES.LEADER, 'LEADER'] },
      },
      transaction,
    },
  );
};

const parseReportContentPayload = (rawContent) => {
  if (rawContent == null) {
    return {
      text: '',
      source_type: 'text',
      file_url: null,
      file_name: null,
      file_mime: null,
      link_url: null,
      selected_tasks: [],
    };
  }

  if (typeof rawContent !== 'string') {
    return {
      text: String(rawContent),
      source_type: 'text',
      file_url: null,
      file_name: null,
      file_mime: null,
      link_url: null,
      selected_tasks: [],
    };
  }

  const trimmed = rawContent.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.report_content_version === 1) {
        return {
          text: parsed.text || '',
          source_type: parsed.source_type || 'text',
          file_url: parsed.file_url || null,
          file_name: parsed.file_name || null,
          file_mime: parsed.file_mime || null,
          link_url: parsed.link_url || null,
          selected_tasks: Array.isArray(parsed.selected_tasks) ? parsed.selected_tasks : [],
        };
      }
    } catch (error) {
      // Fallback to legacy plain text content.
    }
  }

  return {
    text: rawContent,
    source_type: 'text',
    file_url: null,
    file_name: null,
    file_mime: null,
    link_url: null,
    selected_tasks: [],
  };
};

const buildReportStorageContent = ({
  text = '',
  sourceType = 'text',
  fileUrl = null,
  fileName = null,
  fileMime = null,
  linkUrl = null,
  selectedTasks = [],
}) =>
  JSON.stringify({
    report_content_version: 1,
    text,
    source_type: sourceType,
    file_url: fileUrl,
    file_name: fileName,
    file_mime: fileMime,
    link_url: linkUrl,
    selected_tasks: selectedTasks,
  });

const normalizeTaskIds = (rawTaskIds) => {
  if (!rawTaskIds) return [];
  if (Array.isArray(rawTaskIds)) {
    return [...new Set(rawTaskIds.map((id) => String(id).trim()).filter(Boolean))];
  }
  if (typeof rawTaskIds === 'string') {
    const trimmed = rawTaskIds.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return [...new Set(parsed.map((id) => String(id).trim()).filter(Boolean))];
        }
      } catch (error) {
        // Fall back to comma-separated parsing.
      }
    }
    return [...new Set(trimmed.split(',').map((id) => id.trim()).filter(Boolean))];
  }
  return [];
};

const fetchReportFileBuffer = async (fileUrl) => {
  const response = await fetch(fileUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw { status: 502, message: 'Không tải được file báo cáo từ kho lưu trữ' };
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
};

/**
 * Viện trưởng / Trưởng lab không được dùng quyền hệ thống để tạo task/báo cáo
 * trên dự án mà họ không tham gia (không có trong ProjectMember và không phải trưởng dự án).
 */
const assertInstituteRoleIsProjectParticipant = async (projectId, project, user) => {
  if (![SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG].includes(user.system_role)) {
    return;
  }
  const membership = await isProjectMember(projectId, user.id);
  if (membership || project.leader_id === user.id) {
    return;
  }
  throw {
    status: 403,
    message:
      'Bạn không phải thành viên hoặc trưởng dự án — không thể thực hiện thao tác này trên dự án này.',
  };
};

const getMemberWorkloadSummary = async (userId) => {
  const memberships = await ProjectMember.findAll({
    where: { user_id: userId },
    attributes: ['project_id'],
  });

  /** Chỉ dự án đã có ProjectMember; không tính chỉ `leader_id` (chủ trì dự kiến chưa vào nhóm). */
  const involvedProjectIds = [...new Set(memberships.map((m) => m.project_id))];

  if (involvedProjectIds.length === 0) {
    return {
      active_projects: 0,
      open_tasks: 0,
      overdue_tasks: 0,
      limits: {
        max_open_tasks: WORKLOAD_LIMITS.MAX_OPEN_TASKS,
        warn_active_projects: WORKLOAD_LIMITS.WARN_ACTIVE_PROJECTS,
        warn_overdue_tasks: WORKLOAD_LIMITS.WARN_OVERDUE_TASKS,
      },
      exceeds_open_task_limit: false,
    };
  }

  const activeProjectStatuses = [PROJECT_STATUS.PLANNING, PROJECT_STATUS.ACTIVE, PROJECT_STATUS.PAUSED];
  const activeProjects = await Project.findAll({
    where: {
      id: { [Op.in]: involvedProjectIds },
      status: { [Op.in]: activeProjectStatuses },
    },
    attributes: ['id'],
  });
  const activeProjectIds = activeProjects.map((p) => p.id);

  if (activeProjectIds.length === 0) {
    return {
      active_projects: 0,
      open_tasks: 0,
      overdue_tasks: 0,
      limits: {
        max_open_tasks: WORKLOAD_LIMITS.MAX_OPEN_TASKS,
        warn_active_projects: WORKLOAD_LIMITS.WARN_ACTIVE_PROJECTS,
        warn_overdue_tasks: WORKLOAD_LIMITS.WARN_OVERDUE_TASKS,
      },
      exceeds_open_task_limit: false,
    };
  }

  const [openTasks, overdueTasks] = await Promise.all([
    Task.count({
      where: {
        project_id: { [Op.in]: activeProjectIds },
        assignee_id: userId,
        status: { [Op.ne]: TASK_STATUS.DONE },
      },
    }),
    Task.count({
      where: {
        project_id: { [Op.in]: activeProjectIds },
        assignee_id: userId,
        status: { [Op.ne]: TASK_STATUS.DONE },
        due_date: { [Op.lt]: new Date() },
      },
    }),
  ]);

  return {
    active_projects: activeProjectIds.length,
    open_tasks: openTasks,
    overdue_tasks: overdueTasks,
    limits: {
      max_open_tasks: WORKLOAD_LIMITS.MAX_OPEN_TASKS,
      warn_active_projects: WORKLOAD_LIMITS.WARN_ACTIVE_PROJECTS,
      warn_overdue_tasks: WORKLOAD_LIMITS.WARN_OVERDUE_TASKS,
    },
    exceeds_open_task_limit: openTasks >= WORKLOAD_LIMITS.MAX_OPEN_TASKS,
  };
};

const ensureAssigneeWorkloadAvailable = async (assigneeId) => {
  const workload = await getMemberWorkloadSummary(assigneeId);
  if (workload.exceeds_open_task_limit) {
    throw {
      status: 400,
      message: `Thành viên đã đạt giới hạn ${workload.limits.max_open_tasks} task đang mở (hiện tại: ${workload.open_tasks}).`,
      code: 'ASSIGNEE_OVERLOADED',
      workload,
    };
  }
  return workload;
};

/**
 * Thông báo cho người tạo / leader khi thành viên chấp nhận hoặc từ chối cam kết (My Commitments).
 * @param {{ rejectedAsDesignatedLeader?: boolean }} [options] — Khi từ chối: true nếu lúc từ chối người đó là `leader_id` (chủ trì dự kiến); phải tính trước khi DB gỡ `leader_id`.
 */
async function notifyCommitmentResponseStakeholders(projectId, actorUserId, decision, reason, options = {}) {
  try {
    const { rejectedAsDesignatedLeader = false } = options;
    const project = await Project.findByPk(projectId, {
      attributes: ['id', 'name', 'created_by', 'leader_id', 'party_a_id'],
    });
    if (!project) return;
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Thành viên';
    const base = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
    const projectUrl = `${base}/projects/${projectId}`;
    const creatorId = project.created_by || project.party_a_id;
    const stakeholderIds = [...new Set([creatorId, project.leader_id].filter(Boolean))];
    const approved = decision === 'approved';
    const reasonText = reason && String(reason).trim() ? ` Lý do: ${reason}` : '';
    let title;
    let message;
    let type;
    let eventName;
    if (approved) {
      title = 'Cam kết được chấp nhận';
      message = `${actorName} đã chấp nhận cam kết tham gia dự án "${project.name}".`;
      type = 'success';
      eventName = 'PROJECT_COMMITMENT_APPROVED';
    } else if (rejectedAsDesignatedLeader) {
      title = 'Từ chối vai trò chủ trì dự kiến';
      message = `${actorName} đã từ chối vai trò chủ trì dự kiến cho dự án "${project.name}".${reasonText}`;
      type = 'warning';
      eventName = 'PROJECT_COMMITMENT_LEADER_NOMINATION_REJECTED';
    } else {
      title = 'Từ chối tham gia dự án';
      message = `${actorName} đã từ chối tham gia dự án "${project.name}".${reasonText}`;
      type = 'warning';
      eventName = 'PROJECT_COMMITMENT_REJECTED';
    }
    for (const uid of stakeholderIds) {
      if (uid === actorUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title,
        message,
        type,
        actionUrl: projectUrl,
        metadata: {
          project_id: projectId,
          commitment_response: decision,
          ...(approved ? {} : { rejection_kind: rejectedAsDesignatedLeader ? 'leader_nomination' : 'member_invite' }),
        },
        eventName,
        eventPayload: { project_id: projectId, actor_user_id: actorUserId },
      });
    }
  } catch (e) {
    logger.error('notifyCommitmentResponseStakeholders:', e?.message || e);
  }
}

/** Sau khi join: báo người tạo/leader; với SELF_JOIN, khi đủ slot thì báo thêm. */
async function notifyAfterJoinProject(projectId, joinerUserId) {
  try {
    const project = await Project.findByPk(projectId, {
      attributes: [
        'id',
        'name',
        'created_by',
        'leader_id',
        'party_a_id',
        'participation_mode',
        'required_members',
      ],
    });
    if (!project) return;
    const joiner = await User.findByPk(joinerUserId, { attributes: ['full_name'] });
    const joinerName = joiner?.full_name || 'Thành viên';
    const base = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
    const projectUrl = `${base}/projects/${projectId}`;
    const creatorId = project.created_by || project.party_a_id;

    const push = async (userId, title, message, type, eventName, eventPayload) => {
      if (!userId || userId === joinerUserId) return;
      await notificationService.createAndPushNotification({
        userId,
        title,
        message,
        type,
        actionUrl: projectUrl,
        metadata: { project_id: projectId },
        eventName,
        eventPayload,
      });
    };

    await push(
      creatorId,
      'Thành viên mới tham gia dự án',
      `${joinerName} đã tham gia dự án "${project.name}".`,
      'info',
      'PROJECT_MEMBER_JOINED',
      { project_id: projectId, member_user_id: joinerUserId },
    );
    if (project.leader_id && project.leader_id !== creatorId) {
      await push(
        project.leader_id,
        'Thành viên mới tham gia dự án',
        `${joinerName} đã tham gia dự án "${project.name}".`,
        'info',
        'PROJECT_MEMBER_JOINED',
        { project_id: projectId, member_user_id: joinerUserId },
      );
    }

    if (project.participation_mode === 'SELF_JOIN' && project.required_members) {
      const memberCount = await ProjectMember.count({ where: { project_id: projectId } });
      if (memberCount >= project.required_members && creatorId) {
        await notificationService.createAndPushNotification({
          userId: creatorId,
          title: 'Đủ thành viên — cần kích hoạt dự án',
          message: `Dự án "${project.name}" đã đủ thành viên. Vui lòng chuyển dự án sang trạng thái hoạt động (active) và chỉ định chủ trì.`,
          type: 'info',
          actionUrl: projectUrl,
          metadata: { project_id: projectId },
          eventName: 'PROJECT_ROSTER_FULL',
          eventPayload: { project_id: projectId, member_count: memberCount },
        });
      }
    }
  } catch (e) {
    logger.error('notifyAfterJoinProject:', e?.message || e);
  }
}

/**
 * @param {'member_invite'|'leader_resigned'|'decline_leader_nomination'} rejectKind
 *   member_invite — từ chối tham gia / rời lời mời;
 *   leader_resigned — chủ trì đã nhận vai trò chính thức rồi từ chối;
 *   decline_leader_nomination — vẫn là thành viên, chỉ từ chối nhận chủ trì.
 */
async function notifyProjectRejectStakeholders(projectId, rejecterUserId, reason, rejectKind = 'member_invite') {
  try {
    const project = await Project.findByPk(projectId, {
      attributes: ['id', 'name', 'created_by', 'leader_id', 'party_a_id'],
    });
    if (!project) return;
    const rejecter = await User.findByPk(rejecterUserId, { attributes: ['full_name'] });
    const rejecterName = rejecter?.full_name || 'Thành viên';
    const base = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
    const projectUrl = `${base}/projects/${projectId}`;
    const creatorId = project.created_by || project.party_a_id;
    const stakeholderIds = [...new Set([creatorId, project.leader_id].filter(Boolean))];
    const reasonText = reason && String(reason).trim() ? ` Lý do: ${reason}` : '';
    let title;
    let message;
    let type;
    let eventName;
    if (rejectKind === 'leader_resigned') {
      title = 'Leader từ chối chủ trì';
      message = `Leader ${rejecterName} đã từ chối chủ trì dự án "${project.name}". Dự án tạm dừng.${reasonText}`;
      type = 'alert';
      eventName = 'PROJECT_LEADER_REJECTED';
    } else if (rejectKind === 'decline_leader_nomination') {
      title = 'Từ chối vai trò chủ trì';
      message = `${rejecterName} đã từ chối vai trò chủ trì dự án "${project.name}" (vẫn là thành viên; cần chỉ định chủ trì mới).${reasonText}`;
      type = 'warning';
      eventName = 'PROJECT_LEADER_NOMINATION_DECLINED';
    } else {
      title = 'Từ chối tham gia dự án';
      message = `${rejecterName} đã từ chối tham gia dự án "${project.name}".${reasonText}`;
      type = 'warning';
      eventName = 'PROJECT_INVITE_REJECTED';
    }
    for (const uid of stakeholderIds) {
      if (uid === rejecterUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title,
        message,
        type,
        actionUrl: projectUrl,
        metadata: { project_id: projectId, rejection_kind: rejectKind },
        eventName,
        eventPayload: { project_id: projectId, rejecter_user_id: rejecterUserId },
      });
    }
  } catch (e) {
    logger.error('notifyProjectRejectStakeholders:', e?.message || e);
  }
}

function projectAppUrl(projectId) {
  const base = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/projects/${projectId}`;
}

const PROJECT_STATUS_NOTIFY_LABEL_VI = {
  [PROJECT_STATUS.PLANNING]: 'Lập kế hoạch',
  [PROJECT_STATUS.ACTIVE]: 'Đang hoạt động',
  [PROJECT_STATUS.PAUSED]: 'Tạm dừng',
  [PROJECT_STATUS.DONE]: 'Hoàn thành',
  [PROJECT_STATUS.ARCHIVED]: 'Lưu trữ',
};

/** Bên A + chủ trì + mọi thành viên trong ProjectMember (dedupe). */
async function collectProjectAudienceUserIds(projectId) {
  const project = await Project.findByPk(projectId, {
    attributes: ['id', 'created_by', 'party_a_id', 'leader_id'],
  });
  if (!project) return [];
  const creatorId = project.created_by || project.party_a_id;
  const ids = new Set([creatorId, project.leader_id].filter(Boolean));
  const rows = await ProjectMember.findAll({
    where: { project_id: projectId },
    attributes: ['user_id'],
  });
  for (const r of rows) ids.add(r.user_id);
  return [...ids];
}

async function notifyLeaderRoleAcceptedStakeholders(projectId, newLeaderUserId) {
  try {
    const project = await Project.findByPk(projectId, {
      attributes: ['name', 'created_by', 'party_a_id', 'leader_id'],
    });
    if (!project) return;
    const actor = await User.findByPk(newLeaderUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Chủ trì';
    const audience = await collectProjectAudienceUserIds(projectId);
    const url = projectAppUrl(projectId);
    for (const uid of audience) {
      if (uid === newLeaderUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Chủ trì đã nhận vai trò',
        message: `${actorName} đã chấp nhận vai trò chủ trì dự án "${project.name}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId },
        eventName: 'PROJECT_LEADER_ROLE_ACCEPTED',
        eventPayload: { project_id: projectId, leader_user_id: newLeaderUserId },
      });
    }
  } catch (e) {
    logger.error('notifyLeaderRoleAcceptedStakeholders:', e?.message || e);
  }
}

async function notifyNewLeaderAssigned(projectId, newLeaderUserId, adminId) {
  try {
    const project = await Project.findByPk(projectId, { attributes: ['name'] });
    if (!project) return;
    const admin = await User.findByPk(adminId, { attributes: ['full_name'] });
    const adminName = admin?.full_name || 'Ban lãnh đạo';
    const url = projectAppUrl(projectId);
    await notificationService.createAndPushNotification({
      userId: newLeaderUserId,
      title: 'Bạn được chỉ định chủ trì',
      message: `${adminName} đã chỉ định bạn là chủ trì dự án "${project.name}".`,
      type: 'info',
      actionUrl: url,
      metadata: { project_id: projectId },
      eventName: 'PROJECT_LEADER_ASSIGNED',
      eventPayload: { project_id: projectId, new_leader_user_id: newLeaderUserId },
    });
    const audience = await collectProjectAudienceUserIds(projectId);
    for (const uid of audience) {
      if (!uid || uid === newLeaderUserId || uid === adminId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Chủ trì dự án mới',
        message: `${adminName} đã chỉ định chủ trì mới cho dự án "${project.name}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId },
        eventName: 'PROJECT_LEADER_ASSIGNED_TEAM',
        eventPayload: { project_id: projectId, new_leader_user_id: newLeaderUserId },
      });
    }
  } catch (e) {
    logger.error('notifyNewLeaderAssigned:', e?.message || e);
  }
}

async function notifyMemberRemovedFromProject(projectId, removedUserId, actorUserId) {
  try {
    const project = await Project.findByPk(projectId, { attributes: ['name'] });
    if (!project) return;
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Quản lý dự án';
    const url = projectAppUrl(projectId);
    await notificationService.createAndPushNotification({
      userId: removedUserId,
      title: 'Rút khỏi dự án',
      message: `Bạn đã bị gỡ khỏi dự án "${project.name}" bởi ${actorName}.`,
      type: 'warning',
      actionUrl: url,
      metadata: { project_id: projectId },
      eventName: 'PROJECT_MEMBER_REMOVED',
      eventPayload: { project_id: projectId },
    });
  } catch (e) {
    logger.error('notifyMemberRemovedFromProject:', e?.message || e);
  }
}

async function notifyProjectStatusChangedToMembers(projectId, actorUserId, projectName, fromStatus, toStatus) {
  try {
    const audience = await collectProjectAudienceUserIds(projectId);
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Quản lý';
    const fromLabel = PROJECT_STATUS_NOTIFY_LABEL_VI[fromStatus] || fromStatus;
    const toLabel = PROJECT_STATUS_NOTIFY_LABEL_VI[toStatus] || toStatus;
    const url = projectAppUrl(projectId);
    for (const uid of audience) {
      if (uid === actorUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Trạng thái dự án thay đổi',
        message: `${actorName} đã chuyển dự án "${projectName}" từ "${fromLabel}" sang "${toLabel}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId, from_status: fromStatus, to_status: toStatus },
        eventName: 'PROJECT_STATUS_CHANGED',
        eventPayload: { project_id: projectId, from_status: fromStatus, to_status: toStatus },
      });
    }
  } catch (e) {
    logger.error('notifyProjectStatusChangedToMembers:', e?.message || e);
  }
}

async function notifyTaskAssigned(projectId, taskId, taskTitle, actorUserId, assigneeUserId) {
  try {
    const project = await Project.findByPk(projectId, { attributes: ['name'] });
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Quản lý';
    const url = projectAppUrl(projectId);
    await notificationService.createAndPushNotification({
      userId: assigneeUserId,
      title: 'Task mới được giao',
      message: `${actorName} đã giao task "${taskTitle}" cho bạn trong dự án "${project?.name || ''}".`,
      type: 'info',
      actionUrl: url,
      metadata: { project_id: projectId, task_id: taskId },
      eventName: 'PROJECT_TASK_ASSIGNED',
      eventPayload: { project_id: projectId, task_id: taskId },
    });
  } catch (e) {
    logger.error('notifyTaskAssigned:', e?.message || e);
  }
}

async function notifyTaskCompletedStakeholders(projectId, taskRow, completedByUserId) {
  try {
    const project = await Project.findByPk(projectId, {
      attributes: ['name', 'leader_id', 'created_by', 'party_a_id'],
    });
    if (!project) return;
    const completer = await User.findByPk(completedByUserId, { attributes: ['full_name'] });
    const completerName = completer?.full_name || 'Thành viên';
    const ids = new Set(
      [project.leader_id, project.created_by || project.party_a_id, taskRow.created_by].filter(Boolean),
    );
    ids.delete(completedByUserId);
    const url = projectAppUrl(projectId);
    const title = taskRow.title || 'Task';
    for (const uid of ids) {
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Task đã hoàn thành',
        message: `${completerName} đã hoàn thành task "${title}" trong dự án "${project.name}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId, task_id: taskRow.id },
        eventName: 'PROJECT_TASK_DONE',
        eventPayload: { project_id: projectId, task_id: taskRow.id },
      });
    }
  } catch (e) {
    logger.error('notifyTaskCompletedStakeholders:', e?.message || e);
  }
}

async function notifyMilestoneCreatedStakeholders(projectId, actorUserId, milestoneTitle) {
  try {
    const project = await Project.findByPk(projectId, { attributes: ['name'] });
    if (!project) return;
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Quản lý';
    const audience = await collectProjectAudienceUserIds(projectId);
    const url = projectAppUrl(projectId);
    for (const uid of audience) {
      if (uid === actorUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Milestone mới',
        message: `${actorName} đã tạo milestone "${milestoneTitle}" trong dự án "${project.name}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId },
        eventName: 'PROJECT_MILESTONE_CREATED',
        eventPayload: { project_id: projectId },
      });
    }
  } catch (e) {
    logger.error('notifyMilestoneCreatedStakeholders:', e?.message || e);
  }
}

async function notifyMilestoneCompletedStakeholders(projectId, actorUserId, milestoneTitle) {
  try {
    const project = await Project.findByPk(projectId, { attributes: ['name'] });
    if (!project) return;
    const actor = await User.findByPk(actorUserId, { attributes: ['full_name'] });
    const actorName = actor?.full_name || 'Quản lý';
    const audience = await collectProjectAudienceUserIds(projectId);
    const url = projectAppUrl(projectId);
    for (const uid of audience) {
      if (uid === actorUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Milestone hoàn thành',
        message: `${actorName} đã đánh dấu hoàn thành milestone "${milestoneTitle}" trong dự án "${project.name}".`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId },
        eventName: 'PROJECT_MILESTONE_DONE',
        eventPayload: { project_id: projectId },
      });
    }
  } catch (e) {
    logger.error('notifyMilestoneCompletedStakeholders:', e?.message || e);
  }
}

async function notifyWeeklyReportSubmitted(projectId, authorUserId, reportRow, projectName) {
  try {
    const audience = await collectProjectAudienceUserIds(projectId);
    const author = await User.findByPk(authorUserId, { attributes: ['full_name'] });
    const authorName = author?.full_name || 'Thành viên';
    const url = projectAppUrl(projectId);
    const late = reportRow.status === 'late' ? ' (nộp trễ)' : '';
    for (const uid of audience) {
      if (uid === authorUserId) continue;
      await notificationService.createAndPushNotification({
        userId: uid,
        title: 'Báo cáo tuần đã nộp',
        message: `${authorName} đã nộp báo cáo tuần ${reportRow.week_number}/${reportRow.year} cho dự án "${projectName}".${late}`,
        type: 'info',
        actionUrl: url,
        metadata: { project_id: projectId, weekly_report_id: reportRow.id },
        eventName: 'PROJECT_WEEKLY_REPORT_SUBMITTED',
        eventPayload: { project_id: projectId, weekly_report_id: reportRow.id },
      });
    }
  } catch (e) {
    logger.error('notifyWeeklyReportSubmitted:', e?.message || e);
  }
}

/** Gửi email + thông báo in-app cho người có cam kết chờ B duyệt */
async function notifyCommitmentInviteRecipients(projectRow, inviteeUserRows) {
  if (!projectRow?.id || !inviteeUserRows?.length) return;
  const base = (env.clientUrl || 'http://localhost:5173').replace(/\/$/, '');
  const projectUrl = `${base}/projects/${projectRow.id}`;
  for (const u of inviteeUserRows) {
    if (!u?.id) continue;
    try {
      await notificationService.createAndPushNotification({
        userId: u.id,
        title: 'Lời mời tham gia dự án',
        message: `Bạn được mời tham gia dự án "${projectRow.name}". Vui lòng xác nhận cam kết (Bên B).`,
        type: 'info',
        actionUrl: projectUrl,
        metadata: { project_id: projectRow.id },
        eventName: 'PROJECT_COMMITMENT_INVITED',
        eventPayload: { project_id: projectRow.id },
      });
    } catch (e) {
      logger.error('notifyCommitmentInviteRecipients (push):', e?.message || e);
    }
    const emailAddr = u.email && String(u.email).trim();
    if (emailAddr) {
      const tpl = emailTemplates.projectCommitmentInvite(u.full_name, projectRow.name, projectUrl);
      const sent = await sendMail(emailAddr, tpl.subject, tpl.html);
      if (!sent) {
        logger.warn(
          `notifyCommitmentInviteRecipients: không gửi được email cho user_id=${u.id} — kiểm tra SMTP và log phía trên`,
        );
      }
    } else {
      logger.warn(
        `notifyCommitmentInviteRecipients: user_id=${u.id} không có email trong hồ sơ — chỉ có thông báo trong app`,
      );
    }
  }
}

// =====================================================
// Projects CRUD
// =====================================================

const listProjects = async ({ status, tag, page = 1, limit = 20 }, user) => {
  // 1. Điều kiện chung: Các dự án đang mở (tất cả mọi người đều thấy)
  const openProjectsCondition = {
    participation_mode: 'SELF_JOIN',
    status: PROJECT_STATUS.PLANNING,
  };
  // 2. Điều kiện Filter (Áp dụng chung cho TẤT CẢ các dự án trả về)
  const filterCondition = {};
  if (status) filterCondition.status = status;
  if (tag) filterCondition.tag = tag;

  // Viện trưởng & Trưởng lab: xem toàn bộ danh sách dự án (matrix). Admin không có quyền này.
  const canListAllProjects =
    user.system_role === SYSTEM_ROLES.VIEN_TRUONG ||
    user.system_role === SYSTEM_ROLES.TRUONG_LAB;

  // 3. Xây dựng điều kiện về quyền hạn của User
  let permissionCondition = {}; 

  /** Dự án user đã từ chối cam kết (b_rejected) — không hiển thị trong danh sách (trừ BLĐ xem toàn bộ). */
  let rejectedCommitmentProjectIds = [];
  /** Dự án user đã vào roster (có ProjectMember — đã chấp nhận tham gia) — dùng badge is_joined cho MEMBER. */
  let rosterProjectIdsForMember = null;
  /** MEMBER: map project_id → trạng thái cam kết (badge chờ xác nhận). */
  let commitmentStatusByProjectId = null;

  if (!canListAllProjects) {
    const memberships = await ProjectMember.findAll({
      where: { user_id: user.id },
      attributes: ['project_id'],
    });
    const rosterIds = [...new Set(memberships.map((m) => m.project_id))];
    if (user.system_role === SYSTEM_ROLES.MEMBER) {
      rosterProjectIdsForMember = new Set(rosterIds);
    }

    /** Cam kết còn hiệu lực (trừ từ chối / kết thúc): roster + lời mời đều đưa dự án vào Matrix; từ chối → không còn trong query này. */
    const commitmentRows = await Commitment.findAll({
      where: {
        user_id: user.id,
        status: { [Op.notIn]: [COMMITMENT_STATUS.B_REJECTED, COMMITMENT_STATUS.TERMINATED] },
      },
      attributes: ['project_id', 'status'],
    });
    if (user.system_role === SYSTEM_ROLES.MEMBER) {
      commitmentStatusByProjectId = new Map(commitmentRows.map((c) => [c.project_id, c.status]));
    }

    rejectedCommitmentProjectIds = (
      await Commitment.findAll({
        where: { user_id: user.id, status: COMMITMENT_STATUS.B_REJECTED },
        attributes: ['project_id'],
      })
    ).map((c) => c.project_id);

    const involvedProjectIds = [
      ...new Set([
        ...rosterIds,
        ...commitmentRows.map((c) => c.project_id),
      ]),
    ];

    const orClauses = [];
    if (involvedProjectIds.length > 0) {
      orClauses.push({ id: { [Op.in]: involvedProjectIds } });
    }

    if (orClauses.length > 0) {
      permissionCondition = { [Op.or]: orClauses };
    } else {
      // Nếu user không có dự án nào, trả về false cho nhánh quyền bằng cách ép id = null
      permissionCondition = { id: { [Op.eq]: null } };
    }
  }

  const openProjectsForUser =
    !canListAllProjects &&
    rejectedCommitmentProjectIds.length > 0
      ? {
          [Op.and]: [
            openProjectsCondition,
            { id: { [Op.notIn]: rejectedCommitmentProjectIds } },
          ],
        }
      : openProjectsCondition;

  // 4. CHUẨN HOÁ CÂU QUERY MỚI (Khắc phục lỗi filter)
  // Logic: ( (Dự án tôi có quyền) OR (Dự án đang mở) ) AND (Thỏa mãn Filter)
  const where = {
    [Op.and]: [
      // Nhóm Quyền & Mở rộng
      canListAllProjects
        ? {} // Không giới hạn nhánh này
        : {
            [Op.or]: [
              permissionCondition,
              openProjectsForUser,
            ],
          },
      // Nhóm Lọc (Luôn luôn áp dụng)
      filterCondition
    ]
  };

  const offset = (page - 1) * limit;

  // NOTE: MSSQL can fail on findAndCountAll with include+distinct.
  // Split into two queries for stable pagination/count.
  const [count, rows] = await Promise.all([
    Project.count({
      where,
      distinct: true,
      col: 'id',
    }),
    Project.findAll({
      where,
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'full_name', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    }),
  ]);

  const leaderShownProjectIds = await batchProjectIdsWhereLeaderUserIsShown(
    rows.map((r) => ({ id: r.id, leader_id: r.leader_id })),
  );

  const projectsWithStats = await Promise.all(rows.map(async (project) => {
    const p = project.toJSON();

    // Đếm chính xác số lượng trong bảng ProjectMember (Đã bao gồm Leader và Member, không có Bên A)
    const memberCount = await ProjectMember.count({ where: { project_id: p.id } });

    const taskTotal = await Task.count({ where: { project_id: p.id } });
    const taskDone = await Task.count({ where: { project_id: p.id, status: TASK_STATUS.DONE } });

    const totalReports = await WeeklyReport.count({ where: { project_id: p.id } });
    const onTimeReports = await WeeklyReport.count({
      where: { project_id: p.id, status: 'submitted' },
    });
    const reportRate = totalReports > 0 ? Math.round((onTimeReports / totalReports) * 100) : 100;

    const overdueTasks = await Task.count({
      where: {
        project_id: p.id,
        status: { [Op.ne]: TASK_STATUS.DONE },
        due_date: { [Op.lt]: new Date() },
      },
    });
    const atRisk = reportRate < 70 || overdueTasks > 0;

    const base = {
      ...p,
      member_count: memberCount, // ĐÃ FIX LỖI COUNT: Bỏ cái "+ 1" sai lầm đi
      task_progress: { done: taskDone, total: taskTotal },
      report_rate: reportRate,
      at_risk: atRisk,
    };

    if (!leaderShownProjectIds.has(p.id)) {
      base.leader = null;
    }

    if (
      user.system_role === SYSTEM_ROLES.MEMBER &&
      rosterProjectIdsForMember &&
      commitmentStatusByProjectId
    ) {
      const joined = rosterProjectIdsForMember.has(p.id);
      const st = commitmentStatusByProjectId.get(p.id);
      return {
        ...base,
        is_joined: joined,
        pending_commitment_invite: Boolean(
          !joined && st === COMMITMENT_STATUS.PENDING_B_APPROVAL,
        ),
      };
    }

    return base;
  }));

  return {
    projects: projectsWithStats,
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

const countActiveProjectsPublic = async () => {
  const total = await Project.count({
    where: { status: PROJECT_STATUS.ACTIVE },
  });
  return { total };
};

const checkCodeExists = async (code) => {
  const existing = await Project.findOne({ where: { code: code.toUpperCase() } });
  return { exists: !!existing };
};



const createProject = async (data, userId) => {
  // ========================================================
  // Mode 2: SELF_JOIN - Dự án mở, thành viên tự ứng tuyển
  // ========================================================
  validateProjectDates(data.start_date, data.end_date);
  
  if (data.participation_mode === 'SELF_JOIN') {
    const t = await sequelize.transaction();
    try {
      const existingCode = await Project.findOne({ where: { code: data.code.toUpperCase() }, transaction: t });
      if (existingCode) {
        throw { status: 409, message: 'Mã dự án đã tồn tại.' };
      }

      if (!data.required_members || data.required_members <= 0) {
        throw { status: 400, message: 'Số lượng thành viên yêu cầu là bắt buộc cho chế độ này.' };
      }

      // SỬA LẠI: Lấy đầy đủ dữ liệu cam kết từ Frontend thay vì hardcode null
      const project = await Project.create({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description || null,
        tag: data.tag || null,
        status: PROJECT_STATUS.PLANNING,
        leader_id: null, 
        party_a_id: data.party_a_id || null, // Nhận ID Viện trưởng
        created_by: userId,
        start_date: data.start_date,
        end_date: data.end_date,
        budget: data.budget || null,
        git_repo_url: data.git_repo_url || null,
        model_type: data.model_type || null,           // Nhận Mô hình
        party_a_percent: data.party_a_percent || null, // Nhận % Bên A
        party_b_percent: data.party_b_percent || null, // Nhận % Bên B
        participation_mode: 'SELF_JOIN',
        required_members: data.required_members,
      }, { transaction: t });

      // SỬA LẠI: Tạo Cam kết (Đã duyệt) cho Viện trưởng ngay lúc tạo dự án
      if (data.party_a_id) {
        await Commitment.create({
          project_id: project.id,
          user_id: data.party_a_id,
          status: COMMITMENT_STATUS.A_APPROVED,
        }, { transaction: t });
      }

      await auditService.log(AUDIT_ACTIONS.PROJECT_CREATED, userId, null, {
        project_id: project.id,
        code: project.code,
        note: `Dự án được tạo ở chế độ tự tham gia, yêu cầu ${data.required_members} thành viên.`,
      }, { transaction: t });

      await t.commit();
      return project;
    } catch (error) {
      await t.rollback();
      if (error.status) throw error;
      throw { status: 500, message: error.message };
    }
  }

  // ========================================================
  // Mode 1: TAG - Chế độ mặc định, chỉ định Leader và Members
  // ========================================================
  else {
    const t = await sequelize.transaction();
    try {
      const existingCode = await Project.findOne({ where: { code: data.code.toUpperCase() }, transaction: t });
      if (existingCode) {
        throw { status: 409, message: 'Mã dự án đã tồn tại.' };
      }

      const leader = await User.findByPk(data.leader_id, { transaction: t });
      if (!leader || leader.status !== 'active') {
        throw { status: 400, message: 'Leader không tồn tại hoặc không hoạt động.' };
      }
      await ensureMemberCanJoinMoreProjects(data.leader_id, t);

      const rawMemberIds = Array.isArray(data.members) ? data.members : [];
      const taggedForLimit = [...new Set(rawMemberIds)].filter(
        (uid) => uid && uid !== data.leader_id && uid !== data.party_a_id,
      );
      for (const uid of taggedForLimit) {
        await ensureMemberCanJoinMoreProjects(uid, t);
      }

      // SỬA LẠI: Ưu tiên lấy % động từ Frontend. Nếu null mới lấy mặc định.
      let partyA = data.party_a_percent;
      let partyB = data.party_b_percent;
      
      if (partyA == null || partyB == null) {
        if (data.model_type === 'MODEL_1') { partyA = 65; partyB = 35; }
        else if (data.model_type === 'MODEL_2') { partyA = 50; partyB = 50; }
        else if (data.model_type === 'MODEL_3') { partyA = 40; partyB = 60; }
      }

      const project = await Project.create({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description || null,
        tag: data.tag || null,
        status: data.status || PROJECT_STATUS.PLANNING,
        leader_id: data.leader_id,
        party_a_id: data.party_a_id,
        created_by: userId,
        start_date: data.start_date,
        end_date: data.end_date,
        budget: data.budget || null,
        git_repo_url: data.git_repo_url || null,
        model_type: data.model_type || null,
        party_a_percent: partyA,
        party_b_percent: partyB,
        participation_mode: 'TAG', 
        required_members: null,    
      }, { transaction: t });

      /** `leader_id` = chủ trì dự kiến (workflow). Hiển thị công khai `Project.leader` chỉ khi đã có ProjectMember LEADER. */

      const allMemberIds = [data.leader_id, data.party_a_id];
      if (data.members && data.members.length > 0) {
        const uniqueMembers = data.members.filter(
          (uid) => uid !== data.leader_id && uid !== data.party_a_id
        );
        allMemberIds.push(...uniqueMembers);
      }

      const finalMemberIds = [...new Set(allMemberIds.filter(id => id != null))];

      if (finalMemberIds.length > 0) {
        const commitmentRecords = finalMemberIds.map((uid) => {
          let status;
          if (uid === data.party_a_id) {
            status = COMMITMENT_STATUS.A_APPROVED;
          } else if (uid === data.leader_id) {
            /** Leader cũng phải xác nhận Bên B; chỉ sau đó mới coi là chấp nhận chủ trì đầy đủ. */
            status = COMMITMENT_STATUS.PENDING_B_APPROVAL;
          } else {
            status = COMMITMENT_STATUS.PENDING_B_APPROVAL;
          }
          return {
            project_id: project.id,
            user_id: uid,
            status: status,
          };
        });
        await Commitment.bulkCreate(commitmentRecords, { transaction: t });
      }

      await auditService.log(AUDIT_ACTIONS.PROJECT_CREATED, userId, null, {
        project_id: project.id,
        code: project.code,
      }, { transaction: t });

      await t.commit();

      const notifyIds = [...new Set([...taggedForLimit, data.leader_id].filter(Boolean))];
      if (notifyIds.length > 0) {
        const pendingUsers = await User.findAll({
          where: { id: { [Op.in]: notifyIds } },
          attributes: ['id', 'email', 'full_name'],
        });
        await notifyCommitmentInviteRecipients(project, pendingUsers);
      }

      return project;
    } catch (error) {
      await t.rollback();
      if (error.status) throw error;
      throw { status: 500, message: error.message };
    }
  }
};

const getProjectDetail = async (projectId, user) => {
  const project = await Project.findByPk(projectId, {
    include: [
      { model: User, as: 'leader', attributes: ['id', 'full_name', 'email'] },
      {
        model: Commitment,
        as: 'commitments',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'avatar', 'email'],
        }],
      }
    ],
  });

  if (!project) {
    throw { status: 404, message: 'Project not found' };
  }

  const isAdmin = [SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG].includes(user.system_role);

  if (!isAdmin) {
    const membership = await isProjectMember(projectId, user.id);
    const isLeader = project.leader_id === user.id;
    /** Có thể có nhiều bản cam kết (mời lại sau từ chối). findOne có thể trả về b_rejected → lệch với list. */
    const myCommitments = await Commitment.findAll({
      where: { project_id: projectId, user_id: user.id },
      attributes: ['id', 'status'],
    });
    const isInvalidCommitmentStatus = (s) =>
      [COMMITMENT_STATUS.B_REJECTED, COMMITMENT_STATUS.TERMINATED].includes(s);
    const hasValidCommitment = myCommitments.some((c) => !isInvalidCommitmentStatus(c.status));
    const onlyInvalidCommitments =
      myCommitments.length > 0 && myCommitments.every((c) => isInvalidCommitmentStatus(c.status));

    const isOpenForJoin =
      project.participation_mode === 'SELF_JOIN' && project.status === PROJECT_STATUS.PLANNING;

    if (isOpenForJoin) {
      // Chặn chỉ khi mọi bản cam kết đều từ chối/kết thúc và không còn trong nhóm
      if (onlyInvalidCommitments && !membership && !isLeader) {
        throw {
          status: 403,
          message:
            'Bạn đã từ chối hoặc không còn liên quan tới dự án này. Không thể xem chi tiết.',
        };
      }
    } else if (!membership && !isLeader && !hasValidCommitment) {
      throw { status: 403, message: 'You do not have access to this project' };
    }
  }

  const myPm = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: user.id },
    attributes: ['id', 'role'],
  });
  const memberCount = await ProjectMember.count({ where: { project_id: projectId } });
  const plain = project.toJSON();
  plain.viewer_membership = myPm ? { id: myPm.id, role: myPm.role } : null;
  const leaderShown = await batchProjectIdsWhereLeaderUserIsShown([
    { id: project.id, leader_id: project.leader_id },
  ]);
  if (!leaderShown.has(project.id)) {
    plain.leader = null;
  }
  plain.member_count = memberCount;
  return plain;
};

/** Chủ trì dự kiến (TAG): sau khi đã tham gia với MEMBER, xác nhận nhận vai trò chủ trì. */
const acceptLeaderRole = async (projectId, userId) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Dự án không tồn tại.' };
  if (project.participation_mode !== 'TAG') {
    throw { status: 400, message: 'Chỉ áp dụng cho dự án gán thành viên (TAG).' };
  }
  if (project.leader_id !== userId) {
    throw { status: 403, message: 'Bạn không phải chủ trì dự kiến của dự án này.' };
  }
  const pm = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId },
  });
  if (!pm) {
    throw { status: 400, message: 'Bạn cần chấp nhận tham gia dự án trước khi nhận vai trò chủ trì.' };
  }
  if (pm.role === PROJECT_ROLES.LEADER) {
    return { message: 'Bạn đã là chủ trì dự án.' };
  }
  if (pm.role !== PROJECT_ROLES.MEMBER) {
    throw { status: 400, message: 'Không thể gán vai trò chủ trì từ trạng thái hiện tại.' };
  }
  await demoteOtherProjectLeaders(projectId, userId, undefined);
  await pm.update({ role: PROJECT_ROLES.LEADER });
  await auditService.log(AUDIT_ACTIONS.PROJECT_UPDATED, userId, null, {
    project_id: projectId,
    note: 'Chủ trì dự kiến đã chấp nhận vai trò chủ trì.',
  });
  void notifyLeaderRoleAcceptedStakeholders(projectId, userId);
  return { message: 'Đã ghi nhận vai trò chủ trì dự án.' };
};

/**
 * Chủ trì dự kiến từ chối vai trò chủ trì nhưng vẫn là thành viên (MEMBER).
 * Gỡ leader_id, giữ planning + awaiting_leader_assignment để thành viên vẫn xử lý cam kết.
 */
const declineLeaderRole = async (projectId, userId, reason) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Dự án không tồn tại.' };
  if (project.participation_mode !== 'TAG') {
    throw { status: 400, message: 'Chỉ áp dụng cho dự án gán thành viên (TAG).' };
  }
  if (project.leader_id !== userId) {
    throw { status: 403, message: 'Bạn không phải chủ trì dự kiến của dự án này.' };
  }
  if (project.status !== PROJECT_STATUS.PLANNING) {
    throw { status: 400, message: 'Chỉ có thể từ chối vai trò chủ trì khi dự án đang lập kế hoạch.' };
  }
  const pm = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: userId },
  });
  if (!pm || pm.role !== PROJECT_ROLES.MEMBER) {
    throw {
      status: 400,
      message: 'Chỉ áp dụng khi bạn đang tham gia với vai trò thành viên và chưa nhận chủ trì.',
    };
  }

  const t = await sequelize.transaction();
  try {
    await project.update(
      {
        leader_id: null,
        status: PROJECT_STATUS.PLANNING,
        awaiting_leader_assignment: true,
      },
      { transaction: t },
    );
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  void notifyProjectRejectStakeholders(
    projectId,
    userId,
    reason || 'Từ chối vai trò chủ trì (vẫn là thành viên)',
    'decline_leader_nomination',
  );
  return {
    message:
      'Đã từ chối vai trò chủ trì. Bạn vẫn là thành viên dự án. Dự án đang lập kế hoạch và chờ Ban lãnh đạo chỉ định chủ trì mới.',
  };
};

const updateProject = async (projectId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) {
    throw { status: 404, message: 'Project not found' };
  }

  const accessLevel = await resolveProjectAccess(project, user);

  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to update this project' };
  }

  // Leader can only update name, description, status
  if (accessLevel === 'leader') {
    const allowed = ['name', 'description', 'status'];
    const keys = Object.keys(data);
    const invalid = keys.filter((k) => !allowed.includes(k));
    if (invalid.length > 0) {
      throw { status: 403, message: `Leader cannot update: ${invalid.join(', ')}` };
    }
  }

  // Status transition validation
  if (data.status && data.status !== project.status) {
    const allowedTransitions = PROJECT_STATUS_TRANSITIONS[project.status] || [];
    if (!allowedTransitions.includes(data.status)) {
      throw { status: 400, message: `Cannot transition from ${project.status} to ${data.status}` };
    }
    // Only truong_lab can archive
    if (data.status === PROJECT_STATUS.ARCHIVED && user.system_role !== SYSTEM_ROLES.TRUONG_LAB) {
      throw { status: 403, message: 'Only truong_lab can archive a project' };
    }
  }

  // 🛡️ CHỐT CHẶN: Khóa ngân sách nếu dự án đã done
  if (project.status === 'done' && data.budget && Number(data.budget) !== Number(project.budget)) {
    throw { status: 400, message: 'Dữ liệu đã khóa! Không thể thay đổi Ngân sách khi dự án đã Hoàn thành.' };
  }

  // =========================================================
  // 🛡️ CHỐT CHẶN: KHÔNG CHO RỜI KHỎI TRẠNG THÁI 'DONE' NẾU LƯƠNG ĐÃ CHỐT
  // =========================================================
  if (project.status === 'done' && data.status && data.status !== 'done') {
    // Import RewardSheet từ models (nếu chưa có ở đầu file)
    const { RewardSheet } = require('../models');

    const existingSheet = await RewardSheet.findOne({ where: { project_id: projectId } });
    if (existingSheet && existingSheet.status === 'FINALIZED') {
      throw {
        status: 400,
        message: 'Không thể mở lại dự án này! Bảng tính thưởng của dự án đã được Viện trưởng CHỐT SỔ (Finalized). Bất kỳ thay đổi nào cũng sẽ gây sai lệch tài chính.'
      };
    }
  }
  // =========================================================

  // 🛡️ LƯU LẠI TRẠNG THÁI CŨ TRƯỚC KHI UPDATE ĐỂ TRÁNH SPAM TRIGGER
  const oldStatus = project.status;

  // Gọi update và log duy nhất 1 lần
  await project.update(data);

  await auditService.log(AUDIT_ACTIONS.PROJECT_UPDATED, user.id, null, {
    project_id: projectId,
    changes: data,
  });

  if (data.status && oldStatus !== data.status) {
    await auditService.log(AUDIT_ACTIONS.PROJECT_STATUS_CHANGED, user.id, null, {
      project_id: projectId,
      project_name: project.name,
      from_status: oldStatus,
      to_status: data.status,
    });
    const displayName = data.name != null ? data.name : project.name;
    void notifyProjectStatusChangedToMembers(projectId, user.id, displayName, oldStatus, data.status);
  }

  // =========================================================
  // 🎯 CÒ SÚNG: CHỈ KÍCH HOẠT KHI THỰC SỰ CHUYỂN TỪ TRẠNG THÁI KHÁC SANG 'DONE'
  // =========================================================
  if (data.status === 'done' && oldStatus !== 'done') {
    try {
      console.log(`[AUTO-REWARD] Phát hiện dự án ${projectId} vừa chuyển sang Hoàn thành. Đang kích hoạt tính thưởng...`);
      // Gọi service tính thưởng. Nó tự quản lý transaction độc lập của nó.
      await rewardService.autoGenerateProjectReward(projectId, user.id);
      console.log(`[AUTO-REWARD] Đã tạo bảng tính thưởng nháp cho dự án ${projectId} thành công.`);
    } catch (err) {
      // Bọc try-catch và KHÔNG throw error ở đây. 
      // Đảm bảo việc tính thưởng lỗi cũng không làm fail việc cập nhật trạng thái Project ở trên.
      console.error(`[AUTO-REWARD ERROR] Lỗi khi tự động tính thưởng:`, err.message);
    }
  }
  // =========================================================

  return project;
};

// =====================================================
// Overview Tab
// =====================================================

const getProjectOverview = async (projectId, user) => {
  const project = await getProjectDetail(projectId, user);
  const p = { ...project };

  // Task counts by status
  const taskCounts = {};
  for (const status of Object.values(TASK_STATUS)) {
    taskCounts[status] = await Task.count({ where: { project_id: projectId, status } });
  }

  // Report data for last 8 weeks
  const now = new Date();
  const weeklyReportData = await WeeklyReport.findAll({
    where: {
      project_id: projectId,
      created_at: { [Op.gte]: new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000) },
    },
    attributes: ['week_number', 'year', 'status'],
    order: [['year', 'ASC'], ['week_number', 'ASC']],
  });

  // 3 nearest milestones
  const nearestMilestones = await Milestone.findAll({
    where: { project_id: projectId },
    order: [['due_date', 'ASC']],
    limit: 3,
  });

  // First 5 members + count
  const memberCount = await ProjectMember.count({ where: { project_id: projectId } });
  const topMembers = await ProjectMember.findAll({
    where: { project_id: projectId },
    include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
    limit: 5,
    order: [['joined_at', 'ASC']],
  });

  return {
    ...p,
    task_counts: taskCounts,
    report_chart: weeklyReportData,
    nearest_milestones: nearestMilestones,
    members_preview: {
      total: memberCount,
      members: topMembers.map((m) => m.user),
    },
  };
};

// =====================================================
// Tasks
// =====================================================

const listTasks = async (projectId, { assignee_id, priority, status, page = 1, limit = 50 }, user) => {
  // Check access
  await getProjectDetail(projectId, user);

  const where = { project_id: projectId };
  if (assignee_id) where.assignee_id = assignee_id;
  if (priority) where.priority = priority;
  if (status) where.status = status;

  const offset = (page - 1) * limit;

  const { rows, count } = await Task.findAndCountAll({
    where,
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'avatar'] },
      { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
    ],
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return {
    tasks: rows,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

const createTask = async (projectId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === PROJECT_STATUS.DONE) {
    throw {
      status: 400,
      message: 'Không thể thay đổi Task/Report! Dự án đã hoàn thành, mọi dữ liệu hiệu suất đã được ĐÓNG BĂNG để phục vụ tính lương.'
    };
  }

  const accessLevel = await resolveProjectAccess(project, user);
  if (accessLevel === 'member') {
    throw { status: 403, message: 'Members cannot create tasks' };
  }

  await assertInstituteRoleIsProjectParticipant(projectId, project, user);

  // If assignee provided, check they are a member
  if (data.assignee_id) {
    const membership = await isProjectMember(projectId, data.assignee_id);
    if (!membership && data.assignee_id !== project.leader_id) {
      throw { status: 400, message: 'Assignee is not a member of this project' };
    }
    await ensureAssigneeWorkloadAvailable(data.assignee_id);
  }

  const task = await Task.create({
    project_id: projectId,
    title: data.title,
    description: data.description || null,
    status: data.status || TASK_STATUS.TODO,
    priority: data.priority || 'medium',
    assignee_id: data.assignee_id || null,
    created_by: user.id,
    due_date: data.due_date || null,
  });

  await auditService.log(AUDIT_ACTIONS.TASK_CREATED, user.id, null, {
    project_id: projectId,
    task_id: task.id,
  });

  if (data.assignee_id && data.assignee_id !== user.id) {
    void notifyTaskAssigned(projectId, task.id, task.title, user.id, data.assignee_id);
  }

  return task;
};

const updateTask = async (projectId, taskId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === 'done') {
    throw {
      status: 400,
      message: 'Không thể thay đổi Task/Report! Dự án đã hoàn thành, mọi dữ liệu hiệu suất đã được ĐÓNG BĂNG để phục vụ tính lương.'
    };
  }

  const task = await Task.findOne({ where: { id: taskId, project_id: projectId } });
  if (!task) throw { status: 404, message: 'Task not found' };

  const accessLevel = await resolveProjectAccess(project, user);
  // Members can only update status of their own tasks
  if (accessLevel === 'member') {
    if (task.assignee_id !== user.id) {
      throw { status: 403, message: 'You can only update your own tasks' };
    }
    const allowed = ['status'];
    const keys = Object.keys(data);
    const invalid = keys.filter((k) => !allowed.includes(k));
    if (invalid.length > 0) {
      throw { status: 403, message: 'Members can only update task status' };
    }
  }

  if (data.assignee_id) {
    const membership = await isProjectMember(projectId, data.assignee_id);
    if (!membership && data.assignee_id !== project.leader_id) {
      throw { status: 400, message: 'Assignee is not a member of this project' };
    }
    if (data.assignee_id !== task.assignee_id) {
      await ensureAssigneeWorkloadAvailable(data.assignee_id);
    }
  }

  const prevAssigneeId = task.assignee_id;
  const prevStatus = task.status;
  await task.update(data);

  await auditService.log(AUDIT_ACTIONS.TASK_UPDATED, user.id, null, {
    project_id: projectId,
    task_id: taskId,
    changes: data,
  });

  if (data.assignee_id != null && data.assignee_id !== prevAssigneeId && data.assignee_id !== user.id) {
    void notifyTaskAssigned(projectId, task.id, task.title, user.id, data.assignee_id);
  }
  const newStatus = data.status !== undefined ? data.status : task.status;
  if (newStatus === TASK_STATUS.DONE && prevStatus !== TASK_STATUS.DONE) {
    void notifyTaskCompletedStakeholders(projectId, task, user.id);
  }

  return task;
};

const getTaskDetail = async (projectId, taskId, user) => {
  await getProjectDetail(projectId, user);

  const task = await Task.findOne({
    where: { id: taskId, project_id: projectId },
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
      { model: User, as: 'creator', attributes: ['id', 'full_name', 'email'] },
      { model: Milestone, as: 'milestones', attributes: ['id', 'title', 'due_date', 'done'] },
    ],
  });

  if (!task) throw { status: 404, message: 'Task not found' };
  return task;
};

const getMemberWorkload = async (projectId, targetUserId, requestingUser) => {
  const project = await getProjectDetail(projectId, requestingUser);
  if (targetUserId !== project.leader_id) {
    const membership = await isProjectMember(projectId, targetUserId);
    if (!membership) {
      throw { status: 400, message: 'User is not a member of this project' };
    }
  }
  return getMemberWorkloadSummary(targetUserId);
};

// =====================================================
// Members
// =====================================================

const { fn, col, literal } = require('sequelize'); // Import các hàm của Sequelize

const listMembers = async (projectId, user) => {
  // 1. Lấy thông tin project và kiểm tra quyền, LƯU LẠI project để lấy leader_id
  const project = await getProjectDetail(projectId, user);
  const { leader_id } = project; // <-- Dòng này cần biến 'project' được định nghĩa ngay trước nó

  // 2. Chạy song song các query thống kê tổng hợp để tiết kiệm thời gian
  const [members, taskStats, reportStats] = await Promise.all([
    // Lấy danh sách thành viên, bao gồm cả 'avatar'
    ProjectMember.findAll({
      where: { project_id: projectId },
      include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'avatar'] }],
      order: [['joined_at', 'ASC']],
    }),

    // Đếm Task cho tất cả member cùng lúc
    Task.findAll({
      where: { project_id: projectId },
      attributes: [
        'assignee_id',
        [fn('COUNT', col('id')), 'count']
      ],
      group: ['assignee_id'],
      raw: true
    }),

    // Tính toán Report cho tất cả member cùng lúc
    WeeklyReport.findAll({
      where: { project_id: projectId },
      attributes: [
        'user_id',
        [fn('COUNT', col('id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = 'submitted' THEN 1 ELSE 0 END")), 'onTime']
      ],
      group: ['user_id'],
      raw: true
    })
  ]);

  // 3. Chuyển đổi mảng thống kê thành Map để tra cứu nhanh
  const taskMap = new Map(taskStats.map(t => [t.assignee_id, parseInt(t.count, 10)]));
  const reportMap = new Map(reportStats.map(r => [
    r.user_id,
    { total: parseInt(r.total, 10), onTime: parseInt(r.onTime || 0, 10) }
  ]));

  // 4. Trộn dữ liệu và trả về kết quả
  return members.map((m) => {
    const memberData = m.toJSON();
    const userId = m.user_id;

    const isDbLeader =
      memberData.role === PROJECT_ROLES.LEADER || memberData.role === 'LEADER';
    // Chỉ hiển thị LEADER khi DB đã là LEADER và khớp leader_id; ứng viên chủ trì (leader_id + MEMBER) vẫn là member.
    if (userId === leader_id && isDbLeader) {
      memberData.role = PROJECT_ROLES.LEADER;
    } else if (isDbLeader && userId !== leader_id) {
      memberData.role = PROJECT_ROLES.MEMBER;
    }

    const stats = reportMap.get(userId) || { total: 0, onTime: 0 };
    const reportRate = stats.total > 0
      ? Math.round((stats.onTime / stats.total) * 100)
      : 100;

    return {
      ...memberData,
      task_count: taskMap.get(userId) || 0,
      report_rate: reportRate,
    };
  });
};

// Lưu ý: Đảm bảo bạn đã import Commitment và COMMITMENT_STATUS ở đầu file
// const { Project, User, ProjectMember, Commitment } = require('../models');
// const { COMMITMENT_STATUS, AUDIT_ACTIONS } = require('../config/constants');

const addMember = async (projectId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === 'done') {
    throw { status: 400, message: 'Dữ liệu đã khóa! Không thể thêm thành viên khi dự án đã Hoàn thành.' };
  }

  if (user.system_role !== SYSTEM_ROLES.TRUONG_LAB && user.system_role !== SYSTEM_ROLES.VIEN_TRUONG) {
    throw {
      status: 403,
      message: 'Chỉ trưởng lab hoặc viện trưởng mới được mời thêm thành viên.',
    };
  }
  if (project.status !== PROJECT_STATUS.PAUSED) {
    throw {
      status: 400,
      message: 'Chỉ có thể mời thêm thành viên khi dự án đang tạm dừng (paused).',
    };
  }

  // Check user exists
  const targetUser = await User.findByPk(data.user_id);
  if (!targetUser || targetUser.status !== 'active') {
    throw { status: 400, message: 'User not found or not active' };
  }

  // 1. Kiểm tra xem đã là thành viên chính thức chưa
  const existingMember = await ProjectMember.findOne({
    where: { project_id: projectId, user_id: data.user_id },
  });
  if (existingMember) {
    throw { status: 409, message: 'Người dùng này đã là thành viên chính thức của dự án' };
  }

  // 2. Tìm hoặc Tạo mới Cam kết, cho phép gửi lại lời mời nếu đã bị từ chối
  const [commitment, created] = await Commitment.findOrCreate({
    where: {
      project_id: projectId,
      user_id: data.user_id,
    },
    defaults: {
      status: COMMITMENT_STATUS.PENDING_B_APPROVAL,
    },
  });

  if (!created) {
    // Nếu bản cam kết đã tồn tại, kiểm tra trạng thái của nó
    if ([COMMITMENT_STATUS.PENDING_B_APPROVAL, COMMITMENT_STATUS.A_APPROVED].includes(commitment.status)) {
      /** Mời trùng người đang chờ — không 409; gửi lại thông báo để nhắc thành viên. */
      await notifyCommitmentInviteRecipients(project, [
        { id: targetUser.id, email: targetUser.email, full_name: targetUser.full_name },
      ]);
      const plain = typeof commitment.toJSON === 'function' ? commitment.toJSON() : commitment;
      return {
        ...plain,
        alreadyInvited: true,
        message:
          'Người này đã có lời mời đang chờ xác nhận. Đã gửi lại thông báo nhắc.',
      };
    }
    if ([COMMITMENT_STATUS.B_APPROVED, COMMITMENT_STATUS.ACTIVE].includes(commitment.status)) {
      throw { status: 409, message: 'Người dùng này đã đồng ý tham gia dự án.' };
    }
    // Nếu đã bị từ chối (b_rejected), cho phép mời lại bằng cách cập nhật trạng thái
    if (commitment.status === COMMITMENT_STATUS.B_REJECTED) {
      await ensureMemberCanJoinMoreProjects(data.user_id);
      await commitment.update({ status: COMMITMENT_STATUS.PENDING_B_APPROVAL, reject_reason: null });
    }
  } else {
    await ensureMemberCanJoinMoreProjects(data.user_id);
  }

  // 3. Log lại hành động
  await auditService.log(AUDIT_ACTIONS.PROJECT_MEMBER_INVITED, user.id, data.user_id, {
    project_id: projectId,
    note: 'Đã gửi yêu cầu cam kết (Pending B Approval)'
  });

  await notifyCommitmentInviteRecipients(project, [
    { id: targetUser.id, email: targetUser.email, full_name: targetUser.full_name },
  ]);

  return commitment;
};

const removeMember = async (projectId, memberId, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === 'done') {
    throw { status: 400, message: 'Dữ liệu đã khóa! Không thể thêm/xóa thành viên khi dự án đã Hoàn thành.' };
  }

  const accessLevel = await resolveProjectAccess(project, user);
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to remove members' };
  }

  const member = await ProjectMember.findOne({
    where: { id: memberId, project_id: projectId },
  });
  if (!member) throw { status: 404, message: 'Member not found' };

  // Chỉ khóa xóa khi đây là leader đã nhận vai trò chính thức trong ProjectMember.
  const isActualLeader =
    member.user_id === project.leader_id &&
    [PROJECT_ROLES.LEADER, 'LEADER'].includes(member.role);
  if (isActualLeader) {
    throw { status: 400, message: 'Cannot remove the project leader' };
  }

  const t = await sequelize.transaction();
  try {
    await ProjectMember.destroy({
      where: { id: memberId, project_id: projectId },
      transaction: t,
    });

    // Nếu đang gỡ leader candidate (leader_id trỏ tới user nhưng role vẫn member),
    // cần clear candidate để không bị "fix cứng" vào dự án.
    const isLeaderCandidate =
      member.user_id === project.leader_id &&
      ![PROJECT_ROLES.LEADER, 'LEADER'].includes(member.role);
    if (isLeaderCandidate) {
      await project.update(
        {
          leader_id: null,
          awaiting_leader_assignment: true,
        },
        { transaction: t },
      );
    }

    await Commitment.destroy({
      where: { project_id: projectId, user_id: member.user_id },
      transaction: t,
    });

    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }

  await auditService.log(AUDIT_ACTIONS.PROJECT_MEMBER_REMOVED, user.id, member.user_id, {
    project_id: projectId,
  });

  void notifyMemberRemovedFromProject(projectId, member.user_id, user.id);

  return { message: 'Member removed successfully' };
};

// =====================================================
// Milestones
// =====================================================

const listMilestones = async (projectId, user) => {
  await getProjectDetail(projectId, user);

  const milestones = await Milestone.findAll({
    where: { project_id: projectId },
    include: [
      {
        model: Task,
        as: 'linkedTasks',
        attributes: ['id', 'title', 'status'],
        through: { attributes: [] },
      },
      {
        model: Checklist,
        as: 'checklists',
        attributes: ['id', 'title', 'category', 'is_completed', 'completed_at'],
        include: [
          {
            model: ChecklistItem,
            as: 'items',
            attributes: ['id', 'title', 'status'],
            order: [['order_index', 'ASC']],
          },
        ],
      },
    ],
    order: [['due_date', 'ASC']],
  });

  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;

  return {
    progress: { done, total },
    milestones: milestones.map((m) => {
      const ms = m.toJSON();
      const now = new Date();
      const dueDate = new Date(ms.due_date);
      let color = 'gray'; // far away
      if (ms.done) {
        color = dueDate >= (ms.done_at || now) ? 'green' : 'red'; // done on time vs late
      } else {
        const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);
        if (daysUntilDue <= 7) color = 'yellow'; // near deadline
      }
      return { ...ms, color };
    }),
  };
};

const createMilestone = async (projectId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === PROJECT_STATUS.DONE) {
    throw {
      status: 400,
      message: 'Không thể thay đổi Task/Milestone! Dự án đã hoàn thành và dữ liệu đã bị khóa.',
    };
  }

  const accessLevel = await resolveProjectAccess(project, user);
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to create milestones' };
  }

  const milestone = await Milestone.create({
    project_id: projectId,
    title: data.title,
    description: data.description || null,
    due_date: data.due_date,
  });

  // Link tasks if provided (only allow non-done tasks from same project)
  if (data.linked_tasks && data.linked_tasks.length > 0) {
    const validTasks = await Task.findAll({
      where: {
        id: { [Op.in]: data.linked_tasks },
        project_id: projectId,
        status: { [Op.ne]: TASK_STATUS.DONE },
      },
      attributes: ['id'],
    });
    if (validTasks.length !== data.linked_tasks.length) {
      throw { status: 400, message: 'Only non-completed tasks from this project can be linked to a milestone' };
    }

    const links = data.linked_tasks.map((taskId) => ({
      milestone_id: milestone.id,
      task_id: taskId,
    }));
    await MilestoneTask.bulkCreate(links);
  }

  await auditService.log(AUDIT_ACTIONS.MILESTONE_CREATED, user.id, null, {
    project_id: projectId,
    milestone_id: milestone.id,
  });

  void notifyMilestoneCreatedStakeholders(projectId, user.id, milestone.title);

  return milestone;
};

const updateMilestone = async (projectId, milestoneId, data, user) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === PROJECT_STATUS.DONE) {
    throw {
      status: 400,
      message: 'Không thể thay đổi Task/Milestone! Dự án đã hoàn thành và dữ liệu đã bị khóa.',
    };
  }

  const accessLevel = await resolveProjectAccess(project, user);
  if (accessLevel === 'member') {
    throw { status: 403, message: 'You do not have permission to update milestones' };
  }

  const milestone = await Milestone.findOne({
    where: { id: milestoneId, project_id: projectId },
  });
  if (!milestone) throw { status: 404, message: 'Milestone not found' };

  const wasDoneBefore = Boolean(milestone.done);

  // If marking as done
  const updateData = { ...data };
  if (data.done === true && !milestone.done) {
    updateData.done_at = new Date();

    // Check for incomplete linked tasks — return warning but still allow
    const incompleteTasks = await Task.count({
      include: [{
        model: Milestone,
        as: 'milestones',
        where: { id: milestoneId },
        through: { attributes: [] },
      }],
      where: { status: { [Op.ne]: TASK_STATUS.DONE } },
    });

    if (incompleteTasks > 0) {
      updateData._warning = `${incompleteTasks} linked task(s) are not yet done`;
    }
  }

  // Update linked tasks if provided (only allow non-done tasks from same project)
  if (data.linked_tasks) {
    if (data.linked_tasks.length > 0) {
      const validTasks = await Task.findAll({
        where: {
          id: { [Op.in]: data.linked_tasks },
          project_id: projectId,
          status: { [Op.ne]: TASK_STATUS.DONE },
        },
        attributes: ['id'],
      });
      if (validTasks.length !== data.linked_tasks.length) {
        throw { status: 400, message: 'Only non-completed tasks from this project can be linked to a milestone' };
      }
    }

    await MilestoneTask.destroy({ where: { milestone_id: milestoneId } });
    if (data.linked_tasks.length > 0) {
      const links = data.linked_tasks.map((taskId) => ({
        milestone_id: milestoneId,
        task_id: taskId,
      }));
      await MilestoneTask.bulkCreate(links);
    }
    delete updateData.linked_tasks;
  }

  const warning = updateData._warning;
  delete updateData._warning;

  await milestone.update(updateData);

  await auditService.log(AUDIT_ACTIONS.MILESTONE_UPDATED, user.id, null, {
    project_id: projectId,
    milestone_id: milestoneId,
    changes: data,
  });

  if (updateData.done === true && !wasDoneBefore) {
    void notifyMilestoneCompletedStakeholders(projectId, user.id, milestone.title);
  }

  const result = milestone.toJSON();
  if (warning) result.warning = warning;
  return result;
};

// =====================================================
// Weekly Reports
// =====================================================

const listReports = async (projectId, { week_number, year, user_id, page = 1, limit = 50 }, user) => {
  await getProjectDetail(projectId, user);

  const where = { project_id: projectId };
  if (week_number) where.week_number = week_number;
  if (year) where.year = year;
  if (user_id) where.user_id = user_id;

  const offset = (page - 1) * limit;

  const { rows, count } = await WeeklyReport.findAndCountAll({
    where,
    include: [
      { model: User, as: 'author', attributes: ['id', 'full_name', 'email'] },
    ],
    order: [['year', 'DESC'], ['week_number', 'DESC']],
    limit,
    offset,
  });

  const reports = rows.map((row) => {
    const plain = row.toJSON();
    const parsed = parseReportContentPayload(plain.content);
    return {
      ...plain,
      content: parsed.text || null,
      source_type: parsed.source_type,
      file_url: parsed.file_url,
      file_name: parsed.file_name,
      file_mime: parsed.file_mime,
      link_url: parsed.link_url,
      selected_tasks: parsed.selected_tasks || [],
      user: plain.author || null,
    };
  });

  return {
    reports,
    pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
};

const getComplianceMatrix = async (projectId, { weeks = 8 }, user) => {
  await getProjectDetail(projectId, user);

  // Get all project members
  const members = await ProjectMember.findAll({
    where: { project_id: projectId },
    include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }],
  });

  // Get reports for the last N weeks
  const now = new Date();
  const reports = await WeeklyReport.findAll({
    where: {
      project_id: projectId,
      created_at: { [Op.gte]: new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000) },
    },
  });

  // Build matrix: member × week
  const matrix = members.map((m) => {
    const memberReports = reports.filter((r) => r.user_id === m.user_id);
    return {
      user: m.user,
      weeks: memberReports.map((r) => ({
        week_number: r.week_number,
        year: r.year,
        status: r.status,
      })),
    };
  });

  return matrix;
};

const createReport = async (projectId, data, user) => {
  const membership = await isProjectMember(projectId, user.id);
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  if (project.status === 'done') {
    throw {
      status: 400,
      message: 'Không thể thay đổi Task/Report! Dự án đã hoàn thành, mọi dữ liệu hiệu suất đã được ĐÓNG BĂNG để phục vụ tính lương.'
    };
  }

  if (!membership && project.leader_id !== user.id) {
    throw {
      status: 403,
      message:
        'Bạn không phải thành viên hoặc trưởng dự án — không thể tạo báo cáo cho dự án này.',
    };
  }

  // Check duplicate
  const existing = await WeeklyReport.findOne({
    where: {
      project_id: projectId,
      user_id: user.id,
      week_number: data.week_number,
      year: data.year,
    },
  });
  if (existing) {
    throw { status: 409, message: 'Report for this week already submitted' };
  }

  let sourceType = data.source_type || 'text';
  let fileUrl = null;
  let fileName = null;
  let fileMime = null;
  let linkUrl = null;
  const selectedTaskIds = normalizeTaskIds(data.task_ids);
  let selectedTasks = [];

  if (selectedTaskIds.length === 0) {
    throw { status: 400, message: 'Vui lòng chọn ít nhất 1 task đã hoàn thành cho báo cáo.' };
  }

  const doneTasks = await Task.findAll({
    where: {
      id: { [Op.in]: selectedTaskIds },
      project_id: projectId,
      assignee_id: user.id,
      status: TASK_STATUS.DONE,
    },
    attributes: ['id', 'title'],
  });
  if (doneTasks.length !== selectedTaskIds.length) {
    throw {
      status: 400,
      message: 'Chỉ được chọn các task đã hoàn thành và thuộc về người nộp báo cáo.',
    };
  }
  selectedTasks = doneTasks.map((task) => ({ id: task.id, title: task.title }));

  if (data.file) {
    if (!isConfigured()) {
      throw {
        status: 500,
        message: 'Cloudinary chưa cấu hình. Không thể upload file báo cáo.',
      };
    }
    const uploaded = await uploadBuffer(data.file.buffer, {
      folder: 'vkslab/weekly-reports',
      resource_type: 'raw',
      originalFilename: data.file.originalname,
    });
    sourceType = 'upload';
    fileUrl = uploaded.secure_url;
    fileName = data.file.originalname || null;
    fileMime = data.file.mimetype || null;
  } else if (data.link_url) {
    sourceType = 'link';
    linkUrl = data.link_url;
    fileUrl = data.link_url;
  }

  const normalizedContent = buildReportStorageContent({
    text: data.content || '',
    sourceType,
    fileUrl,
    fileName,
    fileMime,
    linkUrl,
    selectedTasks,
  });

  // Determine due date (Sunday of that week) and status
  const dueDate = getWeekEndDate(data.year, data.week_number);
  const isLate = new Date() > dueDate;

  const report = await WeeklyReport.create({
    project_id: projectId,
    user_id: user.id,
    week_number: data.week_number,
    year: data.year,
    content: normalizedContent,
    status: isLate ? 'late' : 'submitted',
    submitted_at: new Date(),
    due_date: dueDate,
  });

  const plain = report.toJSON();
  const parsed = parseReportContentPayload(plain.content);
  void notifyWeeklyReportSubmitted(projectId, user.id, plain, project.name);
  return {
    ...plain,
    content: parsed.text || null,
    source_type: parsed.source_type,
    file_url: parsed.file_url,
    file_name: parsed.file_name,
    file_mime: parsed.file_mime,
    link_url: parsed.link_url,
    selected_tasks: parsed.selected_tasks || [],
  };
};

const getReportPreview = async (projectId, reportId, user) => {
  await getProjectDetail(projectId, user);

  const report = await WeeklyReport.findOne({
    where: { id: reportId, project_id: projectId },
  });
  if (!report) {
    throw { status: 404, message: 'Không tìm thấy báo cáo tuần' };
  }

  const parsed = parseReportContentPayload(report.content);
  const sourceType = parsed.source_type || 'text';
  const fileUrl = parsed.file_url || parsed.link_url;
  if (!fileUrl || !/^https?:\/\//i.test(String(fileUrl))) {
    throw { status: 404, message: 'Báo cáo này không có tệp để xem trực tiếp' };
  }
  if (!['upload', 'link'].includes(sourceType)) {
    throw { status: 400, message: 'Định dạng báo cáo không hỗ trợ xem trực tiếp' };
  }

  return fetchReportFileBuffer(fileUrl);
};

/**
 * Get the Sunday date for a given ISO week number
 */
function getWeekEndDate(year, weekNumber) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

// =====================================================
// Git Repository (truong_lab only)
// =====================================================

const getGitRepo = async (projectId, user) => {
  if (user.system_role !== SYSTEM_ROLES.TRUONG_LAB) {
    throw { status: 403, message: 'Forbidden' };
  }

  const project = await Project.findByPk(projectId, {
    attributes: [
      'id', 'code', 'git_repo_url', 'git_provider', 'git_default_branch',
      'git_visibility', 'git_last_commit_sha', 'git_last_commit_author',
      'git_last_commit_message', 'git_last_commit_date',
    ],
  });

  if (!project) throw { status: 404, message: 'Project not found' };

  return {
    repo_url: project.git_repo_url,
    provider: project.git_provider,
    default_branch: project.git_default_branch,
    visibility: project.git_visibility,
    last_commit: project.git_last_commit_sha ? {
      sha: project.git_last_commit_sha.substring(0, 7),
      author: project.git_last_commit_author,
      message: project.git_last_commit_message,
      date: project.git_last_commit_date,
    } : null,
  };
};

const updateGitRepo = async (projectId, data, user) => {
  if (user.system_role !== SYSTEM_ROLES.TRUONG_LAB) {
    throw { status: 403, message: 'Forbidden' };
  }

  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  await project.update({
    git_repo_url: data.git_repo_url,
    git_provider: data.git_provider,
    git_default_branch: data.git_default_branch || 'main',
    git_visibility: data.git_visibility || 'private',
  });

  return { message: 'Git repository updated', repo_url: project.git_repo_url };
};

const handleGitWebhook = async (projectId, data) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Project not found' };

  await project.update({
    git_last_commit_sha: data.sha,
    git_last_commit_author: data.author,
    git_last_commit_message: data.message,
    git_last_commit_date: data.timestamp,
  });

  return { message: 'Webhook processed' };
};

const searchActiveUsers = async (query, options = {}) => {
  const { excludeVienTruong = false, partyAOnly = false, checkCapacity = false } = options;
  const andParts = [{ status: 'active' }];
  if (partyAOnly) {
    andParts.push({
      system_role: { [Op.in]: [SYSTEM_ROLES.VIEN_TRUONG, SYSTEM_ROLES.TRUONG_LAB] },
    });
  } else if (excludeVienTruong) {
    andParts.push({ system_role: { [Op.ne]: SYSTEM_ROLES.VIEN_TRUONG } });
  }
  const q = query && String(query).trim();
  if (q) {
    andParts.push({
      [Op.or]: [
        { full_name: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
      ],
    });
  }
  const users = await User.findAll({
    where: { [Op.and]: andParts },
    attributes: ['id', 'full_name', 'email', 'system_role', 'department'],
    limit: 20,
    order: [['full_name', 'ASC']],
  });

  if (!checkCapacity) return users;

  const out = [];
  for (const u of users) {
    const row = u.toJSON ? u.toJSON() : { ...u };
    if (row.system_role === SYSTEM_ROLES.MEMBER) {
      const cnt = await countMemberConfirmedActiveProjects(row.id);
      row.at_project_limit = cnt >= PROJECT_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER;
    } else {
      row.at_project_limit = false;
    }
    out.push(row);
  }
  return out;
};

// Thêm 2 hàm này vào file project.service.js của bạn

const joinProject = async (projectId, userId) => {
  const transaction = await sequelize.transaction();
  try {
    const project = await Project.findByPk(projectId, { transaction });
    if (!project) {
      throw { status: 404, message: 'Dự án không tồn tại.' };
    }

    const existingMember = await ProjectMember.findOne({
      where: { project_id: projectId, user_id: userId },
      transaction
    });
    if (existingMember) {
      throw { status: 400, message: 'Bạn đã là thành viên của dự án này rồi.' };
    }

    const existingCommitment = await Commitment.findOne({
      where: { project_id: projectId, user_id: userId },
      transaction,
    });

    const tagInvitePending =
      project.participation_mode === 'TAG' &&
      existingCommitment?.status === COMMITMENT_STATUS.PENDING_B_APPROVAL;
    const joinAllowedByStatus =
      project.status === PROJECT_STATUS.PLANNING ||
      (project.status === PROJECT_STATUS.PAUSED && tagInvitePending);

    if (!joinAllowedByStatus) {
      throw { status: 400, message: 'Dự án không còn ở trạng thái cho phép tham gia.' };
    }

    if (project.participation_mode === 'SELF_JOIN') {
      const memberCount = await ProjectMember.count({ where: { project_id: projectId }, transaction });
      if (project.required_members && memberCount >= project.required_members) {
        throw { status: 400, message: 'Dự án đã đủ số lượng thành viên.' };
      }
    } else {
      if (!existingCommitment || existingCommitment.status !== COMMITMENT_STATUS.PENDING_B_APPROVAL) {
        throw { status: 400, message: 'Bạn không có lời mời hợp lệ để tham gia dự án này.' };
      }
    }

    await ensureMemberCanJoinMoreProjects(userId, transaction, { asSelf: true });

    // 1. Thêm vào bảng ProjectMember
    await ProjectMember.create({
      project_id: projectId,
      user_id: userId,
      role: PROJECT_ROLES.MEMBER,
      joined_at: new Date(),
    }, { transaction });

    // Tìm hoặc tạo mới bản cam kết và đảm bảo nó ở trạng thái B_APPROVED
    const [commitment] = await Commitment.findOrCreate({
      where: { project_id: projectId, user_id: userId },
      defaults: { status: COMMITMENT_STATUS.B_APPROVED },
      transaction
    });
    await commitment.update({
      status: COMMITMENT_STATUS.B_APPROVED,
      reject_reason: null,
    }, { transaction });
    
    // --- LOGIC MỚI: GHI LOG AUDIT ---
    await auditService.log(AUDIT_ACTIONS.PROJECT_MEMBER_JOINED, userId, null, {
        project_id: projectId,
        note: 'Tự nguyện tham gia dự án.'
    }, { transaction });


    await transaction.commit();
    void notifyAfterJoinProject(projectId, userId);
    return { message: 'Đã tham gia dự án và xác nhận cam kết thành công.' };

  } catch (error) {
    await transaction.rollback();
    if (error.status) throw error;
    throw { status: 500, message: error.message };
  }
};
const rejectProject = async (projectId, userId, reason) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Dự án không tồn tại.' };

  const t = await sequelize.transaction();
  try {
    const pmAtReject = await ProjectMember.findOne({
      where: { project_id: projectId, user_id: userId },
      transaction: t,
      attributes: ['role'],
    });
    const isActualLeaderRejecting =
      project.leader_id === userId &&
      pmAtReject &&
      [PROJECT_ROLES.LEADER, 'LEADER'].includes(pmAtReject.role);

    // Nếu người từ chối là LEADER đã nhận vai trò chính thức
    if (isActualLeaderRejecting) {
      // 1. Gỡ chủ trì, giữ planning + cờ chờ chỉ định (thành viên vẫn xử lý cam kết / lời mời)
      await project.update({
        leader_id: null,
        status: PROJECT_STATUS.PLANNING,
        awaiting_leader_assignment: true,
      }, { transaction: t });

      // 2. Cập nhật trạng thái Cam kết của Leader này thành Từ chối
      await Commitment.update(
        { status: COMMITMENT_STATUS.B_REJECTED, reject_reason: `Leader từ chối: ${reason}` },
        { where: { project_id: projectId, user_id: userId }, transaction: t }
      );

      // 3. Xóa Leader khỏi bảng ProjectMember
      await ProjectMember.destroy({
        where: { project_id: projectId, user_id: userId },
        transaction: t
      });

      await t.commit();
      void notifyProjectRejectStakeholders(projectId, userId, reason, 'leader_resigned');
      return { message: 'Leader đã từ chối. Dự án đang lập kế hoạch và chờ chỉ định chủ trì mới.' };
    }

    // --- Logic cho member thường (bao gồm cả leader candidate chưa accept role) ---
    if (project.leader_id === userId) {
      await project.update(
        {
          leader_id: null,
          awaiting_leader_assignment: true,
        },
        { transaction: t },
      );
    }

    await Commitment.update(
      { status: COMMITMENT_STATUS.B_REJECTED, reject_reason: reason },
      { where: { project_id: projectId, user_id: userId }, transaction: t }
    );
    // Lưu ý: Member bình thường chưa có trong ProjectMember nên không cần destroy (hoặc destroy nếu có)
    await ProjectMember.destroy({
      where: { project_id: projectId, user_id: userId },
      transaction: t
    });

    await t.commit();
    void notifyProjectRejectStakeholders(projectId, userId, reason, 'member_invite');
    return { message: 'Đã từ chối tham gia.' };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

const assignNewLeader = async (projectId, newLeaderId, adminId) => {
  const project = await Project.findByPk(projectId);
  if (!project) throw { status: 404, message: 'Dự án không tồn tại.' };

  const t = await sequelize.transaction();
  try {
    await ensureMemberCanJoinMoreProjects(newLeaderId, t, { excludeProjectId: projectId });

    await demoteOtherProjectLeaders(projectId, newLeaderId, t);

    // 1. Chỉ định chủ trì mới — giữ nguyên trạng thái dự án (active/paused/planning), không kéo về planning.
    await project.update({
      leader_id: newLeaderId,
      awaiting_leader_assignment: false,
    }, { transaction: t });

    // 2. Thêm Leader mới vào ProjectMember (nếu chưa có); chuẩn hóa role 'leader'
    const [pmRow] = await ProjectMember.findOrCreate({
      where: { project_id: projectId, user_id: newLeaderId },
      defaults: { role: PROJECT_ROLES.LEADER, joined_at: new Date() },
      transaction: t,
    });
    if (pmRow.role !== PROJECT_ROLES.LEADER) {
      await pmRow.update({ role: PROJECT_ROLES.LEADER }, { transaction: t });
    }

    // 3. Tạo hoặc cập nhật Bản Cam Kết cho Leader mới thành B_APPROVED
    const [commitment, created] = await Commitment.findOrCreate({
      where: { project_id: projectId, user_id: newLeaderId },
      defaults: { status: 'b_approved' },
      transaction: t
    });

    if (!created) {
      // Nếu đã tồn tại, chỉ cần cập nhật lại trạng thái
      await commitment.update({
        status: 'b_approved',
        reject_reason: null // Xóa lý do từ chối cũ
      }, { transaction: t });
    }

    await auditService.log('PROJECT_LEADER_CHANGED', adminId, null, {
      project_id: projectId,
      new_leader_id: newLeaderId
    }, { transaction: t });

    await t.commit();
    void notifyNewLeaderAssigned(projectId, newLeaderId, adminId);
    return { message: 'Đã chỉ định chủ trì dự án mới.' };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

module.exports = {
  listProjects,
  batchProjectIdsWhereLeaderUserIsShown,
  countActiveProjectsPublic,
  checkCodeExists,
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
  listMilestones,
  createMilestone,
  updateMilestone,
  listReports,
  getComplianceMatrix,
  createReport,
  getReportPreview,
  getGitRepo,
  updateGitRepo,
  handleGitWebhook,
  searchActiveUsers,
  joinProject,
  rejectProject,
  acceptLeaderRole,
  declineLeaderRole,
  assignNewLeader,
  notifyCommitmentResponseStakeholders,
  notifyAfterJoinProject,
  notifyProjectRejectStakeholders,
};