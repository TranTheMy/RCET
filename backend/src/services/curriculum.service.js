const crypto = require('crypto');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SYSTEM_ROLES, CURRICULUM_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { Curriculum, Category, User } = require('../models');
const { uploadBuffer, isConfigured, cloudinary } = require('../config/cloudinary');
const realtimeService = require('./realtime.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

const READ_ROLES = new Set([
  SYSTEM_ROLES.MEMBER,
  SYSTEM_ROLES.TRUONG_LAB,
  SYSTEM_ROLES.VIEN_TRUONG,
  SYSTEM_ROLES.USER,
]);

/** Trưởng lab & viện trưởng — viện trưởng: bản mới (create) hoặc submit bản nháp tự duyệt; new version vẫn là nháp rồi submit mới thay thế bản cũ */
const CREATOR_ROLES = new Set([SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG]);

function canReadPublished(role) {
  if (role == null || role === undefined) return true;
  return READ_ROLES.has(role);
}

function isDirectorRole(role) {
  return role === SYSTEM_ROLES.VIEN_TRUONG;
}

function emitStatus(payload) {
  realtimeService.emitCurriculumStatusUpdated(payload);
}

function emitPending(payload) {
  realtimeService.emitCurriculumPendingSubmitted(payload);
}

const includeDefault = [
  { model: Category, as: 'category', attributes: ['id', 'name'] },
  {
    model: User,
    as: 'creator',
    attributes: ['id', 'full_name', 'email', 'system_role'],
  },
  {
    model: User,
    as: 'reviewer',
    attributes: ['id', 'full_name', 'system_role'],
    required: false,
  },
];

function serializeCurriculum(row) {
  if (!row) return null;
  const j = row.toJSON ? row.toJSON() : row;
  const out = {
    id: j.id,
    title: j.title,
    description: j.description ?? null,
    category_id: j.category_id,
    authors: j.authors ?? null,
    pdf_url: j.pdf_url ?? null,
    file_path: j.file_path ?? null,
    source_type: j.source_type === 'link' ? 'link' : 'upload',
    status: j.status,
    checksum_sha256: j.checksum_sha256 ?? null,
    version_group_id: j.version_group_id ?? null,
    version_number: j.version_number ?? 1,
    parent_curriculum_id: j.parent_curriculum_id ?? null,
    is_latest: j.is_latest !== false,
    review_note: j.review_note ?? null,
    reviewed_by: j.reviewed_by ?? null,
    reviewed_at: j.reviewed_at ? new Date(j.reviewed_at).toISOString() : null,
    submitted_at: j.submitted_at ? new Date(j.submitted_at).toISOString() : null,
    approved_at: j.approved_at ? new Date(j.approved_at).toISOString() : null,
    archived_at: j.archived_at ? new Date(j.archived_at).toISOString() : null,
    created_by: j.created_by,
    created_at: j.created_at ? new Date(j.created_at).toISOString() : null,
    updated_at: j.updated_at ? new Date(j.updated_at).toISOString() : null,
  };
  if (j.category) {
    out.category = { id: j.category.id, name: j.category.name };
  }
  if (j.creator) {
    out.creator = {
      id: j.creator.id,
      full_name: j.creator.full_name,
      system_role: j.creator.system_role ?? null,
      email: j.creator.email,
    };
  }
  if (j.reviewer) {
    out.reviewer = {
      id: j.reviewer.id,
      full_name: j.reviewer.full_name,
      system_role: j.reviewer.system_role ?? null,
    };
  }
  return out;
}

async function resolveCategoryId(body) {
  if (body.category_id) {
    const c = await Category.findByPk(String(body.category_id));
    if (!c) throw { status: 400, message: 'Danh mục không tồn tại' };
    return c.id;
  }
  const name = body.category != null ? String(body.category).trim() : '';
  if (name) {
    const [c] = await Category.findOrCreate({
      where: { name },
      defaults: { name },
    });
    return c.id;
  }
  throw { status: 400, message: 'Yêu cầu category_id hoặc category' };
}

async function uploadCurriculumFile(buffer, originalFilename) {
  if (!isConfigured()) {
    throw { status: 503, message: 'Cloudinary chưa cấu hình (CLOUDINARY_* trong .env)' };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw { status: 400, message: 'File rỗng hoặc không hợp lệ' };
  }
  const uploaded = await uploadBuffer(buffer, {
    folder: 'vkslab/curriculum',
    resource_type: 'raw',
    originalFilename: originalFilename || 'curriculum.pdf',
  });
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    secure_url: uploaded.secure_url,
    public_id: uploaded.public_id,
    checksum_sha256: checksum,
  };
}

function safeDestroyCloudinary(publicId) {
  if (!publicId || !cloudinary?.uploader?.destroy) return;
  void cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch((e) => {
    logger.warn('Cloudinary destroy curriculum:', e?.message || e);
  });
}

/**
 * Xóa hẳn các bản approved khác trong cùng nhóm (khi duyệt phiên bản mới).
 * Gọi trước khi lưu bản pending thành approved.
 * Phải gỡ FK self-reference (phiên bản mới trỏ parent_curriculum_id → bản cũ) trước khi DELETE.
 */
async function deleteOtherApprovedInGroup(keepId, versionGroupId) {
  const olds = await Curriculum.findAll({
    where: {
      version_group_id: versionGroupId,
      id: { [Op.ne]: keepId },
      status: CURRICULUM_STATUS.APPROVED,
      deleted_at: null,
    },
  });
  if (!olds.length) return;

  const oldIds = olds.map((o) => o.id);
  await Curriculum.update(
    { parent_curriculum_id: null },
    { where: { parent_curriculum_id: { [Op.in]: oldIds } } },
  );

  for (const old of olds) {
    if (old.cloudinary_public_id) safeDestroyCloudinary(old.cloudinary_public_id);
    await Curriculum.destroy({ where: { id: old.id } });
  }
}

function canAccessRow(rowPlain, user) {
  if (!rowPlain || rowPlain.deleted_at) return false;
  if (rowPlain.status === CURRICULUM_STATUS.APPROVED && canReadPublished(user.system_role)) {
    return true;
  }
  if (rowPlain.created_by === user.id) return true;
  if (isDirectorRole(user.system_role)) return true;
  return false;
}

function canDownloadPreview(rowPlain, user) {
  if (!rowPlain || rowPlain.deleted_at) return false;
  if (rowPlain.status === CURRICULUM_STATUS.APPROVED && canReadPublished(user.system_role)) {
    return true;
  }
  if (rowPlain.created_by === user.id) return true;
  if (isDirectorRole(user.system_role)) return true;
  return false;
}

function escapeLikeCur(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function parseCurriculumListPagination(query) {
  const q = query || {};
  const limitProvided = q.limit !== undefined && q.limit !== null && String(q.limit).trim() !== '';
  if (!limitProvided) {
    return { paginate: false, page: 1, limit: null };
  }
  return {
    paginate: true,
    page: Math.max(1, parseInt(q.page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(q.limit, 10) || 10)),
  };
}

const listPublic = async (query, user) => {
  if (!canReadPublished(user?.system_role)) {
    throw { status: 403, message: 'Bạn không có quyền xem kho giáo trình' };
  }
  const { category_id, q, source_type, sort } = query || {};
  const base = {
    status: CURRICULUM_STATUS.APPROVED,
    deleted_at: null,
    is_latest: true,
  };
  const andParts = [];
  if (category_id) andParts.push({ category_id: String(category_id) });
  if (source_type === 'upload' || source_type === 'link') {
    andParts.push({ source_type: String(source_type) });
  }
  if (q && String(q).trim()) {
    const term = `%${escapeLikeCur(String(q).trim())}%`;
    andParts.push({
      [Op.or]: [
        { title: { [Op.like]: term } },
        { description: { [Op.like]: term } },
        { authors: { [Op.like]: term } },
      ],
    });
  }
  const where = andParts.length ? { [Op.and]: [base, ...andParts] } : base;

  const sortKey = String(sort || 'newest').toLowerCase();
  let order;
  if (sortKey === 'oldest') {
    order = [
      ['approved_at', 'ASC'],
      ['created_at', 'ASC'],
    ];
  } else if (sortKey === 'title') {
    order = [['title', 'ASC']];
  } else {
    order = [
      ['approved_at', 'DESC'],
      ['created_at', 'DESC'],
    ];
  }

  const { paginate, page, limit } = parseCurriculumListPagination(query);
  const opts = {
    where,
    include: includeDefault,
    order,
  };
  if (paginate) {
    opts.limit = limit;
    opts.offset = (page - 1) * limit;
    opts.distinct = true;
    opts.col = 'id';
  }
  const { count, rows } = await Curriculum.findAndCountAll(opts);
  const items = rows.map(serializeCurriculum);
  if (!paginate) {
    return { items };
  }
  const total = typeof count === 'number' ? count : count.length;
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

const listMine = async (user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    return { items: [] };
  }
  const rows = await Curriculum.findAll({
    where: { created_by: user.id, deleted_at: null },
    include: includeDefault,
    order: [['updated_at', 'DESC']],
  });
  return { items: rows.map(serializeCurriculum) };
};

const listPending = async (query, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng duyệt giáo trình' };
  }
  const { category_id, q } = query || {};
  const where = {
    status: CURRICULUM_STATUS.PENDING,
    deleted_at: null,
  };
  if (category_id) where.category_id = String(category_id);
  if (q && String(q).trim()) {
    where.title = { [Op.like]: `%${String(q).trim()}%` };
  }
  const rows = await Curriculum.findAll({
    where,
    include: includeDefault,
    order: [['submitted_at', 'ASC']],
  });
  return { items: rows.map(serializeCurriculum) };
};

const history = async (versionGroupId, user) => {
  if (!versionGroupId) throw { status: 400, message: 'Thiếu version_group_id' };
  if (!CREATOR_ROLES.has(user.system_role) && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền' };
  }
  const rows = await Curriculum.findAll({
    where: { version_group_id: String(versionGroupId), deleted_at: null },
    include: includeDefault,
    order: [['version_number', 'ASC']],
  });
  if (!rows.length) return { items: [] };
  if (rows[0].created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền xem lịch sử phiên bản này' };
  }
  return { items: rows.map(serializeCurriculum) };
};

const getById = async (id, user) => {
  const row = await Curriculum.findOne({
    where: { id, deleted_at: null },
    include: includeDefault,
  });
  if (!row) throw { status: 404, message: 'Không tìm thấy giáo trình' };
  const plain = row.get({ plain: true });
  if (!canAccessRow(plain, user)) {
    throw { status: 403, message: 'Không có quyền xem bản ghi này' };
  }
  return serializeCurriculum(row);
};

const getDownloadPayload = async (id, user) => {
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  const plain = row.get({ plain: true });
  if (!canDownloadPreview(plain, user)) {
    throw { status: 403, message: 'Không có quyền tải xuống' };
  }
  const url = (plain.pdf_url && String(plain.pdf_url).trim()) || (plain.file_path && String(plain.file_path).trim());
  if (!url) throw { status: 400, message: 'Không có nguồn tệp' };
  if (user?.id) {
    await auditService.log(AUDIT_ACTIONS.CURRICULUM_DOWNLOADED, user.id, plain.created_by, {
      entity_type: 'curriculum',
      entity_id: plain.id,
      title: plain.title,
      status: plain.status,
      source_type: plain.source_type,
    });
  }
  return { url, expires_in: null };
};

const getPreviewRedirectUrl = async (id, user) => {
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  const plain = row.get({ plain: true });
  if (!canDownloadPreview(plain, user)) {
    throw { status: 403, message: 'Không có quyền xem trước' };
  }
  const url = (plain.pdf_url && String(plain.pdf_url).trim()) || (plain.file_path && String(plain.file_path).trim());
  if (!url) throw { status: 400, message: 'Không có nguồn tệp' };
  return url;
};

const create = async (body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Chỉ trưởng lab hoặc viện trưởng đăng giáo trình' };
  }
  const b = body || {};
  const title = String(b.title || '').trim();
  const errors = [];
  if (!title) errors.push({ field: 'title', message: 'Tiêu đề là bắt buộc' });
  if (!b.category_id && !String(b.category || '').trim()) {
    errors.push({ field: 'category_id', message: 'Danh mục là bắt buộc' });
  }

  const sourceType = b.pdf_url && String(b.pdf_url).trim() && !file ? 'link' : 'upload';
  if (sourceType === 'upload' && !file) {
    errors.push({ field: 'file', message: 'Vui lòng đính kèm file hoặc nhập liên kết tài liệu' });
  }
  if (sourceType === 'link') {
    const u = String(b.pdf_url || '').trim();
    if (!/^https?:\/\//i.test(u)) {
      errors.push({ field: 'pdf_url', message: 'Liên kết tài liệu không hợp lệ' });
    }
  }
  if (errors.length > 0) {
    throw { status: 400, message: 'Validation error', errors };
  }

  let category_id;
  try {
    category_id = await resolveCategoryId(b);
  } catch (error) {
    if (error?.status === 400) {
      throw {
        status: 400,
        message: 'Validation error',
        errors: [{ field: 'category_id', message: error.message || 'Danh mục không hợp lệ' }],
      };
    }
    throw error;
  }
  const version_group_id = uuidv4();

  let pdf_url = null;
  let file_path = null;
  let cloudinary_public_id = null;
  let checksum_sha256 = null;
  let source_type = sourceType;

  if (sourceType === 'upload') {
    const up = await uploadCurriculumFile(file.buffer, file.originalname);
    file_path = up.secure_url;
    cloudinary_public_id = up.public_id;
    checksum_sha256 = up.checksum_sha256;
    source_type = 'upload';
  } else {
    pdf_url = String(b.pdf_url).trim();
    source_type = 'link';
  }

  const now = new Date();
  const autoApprove = isDirectorRole(user.system_role);

  const row = await Curriculum.create({
    title,
    description: b.description != null ? String(b.description) : null,
    category_id,
    authors: b.authors != null ? String(b.authors).trim() || null : null,
    pdf_url,
    file_path,
    cloudinary_public_id,
    source_type,
    checksum_sha256,
    version_group_id,
    version_number: 1,
    parent_curriculum_id: null,
    is_latest: true,
    status: autoApprove ? CURRICULUM_STATUS.APPROVED : CURRICULUM_STATUS.DRAFT,
    approved_at: autoApprove ? now : null,
    reviewed_by: autoApprove ? user.id : null,
    reviewed_at: autoApprove ? now : null,
    submitted_at: autoApprove ? now : null,
    created_by: user.id,
  });

  const full = await Curriculum.findByPk(row.id, { include: includeDefault });
  emitStatus({ curriculumId: row.id, status: full.status });
  if (autoApprove) {
    emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.APPROVED, scope: 'public' });
  }
  await auditService.log(AUDIT_ACTIONS.CURRICULUM_CREATED, user.id, null, {
    entity_type: 'curriculum',
    entity_id: row.id,
    title: row.title,
    status: row.status,
    source_type: row.source_type,
  });
  return serializeCurriculum(full);
};

const update = async (id, body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền cập nhật' };
  }
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  if (row.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu mới sửa được' };
  }
  const allowed =
    row.status === CURRICULUM_STATUS.DRAFT || row.status === CURRICULUM_STATUS.REJECTED;
  if (!allowed) {
    throw { status: 400, message: 'Chỉ sửa được bản nháp hoặc bản bị từ chối' };
  }

  const b = body || {};
  const errors = [];
  if (b.title !== undefined && !String(b.title).trim()) {
    errors.push({ field: 'title', message: 'Tiêu đề là bắt buộc' });
  }
  if (errors.length > 0) {
    throw { status: 400, message: 'Validation error', errors };
  }
  if (b.title !== undefined) row.title = String(b.title).trim();
  if (b.description !== undefined) row.description = b.description != null ? String(b.description) : null;
  if (b.category_id || b.category) {
    try {
      row.category_id = await resolveCategoryId(b);
    } catch (error) {
      if (error?.status === 400) {
        throw {
          status: 400,
          message: 'Validation error',
          errors: [{ field: 'category_id', message: error.message || 'Danh mục không hợp lệ' }],
        };
      }
      throw error;
    }
  }
  if (b.authors !== undefined) {
    row.authors = b.authors != null ? String(b.authors).trim() || null : null;
  }

  if (file) {
    if (row.cloudinary_public_id) safeDestroyCloudinary(row.cloudinary_public_id);
    const up = await uploadCurriculumFile(file.buffer, file.originalname);
    row.file_path = up.secure_url;
    row.cloudinary_public_id = up.public_id;
    row.checksum_sha256 = up.checksum_sha256;
    row.pdf_url = null;
    row.source_type = 'upload';
  } else if (b.pdf_url !== undefined) {
    const u = String(b.pdf_url || '').trim();
    if (u) {
      if (!/^https?:\/\//i.test(u)) {
        throw {
          status: 400,
          message: 'Validation error',
          errors: [{ field: 'pdf_url', message: 'Liên kết tài liệu không hợp lệ' }],
        };
      }
      if (row.cloudinary_public_id) safeDestroyCloudinary(row.cloudinary_public_id);
      row.pdf_url = u;
      row.file_path = null;
      row.cloudinary_public_id = null;
      row.checksum_sha256 = null;
      row.source_type = 'link';
    }
  }

  if (row.status === CURRICULUM_STATUS.REJECTED) {
    row.status = CURRICULUM_STATUS.DRAFT;
    row.review_note = null;
    row.reviewed_by = null;
    row.reviewed_at = null;
  }

  await row.save();
  const full = await Curriculum.findByPk(row.id, { include: includeDefault });
  emitStatus({ curriculumId: row.id, status: row.status });
  return serializeCurriculum(full);
};

const remove = async (id, user, body = {}) => {
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  if (row.created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền xóa' };
  }
  const deletableByCreator = [
    CURRICULUM_STATUS.DRAFT,
    CURRICULUM_STATUS.REJECTED,
    CURRICULUM_STATUS.PENDING,
  ];
  const dir = isDirectorRole(user.system_role);
  if (!dir && !deletableByCreator.includes(row.status)) {
    throw { status: 400, message: 'Chỉ xóa nháp, chờ duyệt hoặc bị từ chối' };
  }
  if (dir && !deletableByCreator.includes(row.status)) {
    const reason = body?.reason != null ? String(body.reason).trim() : '';
    await auditService.log(AUDIT_ACTIONS.CURRICULUM_WITHDRAWN, user.id, row.created_by, {
      entity_type: 'curriculum',
      entity_id: row.id,
      title: row.title,
      previous_status: row.status,
      reason: reason || null,
    });
  }
  row.deleted_at = new Date();
  await row.save();
  emitStatus({ curriculumId: row.id, status: 'deleted' });
};

const restore = async (id, user) => {
  const row = await Curriculum.findOne({ where: { id } });
  if (!row || !row.deleted_at) throw { status: 404, message: 'Không có bản ghi để khôi phục' };
  if (row.created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền' };
  }
  row.deleted_at = null;
  await row.save();
  const full = await Curriculum.findByPk(row.id, { include: includeDefault });
  emitStatus({ curriculumId: row.id, status: full.status });
  return serializeCurriculum(full);
};

const submit = async (id, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền gửi duyệt' };
  }
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  if (row.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu gửi duyệt' };
  }
  if (row.status !== CURRICULUM_STATUS.DRAFT) {
    throw { status: 400, message: 'Chỉ gửi duyệt từ trạng thái nháp' };
  }

  const creator = await User.findByPk(row.created_by, { attributes: ['system_role'] });
  const creatorIsDirector = creator?.system_role === SYSTEM_ROLES.VIEN_TRUONG;
  const now = new Date();

  if (creatorIsDirector) {
    await deleteOtherApprovedInGroup(row.id, row.version_group_id);
    row.status = CURRICULUM_STATUS.APPROVED;
    row.approved_at = now;
    row.reviewed_by = user.id;
    row.reviewed_at = now;
    row.review_note = null;
    row.submitted_at = now;
    row.is_latest = true;
    await row.save();
    emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.APPROVED });
    emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.APPROVED, scope: 'public' });
    return serializeCurriculum(await Curriculum.findByPk(row.id, { include: includeDefault }));
  }

  row.status = CURRICULUM_STATUS.PENDING;
  row.submitted_at = now;
  await row.save();
  await notificationService.notifyInstituteManagers({
    title: 'Giáo trình chờ duyệt',
    message: `Giáo trình "${row.title}" vừa được submit để duyệt`,
    actionUrl: `/publication/curriculum/approvals`,
    metadata: { entityType: 'curriculum', entityId: row.id },
    eventName: 'ENTITY_SUBMITTED',
    eventPayload: { entityType: 'curriculum', entityId: row.id },
  });
  emitPending({ curriculumId: row.id });
  emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.PENDING });
  return serializeCurriculum(await Curriculum.findByPk(row.id, { include: includeDefault }));
};

const approve = async (id, body, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng phê duyệt' };
  }
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  if (row.status !== CURRICULUM_STATUS.PENDING) {
    throw { status: 400, message: 'Bản ghi không ở trạng thái chờ duyệt' };
  }
  const note = body?.review_note != null ? String(body.review_note).trim() : null;
  const now = new Date();

  await deleteOtherApprovedInGroup(row.id, row.version_group_id);

  row.status = CURRICULUM_STATUS.APPROVED;
  row.approved_at = now;
  row.reviewed_by = user.id;
  row.reviewed_at = now;
  row.review_note = note || null;
  row.is_latest = true;
  await row.save();
  await notificationService.createAndPushNotification({
    userId: row.created_by,
    title: 'Giáo trình đã được duyệt',
    message: `Giáo trình "${row.title}" đã được viện trưởng duyệt`,
    type: 'info',
    actionUrl: `/publication/curriculum/${row.id}`,
    metadata: { entityType: 'curriculum', entityId: row.id },
    eventName: 'ENTITY_APPROVED',
    eventPayload: { entityType: 'curriculum', entityId: row.id },
  });
  await auditService.log(AUDIT_ACTIONS.CURRICULUM_APPROVED, user.id, row.created_by, {
    entity_type: 'curriculum',
    entity_id: row.id,
    title: row.title,
    previous_status: CURRICULUM_STATUS.PENDING,
    new_status: CURRICULUM_STATUS.APPROVED,
    review_note: row.review_note,
  });

  emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.APPROVED });
  return serializeCurriculum(await Curriculum.findByPk(row.id, { include: includeDefault }));
};

const reject = async (id, body, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng từ chối' };
  }
  const row = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy' };
  if (row.status !== CURRICULUM_STATUS.PENDING) {
    throw { status: 400, message: 'Bản ghi không ở trạng thái chờ duyệt' };
  }
  const review_note = body?.review_note != null ? String(body.review_note).trim() : '';
  if (!review_note) throw { status: 400, message: 'Yêu cầu lý do từ chối' };
  const now = new Date();
  row.status = CURRICULUM_STATUS.REJECTED;
  row.review_note = review_note;
  row.reviewed_by = user.id;
  row.reviewed_at = now;
  await row.save();
  await auditService.log(AUDIT_ACTIONS.CURRICULUM_REJECTED, user.id, row.created_by, {
    entity_type: 'curriculum',
    entity_id: row.id,
    title: row.title,
    previous_status: CURRICULUM_STATUS.PENDING,
    new_status: CURRICULUM_STATUS.REJECTED,
    review_note: row.review_note,
  });
  try {
    const note = String(row.review_note || '').trim();
    const reasonPreview = note.length > 200 ? `${note.slice(0, 200)}…` : note;
    await notificationService.createAndPushNotification({
      userId: row.created_by,
      title: 'Giáo trình bị từ chối',
      message: reasonPreview
        ? `Giáo trình "${row.title}" đã bị từ chối. Lý do: ${reasonPreview}`
        : `Giáo trình "${row.title}" đã bị từ chối.`,
      type: 'warning',
      actionUrl: `/publication/curriculum/${row.id}`,
      metadata: { entityType: 'curriculum', entityId: row.id },
      eventName: 'ENTITY_REJECTED',
      eventPayload: { entityType: 'curriculum', entityId: row.id },
    });
  } catch (e) {
    logger.error('notify curriculum rejected:', e);
  }
  emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.REJECTED });
  return serializeCurriculum(await Curriculum.findByPk(row.id, { include: includeDefault }));
};

const createVersion = async (id, body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Chỉ trưởng lab hoặc viện trưởng tạo phiên bản mới' };
  }
  const parent = await Curriculum.findOne({ where: { id, deleted_at: null } });
  if (!parent) throw { status: 404, message: 'Không tìm thấy' };
  if (parent.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu' };
  }
  if (
    parent.status !== CURRICULUM_STATUS.REJECTED &&
    parent.status !== CURRICULUM_STATUS.APPROVED
  ) {
    throw {
      status: 400,
      message: 'Chỉ tạo phiên bản mới từ bản đã duyệt hoặc bị từ chối',
    };
  }

  /** Tránh nhiều bản nháp/chờ duyệt song song trong cùng nhóm (lỗi bấm New Version nhiều lần từ bản approved). */
  const unfinishedStatuses = [
    CURRICULUM_STATUS.DRAFT,
    CURRICULUM_STATUS.PENDING,
    CURRICULUM_STATUS.REVISION,
  ];
  const siblingUnfinished = await Curriculum.count({
    where: {
      version_group_id: parent.version_group_id,
      id: { [Op.ne]: parent.id },
      status: { [Op.in]: unfinishedStatuses },
      deleted_at: null,
    },
  });
  if (siblingUnfinished > 0) {
    throw {
      status: 409,
      message:
        'Đã có bản nháp hoặc đang chờ duyệt trong cùng nhóm phiên bản. Vui lòng chỉnh sửa, gửi duyệt hoặc xóa bản đó trước khi tạo phiên bản mới.',
    };
  }

  const maxVer = await Curriculum.max('version_number', {
    where: { version_group_id: parent.version_group_id, deleted_at: null },
  });
  const nextNum = (maxVer || 0) + 1;

  const b = body || {};
  let pdf_url = parent.pdf_url;
  let file_path = parent.file_path;
  let cloudinary_public_id = parent.cloudinary_public_id;
  let checksum_sha256 = parent.checksum_sha256;
  let source_type = parent.source_type;

  if (file) {
    const up = await uploadCurriculumFile(file.buffer, file.originalname);
    file_path = up.secure_url;
    cloudinary_public_id = up.public_id;
    checksum_sha256 = up.checksum_sha256;
    pdf_url = null;
    source_type = 'upload';
  }

  if (parent.status === CURRICULUM_STATUS.REJECTED) {
    await parent.update({ is_latest: false });
  }

  /** Giống trưởng lab: luôn tạo nháp; viện trưởng chỉ thay thế bản approved cũ khi gọi submit (tự duyệt). */
  const newIsLatest = parent.status === CURRICULUM_STATUS.REJECTED;

  const row = await Curriculum.create({
    title: b.title != null ? String(b.title).trim() || parent.title : parent.title,
    description:
      b.description !== undefined
        ? b.description != null
          ? String(b.description)
          : null
        : parent.description,
    category_id: parent.category_id,
    authors: parent.authors,
    pdf_url,
    file_path,
    cloudinary_public_id,
    source_type,
    checksum_sha256,
    version_group_id: parent.version_group_id,
    version_number: nextNum,
    parent_curriculum_id: parent.id,
    is_latest: newIsLatest,
    status: CURRICULUM_STATUS.DRAFT,
    created_by: user.id,
  });

  const full = await Curriculum.findByPk(row.id, { include: includeDefault });
  emitStatus({ curriculumId: row.id, status: CURRICULUM_STATUS.DRAFT });
  return serializeCurriculum(full);
};

module.exports = {
  listPublic,
  listMine,
  listPending,
  history,
  getById,
  getDownloadPayload,
  getPreviewRedirectUrl,
  create,
  update,
  remove,
  restore,
  submit,
  approve,
  reject,
  createVersion,
  serializeCurriculum,
};
