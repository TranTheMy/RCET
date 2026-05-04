const { Op, QueryTypes } = require('sequelize');
const {
  ScientistApplication,
  User,
  sequelize,
} = require('../models');
const {
  SYSTEM_ROLES,
  SCIENTIST_APPLICATION_STATUS: S,
  USER_STATUS,
} = require('../config/constants');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');
const { buildContractDocxBuffer } = require('../utils/scientistContractDoc');
const { sendMail, emailTemplates } = require('../utils/email');
const logger = require('../utils/logger');
const realtimeService = require('./realtime.service');
const notificationService = require('./notification.service');

function toDto(row) {
  if (!row) return null;
  const j = row.get ? row.get({ plain: true }) : row;
  return {
    id: j.id,
    userId: j.user_id,
    fullName: j.full_name,
    email: j.email,
    position: j.position,
    phone: j.phone,
    portfolioUrl: j.portfolio_url,
    coverLetter: j.cover_letter,
    fileUrl: j.file_url,
    status: j.status,
    labReviewedBy: j.lab_reviewed_by,
    labComment: j.lab_comment,
    labReviewedAt: j.lab_reviewed_at ? new Date(j.lab_reviewed_at).toISOString() : null,
    directorReviewedBy: j.director_reviewed_by,
    directorComment: j.director_comment,
    directorReviewedAt: j.director_reviewed_at ? new Date(j.director_reviewed_at).toISOString() : null,
    contractSummary: j.contract_summary,
    contractFileUrl: j.contract_file_url,
    contractCreatedAt: j.contract_created_at ? new Date(j.contract_created_at).toISOString() : null,
    contractCreatedBy: j.contract_created_by,
    contractConfirmedAt: j.contract_confirmed_at ? new Date(j.contract_confirmed_at).toISOString() : null,
    contractConfirmedBy: j.contract_confirmed_by,
    createdAt: j.created_at ? new Date(j.created_at).toISOString() : null,
    updatedAt: j.updated_at ? new Date(j.updated_at).toISOString() : null,
  };
}

function emitListChanged() {
  realtimeService.broadcastScientistApplicationListChanged();
}

function truncateNotifyText(s, max = 220) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Chỉ giữ chữ số — dùng cho lưu trữ & so trùng */
function normalizePhoneDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Khoảng cách tối thiểu giữa hai lần nộp hồ sơ (cùng user) */
const SUBMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

class ScientistApplicationService {
  /**
   * SĐT không trùng user khác (Users.phone_number) và hồ sơ ứng viên khác (ScientistApplications.phone).
   * Trả về chuỗi chữ số để lưu DB hoặc null nếu bỏ trống.
   */
  async assertPhoneUniqueForApplicant(userId, rawPhone) {
    const phoneDigits = normalizePhoneDigits(rawPhone);
    if (!phoneDigits) return null;
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      const err = new Error('Số điện thoại không hợp lệ (8–15 chữ số)');
      err.status = 400;
      throw err;
    }
    const userRows = await User.findAll({
      where: {
        id: { [Op.ne]: userId },
        phone_number: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      },
      attributes: ['id', 'phone_number'],
    });
    for (const u of userRows) {
      if (normalizePhoneDigits(u.phone_number) === phoneDigits) {
        const err = new Error('Số điện thoại đã được đăng ký cho tài khoản khác');
        err.status = 409;
        throw err;
      }
    }
    const appRows = await ScientistApplication.findAll({
      where: {
        user_id: { [Op.ne]: userId },
        phone: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      },
      attributes: ['phone', 'user_id'],
    });
    for (const a of appRows) {
      if (normalizePhoneDigits(a.phone) === phoneDigits) {
        const err = new Error('Số điện thoại đã được dùng trong hồ sơ ứng tuyển khác');
        err.status = 409;
        throw err;
      }
    }
    return phoneDigits;
  }

  /** Dùng cho GET check-phone (true = không trùng hoặc để trống) */
  async isPhoneAvailableForApplicant(userId, rawPhone) {
    const phoneDigits = normalizePhoneDigits(rawPhone);
    if (!phoneDigits) return true;
    if (phoneDigits.length < 8 || phoneDigits.length > 15) return false;
    try {
      await this.assertPhoneUniqueForApplicant(userId, rawPhone);
      return true;
    } catch (e) {
      if (e.status === 409 || e.status === 400) return false;
      throw e;
    }
  }

  /**
   * Chỉ cho gửi hồ sơ mới sau 24h kể từ bản ghi ScientistApplications gần nhất (mọi trạng thái).
   */
  async assertSubmissionCooldown(userId) {
    const last = await ScientistApplication.findOne({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'created_at'],
    });
    if (!last || !last.created_at) return;
    const created = new Date(last.created_at);
    const elapsed = Date.now() - created.getTime();
    if (elapsed >= SUBMIT_COOLDOWN_MS) return;
    const retryAt = new Date(created.getTime() + SUBMIT_COOLDOWN_MS);
    const err = new Error(
      `Bạn chỉ có thể gửi hồ sơ tiếp sau 24 giờ kể từ lần gửi gần nhất (thử lại sau ${retryAt.toLocaleString('vi-VN')}).`,
    );
    err.status = 429;
    err.retryAfterMs = SUBMIT_COOLDOWN_MS - elapsed;
    throw err;
  }

  async assertNoOpenApplication(userId) {
    /** TOP 1 — không dùng OFFSET/FETCH (tương thích SQL Server cũ hơn Sequelize mặc định). */
    const rows = await sequelize.query(
      `SELECT TOP 1 [id] AS [id] FROM [ScientistApplications]
       WHERE [user_id] = :uid
         AND [status] IN (:s1, :s2, :s3)
         AND [contract_confirmed_at] IS NULL`,
      {
        replacements: {
          uid: userId,
          s1: S.PENDING_LAB_REVIEW,
          s2: S.PENDING_DIRECTOR_REVIEW,
          s3: S.APPROVED,
        },
        type: QueryTypes.SELECT,
      },
    );
    const open = rows && rows.length > 0;
    if (open) {
      const err = new Error('Bạn đã có hồ sơ đang xử lý hoặc đã được phê duyệt (chưa kết thúc hợp đồng)');
      err.status = 409;
      throw err;
    }
  }

  async submit(userId, body, fileBuffer, originalFilename) {
    await this.assertNoOpenApplication(userId);
    await this.assertSubmissionCooldown(userId);

    let file_url = null;
    if (fileBuffer && fileBuffer.length) {
      if (!isConfigured()) {
        const err = new Error('Cloudinary chưa cấu hình (CLOUDINARY_* trong .env)');
        err.status = 503;
        throw err;
      }
      const uploaded = await uploadBuffer(fileBuffer, {
        folder: 'vkslab/scientist-cv',
        resource_type: 'raw',
        originalFilename: originalFilename || 'cv.pdf',
      });
      file_url = uploaded.secure_url;
    }

    const phoneStored = await this.assertPhoneUniqueForApplicant(userId, body.phone);

    const row = await ScientistApplication.create({
      user_id: userId,
      full_name: String(body.fullName || '').trim(),
      email: String(body.email || '').trim(),
      /** Vị trí cố định theo quy trình: member (không tin cậy body.position) */
      position: 'member',
      phone: phoneStored,
      portfolio_url: body.portfolioUrl ? String(body.portfolioUrl).trim() : null,
      cover_letter: body.coverLetter ? String(body.coverLetter).trim() : null,
      file_url,
      status: S.PENDING_LAB_REVIEW,
    });

    emitListChanged();

    try {
      await notificationService.notifyLabManagers({
        title: 'Hồ sơ CV chờ Trưởng lab duyệt',
        message: `Ứng viên "${row.full_name}" vừa nộp hồ sơ nhà khoa học.`,
        actionUrl: '/publication/cv-approvals',
        metadata: { kind: 'cv_submitted', applicationId: row.id },
        eventPayload: { applicationId: row.id },
      });
    } catch (e) {
      logger.error('notify lab managers cv submit:', e);
    }

    return toDto(row);
  }

  async listMine(userId, page = 1, limit = 20) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;

    const { count, rows } = await ScientistApplication.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: l,
      offset,
    });

    return {
      total: count,
      page: p,
      limit: l,
      data: rows.map(toDto),
    };
  }

  async listForReview(viewer) {
    const role = viewer.system_role;
    let where;
    if (role === SYSTEM_ROLES.TRUONG_LAB) {
      where = { status: S.PENDING_LAB_REVIEW };
    } else if (role === SYSTEM_ROLES.VIEN_TRUONG) {
      where = { status: { [Op.in]: [S.PENDING_DIRECTOR_REVIEW, S.APPROVED] } };
    } else {
      const err = new Error('Không có quyền xem danh sách duyệt');
      err.status = 403;
      throw err;
    }

    const rows = await ScientistApplication.findAll({
      where,
      order: [['created_at', 'ASC']],
    });

    return {
      total: rows.length,
      page: 1,
      limit: rows.length || 1,
      items: rows.map(toDto),
    };
  }

  async getById(id, viewer) {
    const row = await ScientistApplication.findByPk(id);
    if (!row) {
      const err = new Error('Không tìm thấy hồ sơ');
      err.status = 404;
      throw err;
    }

    const role = viewer.system_role;
    const owner = row.user_id === viewer.id;
    const reviewer =
      role === SYSTEM_ROLES.TRUONG_LAB ||
      role === SYSTEM_ROLES.VIEN_TRUONG ||
      role === SYSTEM_ROLES.ADMIN;

    if (!owner && !reviewer) {
      const err = new Error('Không có quyền xem hồ sơ này');
      err.status = 403;
      throw err;
    }

    return toDto(row);
  }

  async labReview(id, reviewerId, action, comment) {
    const row = await ScientistApplication.findByPk(id);
    if (!row || row.status !== S.PENDING_LAB_REVIEW) {
      const err = new Error('Hồ sơ không ở trạng thái chờ trưởng lab duyệt');
      err.status = 400;
      throw err;
    }

    if (action === 'REJECT' && !(comment && String(comment).trim())) {
      const err = new Error('Vui lòng nhập lý do từ chối');
      err.status = 400;
      throw err;
    }

    if (action === 'APPROVE') {
      row.status = S.PENDING_DIRECTOR_REVIEW;
      row.lab_reviewed_by = reviewerId;
      row.lab_comment = comment ? String(comment).trim() : null;
      row.lab_reviewed_at = new Date();
    } else {
      row.status = S.LAB_REJECTED;
      row.lab_reviewed_by = reviewerId;
      row.lab_comment = comment ? String(comment).trim() : null;
      row.lab_reviewed_at = new Date();
    }

    await row.save();
    emitListChanged();

    if (row.user_id) {
      try {
        if (action === 'APPROVE') {
          await notificationService.createAndPushNotification({
            userId: row.user_id,
            title: 'CV: đã qua Trưởng lab',
            message: `Hồ sơ của bạn (${row.full_name}) đã được Trưởng lab chấp nhận và đang chờ Viện trưởng phê duyệt.`,
            type: 'info',
            actionUrl: `/publication/cv-approvals/${row.id}`,
            metadata: { kind: 'cv_lab_approved', applicationId: row.id },
          });
        } else {
          const reason = truncateNotifyText(row.lab_comment);
          await notificationService.createAndPushNotification({
            userId: row.user_id,
            title: 'CV: bị từ chối bởi Trưởng lab',
            message: reason
              ? `Trưởng lab đã từ chối hồ sơ "${row.full_name}". Lý do: ${reason}`
              : `Trưởng lab đã từ chối hồ sơ "${row.full_name}".`,
            type: 'warning',
            actionUrl: `/publication/cv-approvals/${row.id}`,
            metadata: { kind: 'cv_lab_rejected', applicationId: row.id },
          });
        }
      } catch (e) {
        logger.error('notify scientist lab review:', e);
      }
    }

    return toDto(row);
  }

  async directorReview(id, reviewerId, action, comment) {
    const row = await ScientistApplication.findByPk(id);
    if (!row || row.status !== S.PENDING_DIRECTOR_REVIEW) {
      const err = new Error('Hồ sơ không ở trạng thái chờ viện trưởng duyệt');
      err.status = 400;
      throw err;
    }

    if (action === 'REJECT' && !(comment && String(comment).trim())) {
      const err = new Error('Vui lòng nhập lý do từ chối');
      err.status = 400;
      throw err;
    }

    if (action === 'APPROVE') {
      row.status = S.APPROVED;
      row.director_reviewed_by = reviewerId;
      row.director_comment = comment ? String(comment).trim() : null;
      row.director_reviewed_at = new Date();
    } else {
      row.status = S.DIRECTOR_REJECTED;
      row.director_reviewed_by = reviewerId;
      row.director_comment = comment ? String(comment).trim() : null;
      row.director_reviewed_at = new Date();
    }

    await row.save();
    emitListChanged();

    const applicantEmail = row.email && String(row.email).trim();
    if (applicantEmail) {
      if (action === 'APPROVE') {
        const t = emailTemplates.scientistCvDirectorApproved(row.full_name);
        sendMail(applicantEmail, t.subject, t.html);
      } else {
        const t = emailTemplates.scientistCvRejected(row.full_name, row.director_comment);
        sendMail(applicantEmail, t.subject, t.html);
      }
    }

    if (row.user_id) {
      try {
        if (action === 'APPROVE') {
          await notificationService.createAndPushNotification({
            userId: row.user_id,
            title: 'CV: đã được phê duyệt',
            message: `Viện trưởng đã phê duyệt hồ sơ của bạn (${row.full_name}).`,
            type: 'info',
            actionUrl: `/publication/cv-approvals/${row.id}`,
            metadata: { kind: 'cv_director_approved', applicationId: row.id },
          });
        } else {
          const reason = truncateNotifyText(row.director_comment);
          await notificationService.createAndPushNotification({
            userId: row.user_id,
            title: 'CV: bị từ chối bởi Viện trưởng',
            message: reason
              ? `Viện trưởng đã từ chối hồ sơ "${row.full_name}". Lý do: ${reason}`
              : `Viện trưởng đã từ chối hồ sơ "${row.full_name}".`,
            type: 'warning',
            actionUrl: `/publication/cv-approvals/${row.id}`,
            metadata: { kind: 'cv_director_rejected', applicationId: row.id },
          });
        }
      } catch (e) {
        logger.error('notify scientist director review:', e);
      }
    }

    return toDto(row);
  }

  async generateContract(id, actorId, payload) {
    const row = await ScientistApplication.findByPk(id);
    if (!row || row.status !== S.APPROVED) {
      const err = new Error('Chỉ tạo hợp đồng khi hồ sơ đã được phê duyệt');
      err.status = 400;
      throw err;
    }
    if (row.contract_created_at) {
      const err = new Error('Đã có hợp đồng trên hệ thống');
      err.status = 409;
      throw err;
    }
    if (!isConfigured()) {
      const err = new Error('Cloudinary chưa cấu hình');
      err.status = 503;
      throw err;
    }

    const docPayload = {
      partyAName: payload.partyAName,
      partyAEmail: payload.partyAEmail,
      partyAPhone: payload.partyAPhone,
      partyAAddress: payload.partyAAddress,
      partyATitle: payload.partyATitle,
      partyAWorkUnit: payload.partyAWorkUnit,
      partyBName: payload.partyBName,
      partyBEmail: payload.partyBEmail,
      partyBPhone: payload.partyBPhone,
      partyBAddress: payload.partyBAddress,
      partyBStudentId: payload.partyBStudentId,
      partyBFaculty: payload.partyBFaculty,
      contractDate: payload.contractDate,
      contractLocation: payload.contractLocation,
      contractSummary: payload.contractSummary,
    };

    const buffer = await buildContractDocxBuffer(docPayload);
    const uploaded = await uploadBuffer(buffer, {
      folder: 'vkslab/scientist-contracts',
      resource_type: 'raw',
      originalFilename: `hop-dong-${row.id}.docx`,
    });

    row.contract_summary = payload.contractSummary ? String(payload.contractSummary).trim() : null;
    row.contract_file_url = uploaded.secure_url;
    row.contract_created_at = new Date();
    row.contract_created_by = actorId;
    await row.save();

    emitListChanged();
    return toDto(row);
  }

  async recordContract(id, actorId, { contractSummary, contractFileUrl }, fileBuffer, originalFilename) {
    const row = await ScientistApplication.findByPk(id);
    if (!row || row.status !== S.APPROVED) {
      const err = new Error('Chỉ ghi nhận hợp đồng khi hồ sơ đã được phê duyệt');
      err.status = 400;
      throw err;
    }
    if (row.contract_created_at) {
      const err = new Error('Đã có hợp đồng trên hệ thống');
      err.status = 409;
      throw err;
    }

    let url = contractFileUrl ? String(contractFileUrl).trim() : null;
    if (fileBuffer && fileBuffer.length) {
      if (!isConfigured()) {
        const err = new Error('Cloudinary chưa cấu hình');
        err.status = 503;
        throw err;
      }
      const uploaded = await uploadBuffer(fileBuffer, {
        folder: 'vkslab/scientist-contracts',
        resource_type: 'raw',
        originalFilename: originalFilename || 'contract.pdf',
      });
      url = uploaded.secure_url;
    }

    if (!url) {
      const err = new Error('Cần file hợp đồng hoặc contractFileUrl');
      err.status = 400;
      throw err;
    }

    row.contract_summary = contractSummary ? String(contractSummary).trim() : null;
    row.contract_file_url = url;
    row.contract_created_at = new Date();
    row.contract_created_by = actorId;
    await row.save();

    emitListChanged();
    return toDto(row);
  }

  async confirmContract(id, directorId) {
    const row = await ScientistApplication.findByPk(id);
    if (!row) {
      const err = new Error('Không tìm thấy hồ sơ');
      err.status = 404;
      throw err;
    }
    if (!row.contract_file_url) {
      const err = new Error('Chưa có file hợp đồng');
      err.status = 400;
      throw err;
    }
    if (row.contract_confirmed_at) {
      const err = new Error('Hợp đồng đã được xác nhận');
      err.status = 409;
      throw err;
    }

    const t = await sequelize.transaction();
    try {
      row.contract_confirmed_at = new Date();
      row.contract_confirmed_by = directorId;
      await row.save({ transaction: t });

      await User.update(
        {
          system_role: SYSTEM_ROLES.MEMBER,
          status: USER_STATUS.ACTIVE,
        },
        { where: { id: row.user_id }, transaction: t },
      );

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    emitListChanged();
    return toDto(row);
  }
}

module.exports = new ScientistApplicationService();
