const { ProjectMember } = require('../models');
const { SYSTEM_ROLES, PROJECT_ROLES } = require('../config/constants');

/** Một số bản ghi cũ lưu nhầm `'LEADER'` thay vì `PROJECT_ROLES.LEADER` (`'leader'`). */
const isLeaderRoleValue = (role) =>
  role === PROJECT_ROLES.LEADER || role === 'LEADER';

/**
 * Quyền ghi dự án: admin đầy đủ; chủ trì (khớp leader_id) khi đã đủ điều kiện tương ứng frontend
 * (role LEADER trong ProjectMember, hoặc chủ trì với cam kết đã chấp nhận / không có bản cam kết legacy).
 */
async function resolveProjectAccess(project, user) {
  if ([SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG].includes(user.system_role)) {
    return 'admin';
  }
  if (project.leader_id === user.id) {
    const pm = await ProjectMember.findOne({
      where: { project_id: project.id, user_id: user.id },
      attributes: ['role'],
    });
    if (!pm) {
      return 'member';
    }
    if (isLeaderRoleValue(pm.role)) {
      return 'leader';
    }
    // TAG flow: `leader_id` can be only a candidate before accepting leader role.
    // Candidate with ProjectMember.role=member must not get leader privileges.
    return 'member';
  }
  return 'member';
}

module.exports = { resolveProjectAccess, isLeaderRoleValue };
