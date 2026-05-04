const { Op } = require('sequelize');
const { User, ApprovalRequest, AuditLog, sequelize } = require('../models');
const { APPROVAL_STATUS, USER_STATUS, AUDIT_ACTIONS, SYSTEM_ROLES } = require('../config/constants');
const { sendMail, emailTemplates } = require('../utils/email');
const auditService = require('./audit.service');

const normalizePagination = ({ page = 1, limit = 20 }) => {
  const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(200, Math.max(1, Number(limit))) : 20;
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

const getApprovalRequests = async ({ status, page = 1, limit = 20 }) => {
  const where = {};
  if (status) where.status = status;

  const { page: safePage, limit: safeLimit, offset } = normalizePagination({ page, limit });

  const { rows, count } = await ApprovalRequest.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'student_code', 'department', 'status', 'email_verified', 'created_at'],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return {
    requests: rows,
    pagination: {
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
};

const approveUser = async (requestId, adminId, { system_role, review_note }) => {
  if (system_role === SYSTEM_ROLES.ADMIN) {
    throw { status: 400, message: 'Cannot assign admin role in approval flow' };
  }
  if (system_role !== SYSTEM_ROLES.USER) {
    throw { status: 403, message: 'Admin approval may only assign the basic user role' };
  }

  let approvedUser = null;
  await sequelize.transaction(async (transaction) => {
    const request = await ApprovalRequest.findByPk(requestId, {
      include: [{ model: User, as: 'user' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) throw { status: 404, message: 'Approval request not found' };
    if (request.status !== APPROVAL_STATUS.PENDING) {
      throw { status: 400, message: 'This request has already been processed' };
    }

    const user = request.user;
    await request.update(
      {
        status: APPROVAL_STATUS.APPROVED,
        reviewed_by: adminId,
        review_note: review_note || null,
      },
      { transaction },
    );

    await user.update(
      { status: USER_STATUS.ACTIVE, system_role },
      { transaction },
    );
    approvedUser = user;
  });

  if (approvedUser) {
    const template = emailTemplates.approvalSuccess(approvedUser.full_name, system_role);
    sendMail(approvedUser.email, template.subject, template.html);
    await auditService.log(AUDIT_ACTIONS.APPROVAL_APPROVED, adminId, approvedUser.id, {
      system_role,
      review_note,
    });
    return { message: `User ${approvedUser.full_name} approved with role: ${system_role}` };
  }
  return { message: 'Approved' };
};

const rejectUser = async (requestId, adminId, { review_note }) => {
  let rejectedUser = null;
  await sequelize.transaction(async (transaction) => {
    const request = await ApprovalRequest.findByPk(requestId, {
      include: [{ model: User, as: 'user' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!request) throw { status: 404, message: 'Approval request not found' };
    if (request.status !== APPROVAL_STATUS.PENDING) {
      throw { status: 400, message: 'This request has already been processed' };
    }

    const user = request.user;
    await request.update(
      {
        status: APPROVAL_STATUS.REJECTED,
        reviewed_by: adminId,
        review_note: review_note || null,
      },
      { transaction },
    );

    await user.update({ status: USER_STATUS.REJECTED }, { transaction });
    rejectedUser = user;
  });

  if (rejectedUser) {
    const template = emailTemplates.approvalRejected(rejectedUser.full_name, review_note);
    sendMail(rejectedUser.email, template.subject, template.html);
    await auditService.log(AUDIT_ACTIONS.APPROVAL_REJECTED, adminId, rejectedUser.id, {
      review_note,
    });
    return { message: `User ${rejectedUser.full_name} has been rejected` };
  }
  return { message: 'Rejected' };
};

const getUsers = async ({ status, role, search, page = 1, limit = 20 }) => {
  const where = {};
  if (status) where.status = status;
  if (role) where.system_role = role;
  if (search) {
    where[Op.or] = [
      { full_name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { student_code: { [Op.like]: `%${search}%` } },
    ];
  }
  const { page: safePage, limit: safeLimit, offset } = normalizePagination({ page, limit });

  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: [
      'id',
      'full_name',
      'email',
      'student_code',
      'department',
      'system_role',
      'status',
      'email_verified',
      'created_at',
      'updated_at',
    ],
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return {
    users: rows,
    pagination: {
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
};

const banUser = async (userId, adminId) => {
  if (userId === adminId) throw { status: 400, message: 'You cannot ban your own account' };
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.system_role === SYSTEM_ROLES.ADMIN) throw { status: 403, message: 'Cannot ban admin account' };

  const previousStatus = user.status;
  await user.update({ status: USER_STATUS.LOCKED });
  await auditService.log('USER_BANNED', adminId, user.id, { previous_status: previousStatus });
  return { message: `User ${user.full_name} has been banned` };
};

const unbanUser = async (userId, adminId) => {
  const user = await User.findByPk(userId);
  if (!user) throw { status: 404, message: 'User not found' };
  if (user.system_role === SYSTEM_ROLES.ADMIN) throw { status: 403, message: 'Cannot unban admin account' };

  const previousStatus = user.status;
  await user.update({ status: USER_STATUS.ACTIVE });
  await auditService.log('USER_UNBANNED', adminId, user.id, { previous_status: previousStatus });
  return { message: `User ${user.full_name} has been unbanned` };
};

const getAuditLogs = async ({ action, page = 1, limit = 50 }) => {
  const where = {};
  if (action) where.action = { [Op.like]: `%${action}%` };
  const { page: safePage, limit: safeLimit, offset } = normalizePagination({ page, limit });

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [
      { model: User, as: 'performer', attributes: ['id', 'full_name', 'email'], required: false },
      { model: User, as: 'target', attributes: ['id', 'full_name', 'email'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  const logs = rows.map((row) => {
    const json = row.toJSON();
    let metadata = null;
    if (json.metadata_json) {
      try {
        metadata = JSON.parse(json.metadata_json);
      } catch {
        metadata = json.metadata_json;
      }
    }
    return { ...json, metadata };
  });

  return {
    logs,
    pagination: {
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
};

module.exports = {
  getApprovalRequests,
  approveUser,
  rejectUser,
  getUsers,
  banUser,
  unbanUser,
  getAuditLogs,
};
