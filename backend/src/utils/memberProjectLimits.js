const { Op } = require('sequelize');
const { Project, ProjectMember, Commitment, User } = require('../models');
const {
  PROJECT_STATUS,
  COMMITMENT_STATUS,
  PROJECT_LIMITS,
  SYSTEM_ROLES,
} = require('../config/constants');

const ACTIVE_PROJECT_STATUSES = [PROJECT_STATUS.PLANNING, PROJECT_STATUS.ACTIVE, PROJECT_STATUS.PAUSED];

/**
 * Đếm số dự án (planning/active/paused) user **đã tham gia nhóm** (có ProjectMember sau khi chấp nhận cam kết / join).
 * Không tính chỉ được tag `leader_id` hoặc chỉ có cam kết pending (chưa vào danh sách thành viên).
 * Dùng cho giới hạn mời thành viên / join / assign leader.
 *
 * @param {object} [options]
 * @param {string} [options.excludeProjectId]
 */
async function countMemberConfirmedActiveProjects(userId, transaction = undefined, options = {}) {
  const { excludeProjectId } = options;

  const membershipRows = await ProjectMember.findAll({
    where: { user_id: userId },
    attributes: ['project_id'],
    transaction,
  });

  const memberPids = [...new Set(membershipRows.map((m) => m.project_id))];
  let activeMemberProjectIds = [];
  if (memberPids.length > 0) {
    const rows = await Project.findAll({
      where: {
        id: { [Op.in]: memberPids },
        status: { [Op.in]: ACTIVE_PROJECT_STATUSES },
      },
      attributes: ['id'],
      transaction,
    });
    activeMemberProjectIds = rows.map((r) => r.id);
  }

  /** Chỉ đếm khi đã có ProjectMember (đã chấp nhận tham gia). Không tính chỉ `leader_id` chưa vào nhóm. */
  let ids = [...new Set([...activeMemberProjectIds])];
  if (excludeProjectId) {
    ids = ids.filter((id) => id !== excludeProjectId);
  }
  return ids.length;
}

/**
 * Đếm số dự án (planning/active/paused) mà user đang gắn với tư cách:
 * leader, thành viên (ProjectMember), hoặc có cam kết chưa hủy (trừ b_rejected / terminated).
 * Trùng cùng một dự án chỉ tính một lần.
 * (Dùng khi cần bao gồm cả lời mời cam kết chưa phản hồi — vd. thống kê tổng phơi nhiễm.)
 *
 * @param {object} [options]
 * @param {string} [options.excludeProjectId] — Bỏ qua dự án này khi đếm (vd: chỉ định chủ trì trên dự án user đã tham gia — không tính là “thêm dự án mới”).
 */
async function countMemberActiveProjectParticipation(userId, transaction = undefined, options = {}) {
  const { excludeProjectId } = options;
  const leaderProjects = await Project.findAll({
    where: { leader_id: userId, status: { [Op.in]: ACTIVE_PROJECT_STATUSES } },
    attributes: ['id'],
    transaction,
  });

  const membershipRows = await ProjectMember.findAll({
    where: { user_id: userId },
    attributes: ['project_id'],
    transaction,
  });

  const commitmentRows = await Commitment.findAll({
    where: {
      user_id: userId,
      status: { [Op.notIn]: [COMMITMENT_STATUS.B_REJECTED, COMMITMENT_STATUS.TERMINATED] },
    },
    attributes: ['project_id'],
    transaction,
  });

  let candidateIds = [
    ...new Set([
      ...leaderProjects.map((p) => p.id),
      ...membershipRows.map((m) => m.project_id),
      ...commitmentRows.map((c) => c.project_id),
    ]),
  ];

  if (excludeProjectId) {
    candidateIds = candidateIds.filter((id) => id !== excludeProjectId);
  }

  if (candidateIds.length === 0) return 0;

  return Project.count({
    where: {
      id: { [Op.in]: candidateIds },
      status: { [Op.in]: ACTIVE_PROJECT_STATUSES },
    },
    transaction,
  });
}

async function assertMemberUnderProjectLimit(userId, transaction = undefined, options = {}) {
  const { asSelf = false, excludeProjectId } = options;
  const targetUser = await User.findByPk(userId, {
    attributes: ['id', 'system_role'],
    transaction,
  });
  if (!targetUser || targetUser.system_role !== SYSTEM_ROLES.MEMBER) return;

  const activeProjectCount = await countMemberConfirmedActiveProjects(userId, transaction, {
    excludeProjectId,
  });
  if (activeProjectCount >= PROJECT_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER) {
    const max = PROJECT_LIMITS.MAX_ACTIVE_PROJECTS_PER_USER;
    const scope = `tối đa ${max} dự án cùng lúc (lập kế hoạch, đang hoạt động hoặc tạm dừng)`;
    const message = asSelf
      ? `Bạn đang tham gia các dự án khác và đã đạt giới hạn (${scope}). Không thể tham gia thêm dự án này.`
      : `Thành viên này đang tham gia các dự án khác và đã đạt giới hạn (${scope}). Không thể mời thêm thành viên này.`;
    throw {
      status: 400,
      message,
      code: 'MEMBER_PROJECT_LIMIT_REACHED',
    };
  }
}

module.exports = {
  countMemberActiveProjectParticipation,
  countMemberConfirmedActiveProjects,
  assertMemberUnderProjectLimit,
  ACTIVE_PROJECT_STATUSES,
};
