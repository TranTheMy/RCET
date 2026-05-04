const crypto = require('crypto');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SYSTEM_ROLES, DOCUMENT_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { Document, Category, User } = require('../models');
const { uploadBuffer, isConfigured, cloudinary } = require('../config/cloudinary');
const realtimeService = require('./realtime.service');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

// =====================================================
// Constants & role helpers
// =====================================================

const DOC_TYPES = new Set(['datasheet', 'manual', 'schematic']);

const READ_ROLES = new Set([
  SYSTEM_ROLES.MEMBER,
  SYSTEM_ROLES.TRUONG_LAB,
  SYSTEM_ROLES.VIEN_TRUONG,
  SYSTEM_ROLES.USER,
]);

const CREATOR_ROLES = new Set([SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG]);

function canReadPublished(role) {
  if (role == null || role === undefined) return true;
  return READ_ROLES.has(role);
}

function isDirectorRole(role) {
  return role === SYSTEM_ROLES.VIEN_TRUONG;
}

function emitDocStatus(payload) {
  realtimeService.emitDocumentStatusChanged(payload);
}

function emitDocPending(payload) {
  realtimeService.emitDocumentPendingSubmitted(payload);
}

// =====================================================
// Sequelize includes & serialization
// =====================================================

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

function parseTechnicalMeta(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  const s = String(raw).trim();
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function stringifyTechnicalMeta(val) {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val);
  } catch {
    return null;
  }
}

function serializeDocument(row) {
  if (!row) return null;
  const j = row.toJSON ? row.toJSON() : row;
  let technical_metadata = null;
  if (j.technical_metadata) {
    try {
      technical_metadata = JSON.parse(j.technical_metadata);
    } catch {
      technical_metadata = null;
    }
  }
  const out = {
    id: j.id,
    title: j.title,
    description: j.description ?? null,
    category_id: j.category_id,
    doc_type: j.doc_type ?? null,
    manufacturer: j.manufacturer ?? null,
    technical_metadata,
    pdf_url: j.pdf_url ?? null,
    file_path: j.file_path ?? null,
    source_type: j.source_type === 'link' ? 'link' : 'upload',
    status: j.status,
    checksum_sha256: j.checksum_sha256 ?? null,
    version_group_id: j.version_group_id ?? null,
    version_number: j.version_number ?? 1,
    parent_document_id: j.parent_document_id ?? null,
    is_latest: j.is_latest !== false,
    review_note: j.review_note ?? null,
    reviewed_by: j.reviewed_by ?? null,
    reviewed_at: j.reviewed_at ? new Date(j.reviewed_at).toISOString() : null,
    submitted_at: j.submitted_at ? new Date(j.submitted_at).toISOString() : null,
    published_at: j.published_at ? new Date(j.published_at).toISOString() : null,
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

// =====================================================
// Cloudinary & category
// =====================================================

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

async function uploadDocumentFile(buffer, originalFilename) {
  if (!isConfigured()) {
    throw { status: 503, message: 'Cloudinary chưa cấu hình (CLOUDINARY_* trong .env)' };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw { status: 400, message: 'File rỗng hoặc không hợp lệ' };
  }
  const uploaded = await uploadBuffer(buffer, {
    folder: 'vkslab/documents',
    resource_type: 'raw',
    originalFilename: originalFilename || 'document.pdf',
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
    logger.warn('Cloudinary destroy document:', e?.message || e);
  });
}

async function archiveSiblingPublished(doc) {
  await Document.update(
    {
      status: DOCUMENT_STATUS.ARCHIVED,
      archived_at: new Date(),
      is_latest: false,
    },
    {
      where: {
        version_group_id: doc.version_group_id,
        id: { [Op.ne]: doc.id },
        status: DOCUMENT_STATUS.PUBLISHED,
        deleted_at: null,
      },
    },
  );
}

// =====================================================
// Access checks
// =====================================================

function canAccessDocumentRow(doc, user) {
  if (!doc || doc.deleted_at) return false;
  if (doc.status === DOCUMENT_STATUS.PUBLISHED && canReadPublished(user.system_role)) return true;
  if (doc.created_by === user.id) return true;
  if (isDirectorRole(user.system_role)) return true;
  return false;
}

function canDownloadPreview(doc, user) {
  if (!doc || doc.deleted_at) return false;
  if (doc.status === DOCUMENT_STATUS.PUBLISHED && canReadPublished(user.system_role)) return true;
  if (doc.created_by === user.id) return true;
  if (isDirectorRole(user.system_role)) return true;
  return false;
}

// =====================================================
// Public API
// =====================================================

function escapeLikeDoc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function parseDocListPagination(query) {
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
    throw { status: 403, message: 'Bạn không có quyền xem kho tài liệu' };
  }
  const { category_id, q, doc_type, sort } = query || {};
  const base = {
    status: DOCUMENT_STATUS.PUBLISHED,
    deleted_at: null,
    is_latest: true,
  };
  const andParts = [];
  if (category_id) andParts.push({ category_id: String(category_id) });
  if (doc_type && DOC_TYPES.has(String(doc_type))) {
    andParts.push({ doc_type: String(doc_type) });
  }
  if (q && String(q).trim()) {
    const term = `%${escapeLikeDoc(String(q).trim())}%`;
    andParts.push({
      [Op.or]: [
        { title: { [Op.like]: term } },
        { description: { [Op.like]: term } },
        { manufacturer: { [Op.like]: term } },
      ],
    });
  }
  const where = andParts.length ? { [Op.and]: [base, ...andParts] } : base;

  const sortKey = String(sort || 'newest').toLowerCase();
  let order;
  if (sortKey === 'oldest') {
    order = [
      ['published_at', 'ASC'],
      ['created_at', 'ASC'],
    ];
  } else if (sortKey === 'title') {
    order = [['title', 'ASC']];
  } else {
    order = [
      ['published_at', 'DESC'],
      ['created_at', 'DESC'],
    ];
  }

  const { paginate, page, limit } = parseDocListPagination(query);
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
  const { count, rows } = await Document.findAndCountAll(opts);
  const items = rows.map(serializeDocument);
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
    throw { status: 403, message: 'Chỉ trưởng lab hoặc viện trưởng có workspace tài liệu' };
  }
  const rows = await Document.findAll({
    where: { created_by: user.id, deleted_at: null },
    include: includeDefault,
    order: [['updated_at', 'DESC']],
  });
  return { items: rows.map(serializeDocument) };
};

const listPending = async (query, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng duyệt tài liệu' };
  }
  const { category_id, q } = query || {};
  const where = {
    status: DOCUMENT_STATUS.PENDING,
    deleted_at: null,
  };
  if (category_id) where.category_id = String(category_id);
  if (q && String(q).trim()) {
    where.title = { [Op.like]: `%${String(q).trim()}%` };
  }
  const rows = await Document.findAll({
    where,
    include: includeDefault,
    order: [['submitted_at', 'ASC']],
  });
  return { items: rows.map(serializeDocument) };
};

const history = async (versionGroupId, user) => {
  if (!versionGroupId) throw { status: 400, message: 'Thiếu version_group_id' };
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền' };
  }
  const rows = await Document.findAll({
    where: { version_group_id: String(versionGroupId), deleted_at: null },
    include: includeDefault,
    order: [['version_number', 'ASC']],
  });
  if (!rows.length) return { items: [] };
  if (rows[0].created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền xem lịch sử phiên bản này' };
  }
  return { items: rows.map(serializeDocument) };
};

const getById = async (id, user) => {
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
    include: includeDefault,
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy tài liệu' };
  if (!canAccessDocumentRow(doc, user)) {
    throw { status: 403, message: 'Không có quyền xem tài liệu này' };
  }
  return serializeDocument(doc);
};

const getDownloadPayload = async (id, user) => {
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy tài liệu' };
  if (!canDownloadPreview(doc, user)) {
    throw { status: 403, message: 'Không có quyền tải xuống' };
  }
  const url = (doc.pdf_url && String(doc.pdf_url).trim()) || (doc.file_path && String(doc.file_path).trim());
  if (!url) throw { status: 400, message: 'Không có nguồn tệp' };
  if (user?.id) {
    await auditService.log(AUDIT_ACTIONS.DOCUMENT_DOWNLOADED, user.id, doc.created_by, {
      entity_type: 'document',
      entity_id: doc.id,
      title: doc.title,
      status: doc.status,
      source_type: doc.source_type,
    });
  }
  return { url, expires_in: null };
};

/** Trả về URL để controller redirect (xem trước) */
const getPreviewRedirectUrl = async (id, user) => {
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy tài liệu' };
  if (!canDownloadPreview(doc, user)) {
    throw { status: 403, message: 'Không có quyền xem trước' };
  }
  const url = (doc.pdf_url && String(doc.pdf_url).trim()) || (doc.file_path && String(doc.file_path).trim());
  if (!url) throw { status: 400, message: 'Không có nguồn tệp' };
  return url;
};

const create = async (body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Chỉ trưởng lab hoặc viện trưởng đăng tài liệu' };
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
  const docType = b.doc_type && DOC_TYPES.has(String(b.doc_type)) ? String(b.doc_type) : null;

  let pdf_url = null;
  let file_path = null;
  let cloudinary_public_id = null;
  let checksum_sha256 = null;
  let source_type = sourceType;

  if (sourceType === 'upload') {
    const up = await uploadDocumentFile(file.buffer, file.originalname);
    file_path = up.secure_url;
    cloudinary_public_id = up.public_id;
    checksum_sha256 = up.checksum_sha256;
    source_type = 'upload';
  } else {
    pdf_url = String(b.pdf_url).trim();
    source_type = 'link';
  }

  const isDirector = isDirectorRole(user.system_role);
  const now = new Date();
  const status = isDirector ? DOCUMENT_STATUS.PUBLISHED : DOCUMENT_STATUS.DRAFT;
  const published_at = isDirector ? now : null;

  const row = await Document.create({
    title,
    description: b.description != null ? String(b.description) : null,
    category_id,
    doc_type: docType,
    manufacturer: b.manufacturer != null ? String(b.manufacturer).trim() || null : null,
    technical_metadata: stringifyTechnicalMeta(parseTechnicalMeta(b.technical_metadata)),
    pdf_url,
    file_path,
    cloudinary_public_id,
    source_type,
    checksum_sha256,
    version_group_id,
    version_number: 1,
    parent_document_id: null,
    is_latest: true,
    status,
    published_at,
    created_by: user.id,
  });

  const full = await Document.findByPk(row.id, { include: includeDefault });
  emitDocStatus({ documentId: row.id, status: full.status });
  if (full.status === DOCUMENT_STATUS.PUBLISHED) {
    emitDocStatus({ documentId: row.id, scope: 'public' });
  }
  await auditService.log(AUDIT_ACTIONS.DOCUMENT_CREATED, user.id, null, {
    entity_type: 'document',
    entity_id: row.id,
    title: row.title,
    status: row.status,
    source_type: row.source_type,
  });
  return serializeDocument(full);
};

const update = async (id, body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền cập nhật' };
  }
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy' };
  if (doc.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu mới sửa được' };
  }
  const allowed = doc.status === DOCUMENT_STATUS.DRAFT || doc.status === DOCUMENT_STATUS.REJECTED;
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
  if (b.title !== undefined) doc.title = String(b.title).trim();
  if (b.description !== undefined) doc.description = b.description != null ? String(b.description) : null;
  if (b.category_id || b.category) {
    try {
      doc.category_id = await resolveCategoryId(b);
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
  if (b.doc_type !== undefined) {
    doc.doc_type = b.doc_type && DOC_TYPES.has(String(b.doc_type)) ? String(b.doc_type) : null;
  }
  if (b.manufacturer !== undefined) {
    doc.manufacturer = b.manufacturer != null ? String(b.manufacturer).trim() || null : null;
  }
  if (b.technical_metadata !== undefined) {
    doc.technical_metadata = stringifyTechnicalMeta(parseTechnicalMeta(b.technical_metadata));
  }

  if (file) {
    if (doc.cloudinary_public_id) safeDestroyCloudinary(doc.cloudinary_public_id);
    const up = await uploadDocumentFile(file.buffer, file.originalname);
    doc.file_path = up.secure_url;
    doc.cloudinary_public_id = up.public_id;
    doc.checksum_sha256 = up.checksum_sha256;
    doc.pdf_url = null;
    doc.source_type = 'upload';
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
      if (doc.cloudinary_public_id) safeDestroyCloudinary(doc.cloudinary_public_id);
      doc.pdf_url = u;
      doc.file_path = null;
      doc.cloudinary_public_id = null;
      doc.checksum_sha256 = null;
      doc.source_type = 'link';
    }
  }

  if (doc.status === DOCUMENT_STATUS.REJECTED) {
    doc.status = DOCUMENT_STATUS.DRAFT;
    doc.review_note = null;
    doc.reviewed_by = null;
    doc.reviewed_at = null;
  }

  await doc.save();
  const full = await Document.findByPk(doc.id, { include: includeDefault });
  emitDocStatus({ documentId: doc.id, status: doc.status });
  return serializeDocument(full);
};

const remove = async (id, user, body = {}) => {
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy' };
  if (doc.created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền xóa' };
  }
  const deletableByCreator = [DOCUMENT_STATUS.DRAFT, DOCUMENT_STATUS.REJECTED, DOCUMENT_STATUS.PENDING];
  const dir = isDirectorRole(user.system_role);
  if (!dir && !deletableByCreator.includes(doc.status)) {
    throw { status: 400, message: 'Chỉ xóa nháp, chờ duyệt hoặc bị từ chối' };
  }
  if (dir && !deletableByCreator.includes(doc.status)) {
    const reason = body?.reason != null ? String(body.reason).trim() : '';
    await auditService.log(AUDIT_ACTIONS.DOCUMENT_WITHDRAWN, user.id, doc.created_by, {
      entity_type: 'document',
      entity_id: doc.id,
      title: doc.title,
      previous_status: doc.status,
      reason: reason || null,
    });
  }
  doc.deleted_at = new Date();
  await doc.save();
  emitDocStatus({ documentId: doc.id, status: 'deleted' });
};

const restore = async (id, user) => {
  const doc = await Document.findOne({
    where: { id },
  });
  if (!doc || !doc.deleted_at) throw { status: 404, message: 'Không có bản ghi để khôi phục' };
  if (doc.created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền' };
  }
  doc.deleted_at = null;
  await doc.save();
  const full = await Document.findByPk(doc.id, { include: includeDefault });
  emitDocStatus({ documentId: doc.id, status: full.status });
  return serializeDocument(full);
};

const submit = async (id, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền gửi duyệt' };
  }
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy' };
  if (doc.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu gửi duyệt' };
  }
  if (doc.status !== DOCUMENT_STATUS.DRAFT) {
    throw { status: 400, message: 'Chỉ gửi duyệt từ trạng thái nháp' };
  }

  const creator = await User.findByPk(doc.created_by, { attributes: ['system_role'] });
  const creatorIsDirector = creator?.system_role === SYSTEM_ROLES.VIEN_TRUONG;
  const now = new Date();
  if (creatorIsDirector) {
    await archiveSiblingPublished(doc);
    doc.status = DOCUMENT_STATUS.PUBLISHED;
    doc.published_at = now;
    doc.reviewed_by = user.id;
    doc.reviewed_at = now;
    doc.review_note = null;
    doc.submitted_at = now;
    await doc.save();
    emitDocStatus({ documentId: doc.id, status: DOCUMENT_STATUS.PUBLISHED });
    return serializeDocument(await Document.findByPk(doc.id, { include: includeDefault }));
  }

  doc.status = DOCUMENT_STATUS.PENDING;
  doc.submitted_at = now;
  await doc.save();
  await notificationService.notifyInstituteManagers({
    title: 'Tài liệu chờ duyệt',
    message: `Tài liệu "${doc.title}" vừa được submit để duyệt`,
    actionUrl: `/publication/books/documents/approvals`,
    metadata: { entityType: 'document', entityId: doc.id },
    eventName: 'ENTITY_SUBMITTED',
    eventPayload: { entityType: 'document', entityId: doc.id },
  });
  emitDocPending({ documentId: doc.id });
  emitDocStatus({ documentId: doc.id, status: DOCUMENT_STATUS.PENDING });
  return serializeDocument(await Document.findByPk(doc.id, { include: includeDefault }));
};

const approve = async (id, body, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng phê duyệt' };
  }
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy' };
  if (doc.status !== DOCUMENT_STATUS.PENDING) {
    throw { status: 400, message: 'Tài liệu không ở trạng thái chờ duyệt' };
  }
  const note = body?.review_note != null ? String(body.review_note).trim() : null;
  const now = new Date();
  await archiveSiblingPublished(doc);
  doc.status = DOCUMENT_STATUS.PUBLISHED;
  doc.published_at = now;
  doc.reviewed_by = user.id;
  doc.reviewed_at = now;
  doc.review_note = note || null;
  await doc.save();
  await notificationService.createAndPushNotification({
    userId: doc.created_by,
    title: 'Tài liệu đã được duyệt',
    message: `Tài liệu "${doc.title}" đã được viện trưởng duyệt`,
    type: 'info',
    actionUrl: `/publication/books/documents/${doc.id}`,
    metadata: { entityType: 'document', entityId: doc.id },
    eventName: 'ENTITY_APPROVED',
    eventPayload: { entityType: 'document', entityId: doc.id },
  });
  await auditService.log(AUDIT_ACTIONS.DOCUMENT_APPROVED, user.id, doc.created_by, {
    entity_type: 'document',
    entity_id: doc.id,
    title: doc.title,
    previous_status: DOCUMENT_STATUS.PENDING,
    new_status: DOCUMENT_STATUS.PUBLISHED,
    review_note: doc.review_note,
  });
  emitDocStatus({ documentId: doc.id, status: DOCUMENT_STATUS.PUBLISHED });
  return serializeDocument(await Document.findByPk(doc.id, { include: includeDefault }));
};

const reject = async (id, body, user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng từ chối' };
  }
  const doc = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!doc) throw { status: 404, message: 'Không tìm thấy' };
  if (doc.status !== DOCUMENT_STATUS.PENDING) {
    throw { status: 400, message: 'Tài liệu không ở trạng thái chờ duyệt' };
  }
  const review_note = body?.review_note != null ? String(body.review_note).trim() : '';
  if (!review_note) throw { status: 400, message: 'Yêu cầu lý do từ chối' };
  const now = new Date();
  doc.status = DOCUMENT_STATUS.REJECTED;
  doc.review_note = review_note;
  doc.reviewed_by = user.id;
  doc.reviewed_at = now;
  await doc.save();
  await auditService.log(AUDIT_ACTIONS.DOCUMENT_REJECTED, user.id, doc.created_by, {
    entity_type: 'document',
    entity_id: doc.id,
    title: doc.title,
    previous_status: DOCUMENT_STATUS.PENDING,
    new_status: DOCUMENT_STATUS.REJECTED,
    review_note: doc.review_note,
  });
  try {
    const note = String(doc.review_note || '').trim();
    const reasonPreview = note.length > 200 ? `${note.slice(0, 200)}…` : note;
    await notificationService.createAndPushNotification({
      userId: doc.created_by,
      title: 'Tài liệu bị từ chối',
      message: reasonPreview
        ? `Tài liệu "${doc.title}" đã bị từ chối. Lý do: ${reasonPreview}`
        : `Tài liệu "${doc.title}" đã bị từ chối.`,
      type: 'warning',
      actionUrl: `/publication/books/documents/${doc.id}`,
      metadata: { entityType: 'document', entityId: doc.id },
      eventName: 'ENTITY_REJECTED',
      eventPayload: { entityType: 'document', entityId: doc.id },
    });
  } catch (e) {
    logger.error('notify document rejected:', e);
  }
  emitDocStatus({ documentId: doc.id, status: DOCUMENT_STATUS.REJECTED });
  return serializeDocument(await Document.findByPk(doc.id, { include: includeDefault }));
};

const createVersion = async (id, body, file, user) => {
  if (!CREATOR_ROLES.has(user.system_role)) {
    throw { status: 403, message: 'Không có quyền' };
  }
  const parent = await Document.findOne({
    where: { id, deleted_at: null },
  });
  if (!parent) throw { status: 404, message: 'Không tìm thấy' };
  if (parent.created_by !== user.id) {
    throw { status: 403, message: 'Chỉ chủ sở hữu' };
  }
  if (parent.status !== DOCUMENT_STATUS.REJECTED) {
    throw { status: 400, message: 'Chỉ tạo phiên bản mới từ bản REJECTED' };
  }

  const maxVer = await Document.max('version_number', {
    where: { version_group_id: parent.version_group_id, deleted_at: null },
  });
  const nextNum = (maxVer || 0) + 1;

  await parent.update({ is_latest: false });

  const b = body || {};
  let pdf_url = parent.pdf_url;
  let file_path = parent.file_path;
  let cloudinary_public_id = parent.cloudinary_public_id;
  let checksum_sha256 = parent.checksum_sha256;
  let source_type = parent.source_type;

  if (file) {
    const up = await uploadDocumentFile(file.buffer, file.originalname);
    file_path = up.secure_url;
    cloudinary_public_id = up.public_id;
    checksum_sha256 = up.checksum_sha256;
    pdf_url = null;
    source_type = 'upload';
  }

  const row = await Document.create({
    title: b.title != null ? String(b.title).trim() || parent.title : parent.title,
    description: b.description !== undefined ? (b.description != null ? String(b.description) : null) : parent.description,
    category_id: parent.category_id,
    doc_type: parent.doc_type,
    manufacturer: parent.manufacturer,
    technical_metadata: parent.technical_metadata,
    pdf_url,
    file_path,
    cloudinary_public_id,
    source_type,
    checksum_sha256,
    version_group_id: parent.version_group_id,
    version_number: nextNum,
    parent_document_id: parent.id,
    is_latest: true,
    status: DOCUMENT_STATUS.DRAFT,
    created_by: user.id,
  });

  const full = await Document.findByPk(row.id, { include: includeDefault });
  emitDocStatus({ documentId: row.id, status: DOCUMENT_STATUS.DRAFT });
  return serializeDocument(full);
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
  serializeDocument,
};
