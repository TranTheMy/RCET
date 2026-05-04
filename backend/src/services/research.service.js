const { Op } = require('sequelize');
const logger = require('../utils/logger');
const {
  SYSTEM_ROLES,
  RESEARCH_STATUS,
  AUDIT_ACTIONS,
} = require('../config/constants');
const { uploadBuffer, isConfigured } = require('../config/cloudinary');
const { Research, User } = require('../models');
const { sendResearchApprovedEmail, sendResearchRejectedEmail } = require('../utils/email');
const notificationService = require('./notification.service');
const realtimeService = require('./realtime.service');
const auditService = require('./audit.service');
const { trackResearchPublicDownloadAndAutoBan } = require('./downloadAbuse.service');

function isDirectorRole(role) {
  return role === SYSTEM_ROLES.VIEN_TRUONG;
}

function notifyResearchSubmitterByEmail(item, kind) {
  if (!item?.created_by) return;
  void (async () => {
    try {
      const u = await User.findByPk(item.created_by, { attributes: ['email', 'full_name'] });
      if (!u?.email) return;
      if (kind === 'approved') {
        await sendResearchApprovedEmail(u.email, u.full_name, item.title, {
          isPublic: item.is_public,
          reviewNote: item.review_note,
        });
      } else {
        await sendResearchRejectedEmail(u.email, u.full_name, item.title, item.review_note);
      }
    } catch (err) {
      logger.error('research notify email:', err?.message || err);
    }
  })();
}

function truncateNotifyText(s, max = 220) {
  const t = String(s || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function parseTags(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, 30);
  }
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) {
        return j
          .map((t) => String(t).trim())
          .filter(Boolean)
          .map((t) => t.slice(0, 64))
          .slice(0, 30);
      }
    } catch {
      /* fallthrough */
    }
  }
  return s
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 64))
    .slice(0, 30);
}

function escapeLike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Bộ lọc list (query string): q, tags, impact_rank(s), peer_reviewed, open_access, source_type, readonly_highlight.
 */
function buildResearchListFilterParts(query) {
  const q = query || {};
  const parts = [];

  const search = String(q.q || '').trim();
  if (search) {
    const t = `%${escapeLike(search)}%`;
    parts.push({
      [Op.or]: [
        { title: { [Op.like]: t } },
        { authors: { [Op.like]: t } },
        { journal: { [Op.like]: t } },
        { description: { [Op.like]: t } },
        { doi: { [Op.like]: t } },
        { tags: { [Op.like]: t } },
      ],
    });
  }

  let tagList = [];
  if (q.tags_json != null && String(q.tags_json).trim() !== '') {
    try {
      const arr = JSON.parse(String(q.tags_json));
      if (Array.isArray(arr)) {
        tagList = arr.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fallthrough */
    }
  }
  if (tagList.length === 0 && q.tags != null && q.tags !== '') {
    if (Array.isArray(q.tags)) {
      tagList = q.tags.map((x) => String(x).trim()).filter(Boolean);
    } else {
      tagList = String(q.tags)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  if (tagList.length > 0) {
    parts.push({
      [Op.or]: tagList.map((tag) => ({
        tags: { [Op.like]: `%${escapeLike(tag)}%` },
      })),
    });
  }

  const ranksRaw = q.impact_rank ?? q.impact_ranks;
  if (ranksRaw != null && ranksRaw !== '') {
    const ranks = Array.isArray(ranksRaw)
      ? ranksRaw.map((x) => String(x).trim()).filter(Boolean)
      : String(ranksRaw)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    if (ranks.length > 0) {
      parts.push({ impact_rank: { [Op.in]: ranks } });
    }
  }

  const peer = String(q.peer_reviewed || q.peer || 'all').toLowerCase();
  if (peer === 'yes') parts.push({ is_peer_reviewed: true });
  else if (peer === 'no') parts.push({ is_peer_reviewed: false });

  const openA = String(q.open_access || q.open || 'all').toLowerCase();
  if (openA === 'yes') parts.push({ is_open_access: true });
  else if (openA === 'no') parts.push({ is_open_access: false });

  const st = String(q.source_type || 'all').toLowerCase();
  if (st === 'upload' || st === 'link') {
    parts.push({ source_type: st });
  }

  const readonlySegment = {
    [Op.or]: [
      { source_type: 'link' },
      {
        [Op.and]: [
          { source_type: 'upload' },
          {
            [Op.or]: [{ file_url: null }, { file_url: '' }],
          },
          {
            [Op.or]: [{ file_path: null }, { file_path: '' }],
          },
        ],
      },
    ],
  };

  const seg = String(q.segment || '').toLowerCase();
  if (seg === 'downloadable') {
    parts.push({
      [Op.and]: [
        { source_type: 'upload' },
        {
          [Op.not]: {
            [Op.and]: [
              { [Op.or]: [{ file_url: null }, { file_url: '' }] },
              { [Op.or]: [{ file_path: null }, { file_path: '' }] },
            ],
          },
        },
      ],
    });
  } else if (seg === 'readonly') {
    parts.push(readonlySegment);
  } else {
    const ro =
      q.readonly_highlight === true ||
      q.readonly_highlight === 'true' ||
      q.readonly_highlight === '1' ||
      q.readonly_highlight === 1;
    if (ro) {
      parts.push(readonlySegment);
    }
  }

  return parts;
}

function parseResearchPagination(query) {
  const q = query || {};
  const limitProvided = q.limit !== undefined && q.limit !== null && String(q.limit).trim() !== '';
  if (!limitProvided) {
    return { paginate: false, page: 1, limit: null };
  }
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 10));
  return { paginate: true, page, limit };
}

async function runResearchList({ baseWhere, query }) {
  const q = query || {};
  const filterParts = buildResearchListFilterParts(q);
  const where =
    filterParts.length > 0 ? { [Op.and]: [baseWhere, ...filterParts] } : baseWhere;

  const { paginate, page, limit } = parseResearchPagination(q);
  const opts = {
    where,
    order: [['updated_at', 'DESC']],
  };
  if (paginate) {
    opts.limit = limit;
    opts.offset = (page - 1) * limit;
  }

  const { count, rows } = await Research.findAndCountAll(opts);
  const items = rows.map(serializeResearch);
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
}

function serializeResearch(row) {
  if (!row) return null;
  const j = row.get ? row.get({ plain: true }) : row;
  let tags = [];
  if (j.tags) {
    try {
      const p = JSON.parse(j.tags);
      tags = Array.isArray(p) ? p : [];
    } catch {
      tags = [];
    }
  }
  return {
    id: j.id,
    title: j.title,
    authors: j.authors,
    published_date: j.published_date,
    journal: j.journal,
    volume: j.volume,
    issue: j.issue,
    pages: j.pages,
    publisher: j.publisher,
    description: j.description,
    total_citations: j.total_citations,
    pdf_url: j.pdf_url ?? null,
    file_url: j.file_url ?? null,
    file_path: j.file_path ?? null,
    source_type: j.source_type,
    impact_rank: j.impact_rank,
    is_peer_reviewed: Boolean(j.is_peer_reviewed),
    is_open_access: Boolean(j.is_open_access),
    doi: j.doi,
    tags,
    created_by: j.created_by,
    status: j.status,
    is_public: Boolean(j.is_public),
    review_note: j.review_note ?? null,
    reviewed_by: j.reviewed_by ?? null,
    reviewed_at: j.reviewed_at ? new Date(j.reviewed_at).toISOString() : null,
    created_at: j.created_at ? new Date(j.created_at).toISOString() : null,
    updated_at: j.updated_at ? new Date(j.updated_at).toISOString() : null,
    deleted_at: j.deleted_at ? new Date(j.deleted_at).toISOString() : null,
  };
}

function hasUploadFile(item) {
  return (
    item &&
    item.source_type === 'upload' &&
    item.file_url &&
    /^https?:\/\//i.test(String(item.file_url))
  );
}

function canPreviewResearch(item, user, { publicRoute }) {
  if (!hasUploadFile(item)) return false;
  if (item.deleted_at) return false;
  if (publicRoute) {
    return item.status === RESEARCH_STATUS.APPROVED && item.is_public;
  }
  if (!user) return false;
  if (item.status === RESEARCH_STATUS.APPROVED) return true;
  if (item.created_by === user.id) return true;
  if (user.system_role === SYSTEM_ROLES.VIEN_TRUONG) return true;
  return false;
}

async function fetchFileBuffer(fileUrl) {
  const r = await fetch(fileUrl, { redirect: 'follow' });
  if (!r.ok) {
    logger.error('research preview upstream', r.status, fileUrl?.slice?.(0, 80));
    throw { status: 502, message: 'Không tải được file từ kho lưu trữ' };
  }
  const ct = r.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await r.arrayBuffer());
  return { buffer: buf, contentType: ct };
}

// =====================================================
// API
// =====================================================

function parseResearchSubmitIsPublic(b) {
  if (!b) return false;
  if (b.is_public === true || String(b.is_public).toLowerCase() === 'true') return true;
  if (b.isPublic === true || String(b.isPublic).toLowerCase() === 'true') return true;
  return false;
}

const submit = async (body, file, user) => {
  const userId = user?.id;
  if (!userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  const b = body || {};
  const errors = [];
  const requireText = (field, label) => {
    if (!String(b[field] || '').trim()) {
      errors.push({ field, message: `${label} là bắt buộc` });
    }
  };

  requireText('title', 'Tiêu đề bài báo');
  requireText('authors', 'Tác giả');
  requireText('published_date', 'Ngày công bố');
  requireText('journal', 'Tạp chí/Hội nghị');
  requireText('pages', 'Số trang');
  requireText('publisher', 'Nhà xuất bản');
  requireText('description', 'Tóm tắt nghiên cứu');
  requireText('doi', 'DOI');

  const volumeNum = parseInt(b.volume, 10);
  const issueNum = parseInt(b.issue, 10);
  if (!Number.isFinite(volumeNum) || volumeNum < 1) {
    errors.push({ field: 'volume', message: 'Tập (volume) phải là số nguyên dương' });
  }
  if (!Number.isFinite(issueNum) || issueNum < 1) {
    errors.push({ field: 'issue', message: 'Số (issue) phải là số nguyên dương' });
  }

  // --- PHẦN SỬA LỖI LOGIC KIỂM TRA FILE VÀ LINK CHUẨN XÁC ---
  const sourceType = b.source_type === 'link' ? 'link' : 'upload';
  
  if (sourceType === 'upload') {
    if (!file) {
      errors.push({
        field: 'file',
        message: 'Vui lòng đính kèm file tài liệu (PDF, Word, Excel, …)',
      });
    } else if (file.size) { 
      const MAX_FILE_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        const actualSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        errors.push({
          field: 'file',
          message: `File quá lớn (${actualSizeMB}MB). Dung lượng tối đa cho phép là 25MB.`
        });
      }
    }
  } else if (sourceType === 'link') {
    if (!(b.pdf_url && String(b.pdf_url).trim())) {
      errors.push({ field: 'pdf_url', message: 'Vui lòng nhập URL bài báo' });
    } else if (!/^https?:\/\//i.test(String(b.pdf_url).trim())) {
      errors.push({ field: 'pdf_url', message: 'URL bài báo phải bắt đầu bằng http:// hoặc https://' });
    }
  }
  // ------------------------------------------------------------

  if (errors.length > 0) {
    throw { status: 400, message: 'Validation error', errors };
  }

  if (file && !isConfigured()) {
    throw { status: 503, message: 'Cloudinary chưa cấu hình (CLOUDINARY_* trong .env)' };
  }

  let file_url = null;
  let file_path = null;
  if (file && file.buffer) {
    try {
      const uploaded = await uploadBuffer(file.buffer, {
        folder: 'vkslab/research',
        resource_type: 'raw',
        originalFilename: file.originalname || 'document.pdf',
      });
      file_url = uploaded.secure_url;
      file_path = uploaded.public_id;
    } catch (err) {
      logger.error('research upload:', err?.message || err);
      const msg =
        err?.error?.message ||
        err?.message ||
        'Gửi bài thất bại';
      const code =
        err?.http_code && err.http_code >= 400 && err.http_code < 600 ? err.http_code : 500;
      throw { status: code, message: msg };
    }
  }

  const validRanks = ['Q1', 'Q2', 'Q3', 'Q4', 'No Rank'];
  const rank = validRanks.includes(b.impact_rank) ? b.impact_rank : 'No Rank';
  const tags = parseTags(b.tags);

  const creatorIsDirector = user.system_role === SYSTEM_ROLES.VIEN_TRUONG;
  const now = new Date();
  const autoApproved = creatorIsDirector;
  /** Chỉ viện trưởng gửi kèm is_public khi tự duyệt; các role khác chờ duyệt → luôn false. */
  const initialIsPublic = autoApproved ? parseResearchSubmitIsPublic(b) : false;

  const row = await Research.create({
    title: String(b.title || '').trim(),
    authors: String(b.authors || '').trim(),
    published_date: String(b.published_date || '').trim(),
    journal: String(b.journal || '').trim(),
    volume: volumeNum,
    issue: issueNum,
    pages: String(b.pages || '').trim(),
    publisher: String(b.publisher || '').trim(),
    description: String(b.description || '').trim(),
    total_citations: parseInt(b.total_citations, 10) || 0,
    pdf_url: sourceType === 'link' ? String(b.pdf_url || '').trim() || null : null,
    file_url,
    file_path,
    source_type: sourceType,
    impact_rank: rank,
    is_peer_reviewed: String(b.is_peer_reviewed) === 'true',
    is_open_access: String(b.is_open_access) === 'true',
    doi: String(b.doi || '').trim(),
    tags: JSON.stringify(tags),
    created_by: userId,
    status: autoApproved ? RESEARCH_STATUS.APPROVED : RESEARCH_STATUS.PENDING,
    is_public: initialIsPublic,
    review_note: null,
    reviewed_by: autoApproved ? userId : null,
    reviewed_at: autoApproved ? now : null,
  });

  if (!autoApproved) {
    await notificationService.notifyInstituteManagers({
      title: 'Bài research chờ duyệt',
      message: `Research "${row.title}" vừa được submit để duyệt`,
      actionUrl: `/publication/research/approvals`,
      metadata: { entityType: 'research', entityId: row.id },
      eventName: 'ENTITY_SUBMITTED',
      eventPayload: { entityType: 'research', entityId: row.id },
    });
    realtimeService.emitResearchPendingSubmitted({ researchId: row.id, title: row.title });
  }

  await auditService.log(AUDIT_ACTIONS.RESEARCH_CREATED, userId, null, {
    entity_type: 'research',
    entity_id: row.id,
    title: row.title,
    source_type: row.source_type,
    status: row.status,
    is_public: row.is_public,
  });

  return serializeResearch(row);
};

const listPending = async () => {
  const rows = await Research.findAll({
    where: { status: RESEARCH_STATUS.PENDING, deleted_at: null },
    order: [['updated_at', 'DESC']],
  });
  return { items: rows.map(serializeResearch) };
};

const approve = async (id, body, reviewerUserId) => {
  const { isPublic, review_note } = body || {};
  const row = await Research.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy bài' };
  if (row.status !== RESEARCH_STATUS.PENDING) {
    throw { status: 400, message: 'Bài không còn ở trạng thái chờ duyệt' };
  }
  const now = new Date();
  await row.update({
    status: RESEARCH_STATUS.APPROVED,
    is_public: Boolean(isPublic),
    review_note:
      review_note != null && String(review_note).trim() ? String(review_note).trim() : null,
    reviewed_by: reviewerUserId,
    reviewed_at: now,
  });
  await row.reload();
  const out = serializeResearch(row);
  await auditService.log(AUDIT_ACTIONS.RESEARCH_APPROVED, reviewerUserId, row.created_by, {
    entity_type: 'research',
    entity_id: row.id,
    title: row.title,
    previous_status: RESEARCH_STATUS.PENDING,
    new_status: RESEARCH_STATUS.APPROVED,
    is_public: out.is_public,
    review_note: out.review_note,
  });
  await notificationService.createAndPushNotification({
    userId: row.created_by,
    title: 'Research đã được duyệt',
    message: `Research "${row.title}" đã được viện trưởng duyệt`,
    type: 'info',
    actionUrl: `/publication/research/${row.id}`,
    metadata: { entityType: 'research', entityId: row.id },
    eventName: 'ENTITY_APPROVED',
    eventPayload: { entityType: 'research', entityId: row.id },
  });
  notifyResearchSubmitterByEmail(out, 'approved');
  realtimeService.emitResearchStatusUpdated({
    researchId: row.id,
    status: RESEARCH_STATUS.APPROVED,
    title: row.title,
  });
  return out;
};

const reject = async (id, body, reviewerUserId) => {
  const { review_note } = body || {};
  if (!review_note || !String(review_note).trim()) {
    throw { status: 400, message: 'Vui lòng nhập lý do từ chối' };
  }
  const row = await Research.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy bài' };
  if (row.status !== RESEARCH_STATUS.PENDING) {
    throw { status: 400, message: 'Bài không còn ở trạng thái chờ duyệt' };
  }
  const now = new Date();
  await row.update({
    status: RESEARCH_STATUS.REJECTED,
    review_note: String(review_note).trim(),
    reviewed_by: reviewerUserId,
    reviewed_at: now,
  });
  await row.reload();
  const out = serializeResearch(row);
  await auditService.log(AUDIT_ACTIONS.RESEARCH_REJECTED, reviewerUserId, row.created_by, {
    entity_type: 'research',
    entity_id: row.id,
    title: row.title,
    previous_status: RESEARCH_STATUS.PENDING,
    new_status: RESEARCH_STATUS.REJECTED,
    review_note: out.review_note,
  });
  notifyResearchSubmitterByEmail(out, 'rejected');
  try {
    const reason = truncateNotifyText(out.review_note);
    await notificationService.createAndPushNotification({
      userId: row.created_by,
      title: 'Research bị từ chối',
      message: reason
        ? `Research "${row.title}" đã bị từ chối. Lý do: ${reason}`
        : `Research "${row.title}" đã bị từ chối.`,
      type: 'warning',
      actionUrl: `/publication/research/${row.id}`,
      metadata: { entityType: 'research', entityId: row.id },
      eventName: 'ENTITY_REJECTED',
      eventPayload: { entityType: 'research', entityId: row.id },
    });
  } catch (e) {
    logger.error('notify research rejected:', e);
  }
  realtimeService.emitResearchStatusUpdated({
    researchId: row.id,
    status: RESEARCH_STATUS.REJECTED,
    title: row.title,
  });
  return out;
};

const listPublic = async (query = {}) => {
  return runResearchList({
    baseWhere: {
      status: RESEARCH_STATUS.APPROVED,
      is_public: true,
      deleted_at: null,
    },
    query,
  });
};

const listInternal = async (query = {}) => {
  return runResearchList({
    baseWhere: {
      status: RESEARCH_STATUS.APPROVED,
      deleted_at: null,
    },
    query,
  });
};

async function aggregateResearchTagCounts(whereBase) {
  const rows = await Research.findAll({
    where: whereBase,
    attributes: ['tags'],
  });
  const tagCounts = {};
  for (const row of rows) {
    const j = row.get({ plain: true });
    let tags = [];
    try {
      const p = JSON.parse(j.tags || '[]');
      tags = Array.isArray(p) ? p : [];
    } catch {
      tags = [];
    }
    for (const raw of tags) {
      const x = String(raw).trim();
      if (!x) continue;
      tagCounts[x] = (tagCounts[x] || 0) + 1;
    }
  }
  return { tagCounts };
}

const publicTagFacets = async () => {
  return aggregateResearchTagCounts({
    status: RESEARCH_STATUS.APPROVED,
    is_public: true,
    deleted_at: null,
  });
};

const internalTagFacets = async () => {
  return aggregateResearchTagCounts({
    status: RESEARCH_STATUS.APPROVED,
    deleted_at: null,
  });
};

const listMine = async (userId, query = {}) => {
  const includeDeleted =
    String(query.include_deleted || '').toLowerCase() === '1' ||
    String(query.include_deleted || '').toLowerCase() === 'true';
  const where = { created_by: userId };
  if (includeDeleted) {
    where.deleted_at = { [Op.ne]: null };
  } else {
    where.deleted_at = null;
  }
  const rows = await Research.findAll({
    where,
    order: [['updated_at', 'DESC']],
  });
  return { items: rows.map(serializeResearch) };
};

const listWithdrawn = async (user) => {
  if (!isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Chỉ viện trưởng xem được danh sách đã thu hồi' };
  }
  const rows = await Research.findAll({
    where: { deleted_at: { [Op.ne]: null } },
    order: [['deleted_at', 'DESC']],
  });
  return { items: rows.map(serializeResearch) };
};

const getPublicById = async (id) => {
  const row = await Research.findOne({
    where: {
      id,
      status: RESEARCH_STATUS.APPROVED,
      is_public: true,
      deleted_at: null,
    },
  });
  if (!row) throw { status: 404, message: 'Không tìm thấy bài nghiên cứu' };
  return serializeResearch(row);
};

const getById = async (id, user) => {
  const row = await Research.findByPk(id);
  if (!row) throw { status: 404, message: 'Không tìm thấy bài nghiên cứu' };
  const item = serializeResearch(row);
  const uid = user.id;
  const role = user.system_role;
  if (item.deleted_at) {
    if (item.created_by === uid || isDirectorRole(role)) return item;
    throw { status: 404, message: 'Không tìm thấy bài nghiên cứu' };
  }
  if (item.status === RESEARCH_STATUS.APPROVED) return item;
  if (item.created_by === uid) return item;
  if (role === SYSTEM_ROLES.VIEN_TRUONG) return item;
  throw { status: 403, message: 'Không có quyền xem bài này' };
};

const getPreviewPublic = async (id, user = null, requestMeta = {}) => {
  const row = await Research.findOne({ where: { id, deleted_at: null } });
  const item = row ? serializeResearch(row) : null;
  if (!item || !canPreviewResearch(item, null, { publicRoute: true })) {
    throw { status: 404, message: 'Không tìm thấy file' };
  }
  const abuse = await trackResearchPublicDownloadAndAutoBan({
    user,
    ip: requestMeta.ip || null,
    metadata: {
      entity_type: 'research',
      entity_id: item.id,
      title: item.title,
      via: 'preview_public',
      ip: requestMeta.ip || null,
      user_agent: requestMeta.userAgent || null,
    },
  });
  if (abuse.blocked) {
    throw { status: 429, message: 'Truy cập quá nhanh. Vui lòng thử lại sau.' };
  }
  if (abuse.banned) {
    throw { status: 403, message: 'Tài khoản đã bị khóa do hành vi tải dữ liệu bất thường.' };
  }
  if (user?.id) {
    await auditService.log(AUDIT_ACTIONS.RESEARCH_DOWNLOADED, user.id, item.created_by, {
      entity_type: 'research',
      entity_id: item.id,
      title: item.title,
      via: 'preview_public',
      is_public: item.is_public,
      ip: requestMeta.ip || null,
      user_agent: requestMeta.userAgent || null,
    });
  }
  return fetchFileBuffer(item.file_url);
};

const getPreviewAuth = async (id, user) => {
  const row = await Research.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy bài' };
  const item = serializeResearch(row);
  if (!canPreviewResearch(item, user, { publicRoute: false })) {
    throw { status: 403, message: 'Không có quyền xem file này' };
  }
  await auditService.log(AUDIT_ACTIONS.RESEARCH_DOWNLOADED, user.id, item.created_by, {
    entity_type: 'research',
    entity_id: item.id,
    title: item.title,
    via: 'preview_auth',
    is_public: item.is_public,
  });
  if (item.is_public) {
    const abuse = await trackResearchPublicDownloadAndAutoBan({
      user,
      metadata: {
        entity_type: 'research',
        entity_id: item.id,
        title: item.title,
        via: 'preview_auth',
        ip: null,
        user_agent: null,
      },
    });
    if (abuse.banned) {
      throw { status: 403, message: 'Tài khoản đã bị khóa do hành vi tải dữ liệu bất thường.' };
    }
    if (abuse.blocked) {
      throw { status: 429, message: 'Truy cập quá nhanh. Vui lòng thử lại sau.' };
    }
  }
  return fetchFileBuffer(item.file_url);
};

const remove = async (id, user, body = {}) => {
  const row = await Research.findOne({ where: { id, deleted_at: null } });
  if (!row) throw { status: 404, message: 'Không tìm thấy bài' };
  const isOwner = row.created_by === user.id;
  const isDirector = isDirectorRole(user.system_role);
  if (!isOwner && !isDirector) {
    throw { status: 403, message: 'Không có quyền xóa' };
  }
  if (!isDirector) {
    if (![RESEARCH_STATUS.PENDING, RESEARCH_STATUS.REJECTED].includes(row.status)) {
      throw { status: 400, message: 'Chỉ xóa bài chờ duyệt hoặc bị từ chối' };
    }
  }
  const reason = body?.reason != null ? String(body.reason).trim() : '';
  row.deleted_at = new Date();
  await row.save();
  await auditService.log(AUDIT_ACTIONS.RESEARCH_WITHDRAWN, user.id, row.created_by, {
    entity_type: 'research',
    entity_id: row.id,
    title: row.title,
    status: row.status,
    is_public: row.is_public,
    reason: reason || null,
  });
  realtimeService.emitResearchStatusUpdated({
    researchId: row.id,
    status: 'withdrawn',
    title: row.title,
  });
  return serializeResearch(row);
};

const restore = async (id, user) => {
  const row = await Research.findOne({ where: { id } });
  if (!row || !row.deleted_at) throw { status: 404, message: 'Không có bản ghi để khôi phục' };
  if (row.created_by !== user.id && !isDirectorRole(user.system_role)) {
    throw { status: 403, message: 'Không có quyền khôi phục' };
  }
  row.deleted_at = null;
  await row.save();
  const out = serializeResearch(row);
  realtimeService.emitResearchStatusUpdated({
    researchId: row.id,
    status: row.status,
    title: row.title,
  });
  return out;
};

module.exports = {
  submit,
  listPending,
  approve,
  reject,
  listPublic,
  listInternal,
  publicTagFacets,
  internalTagFacets,
  listMine,
  listWithdrawn,
  remove,
  restore,
  getPublicById,
  getById,
  getPreviewPublic,
  getPreviewAuth,
};
