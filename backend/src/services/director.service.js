const { Op } = require('sequelize');
const { User } = require('../models');
const { USER_STATUS, SYSTEM_ROLES, AUDIT_ACTIONS } = require('../config/constants');
const auditService = require('./audit.service');

const normalizePagination = ({ page = 1, limit = 20 }) => {
  const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;
  const safeLimit = Number.isFinite(limit) ? Math.min(200, Math.max(1, Number(limit))) : 20;
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

/** Chỉ thành viên lab / trưởng lab (không liệt kê admin, viện trưởng, user cơ bản). */
const MANAGEABLE_ROLES = [SYSTEM_ROLES.MEMBER, SYSTEM_ROLES.TRUONG_LAB];

const listLabStaff = async ({ role, search, page = 1, limit = 20 }) => {
  const roleClause =
    role && MANAGEABLE_ROLES.includes(role) ? role : { [Op.in]: MANAGEABLE_ROLES };

  const where = { system_role: roleClause };

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
    order: [['full_name', 'ASC']],
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

/**
 * Viện trưởng: member → truong_lab (bổ nhiệm) hoặc truong_lab → member (thu hồi).
 */
const updateLabStaffRole = async (directorId, targetUserId, { system_role, note }) => {
  if (directorId === targetUserId) {
    throw { status: 400, message: 'Cannot change your own system role' };
  }

  const target = await User.findByPk(targetUserId);
  if (!target) throw { status: 404, message: 'User not found' };

  if ([SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.VIEN_TRUONG].includes(target.system_role)) {
    throw { status: 403, message: 'This account cannot be modified through this action' };
  }

  if (!MANAGEABLE_ROLES.includes(target.system_role)) {
    throw { status: 400, message: 'Only lab members or lab heads can be updated here' };
  }

  const prev = target.system_role;
  const allowed =
    (prev === SYSTEM_ROLES.MEMBER && system_role === SYSTEM_ROLES.TRUONG_LAB) ||
    (prev === SYSTEM_ROLES.TRUONG_LAB && system_role === SYSTEM_ROLES.MEMBER);

  if (!allowed) {
    throw {
      status: 400,
      message: 'Director may only promote a lab member to lab head, or demote a lab head to lab member',
    };
  }

  if (system_role === SYSTEM_ROLES.TRUONG_LAB && target.status !== USER_STATUS.ACTIVE) {
    throw { status: 400, message: 'Only active lab members can be promoted to lab head' };
  }

  if (prev === system_role) {
    return { user: target, message: 'No change' };
  }

  await target.update({ system_role: system_role });
  await auditService.log(AUDIT_ACTIONS.SYSTEM_ROLE_CHANGED, directorId, target.id, {
    from: prev,
    to: system_role,
    note: note || null,
  });

  return {
    message: `Updated ${target.full_name} role to ${system_role}`,
    user: {
      id: target.id,
      full_name: target.full_name,
      email: target.email,
      student_code: target.student_code,
      department: target.department,
      system_role: target.system_role,
      status: target.status,
    },
  };
};

module.exports = {
  listLabStaff,
  updateLabStaffRole,
};
