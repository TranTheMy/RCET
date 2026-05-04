const env = require('../config/env');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { DOCUMENT_STATUS, CURRICULUM_STATUS } = require('../config/constants');

/** Từ dừng khi tách từ khóa tìm kiếm tài liệu / giáo trình */
const SEARCH_STOP_WORDS = new Set([
  'và', 'của', 'là', 'có', 'cho', 'với', 'tôi', 'bạn', 'các', 'một', 'những', 'này', 'đó', 'có', 'gì', 'về', 'the', 'a', 'an', 'is', 'are', 'how', 'what', 'when', 'where', 'why', 'which', 'who', 'me', 'my', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'not', 'this', 'that', 'can', 'you', 'tell',
]);

/** Chip / linh kiện / tài liệu kỹ thuật (kho Documents) */
const CHIP_INTENT_RE =
  /chip|linh kiện|linh kien|vi mạch|vi mach|datasheet|data\s*sheet|datasheets|ic\b|mcu|soc|fpga|stm32|esp32|embedded|semiconductor|tài liệu kỹ thuật|tai lieu ky thuat|manual|schematic|pinout|sơ đồ chân|pin\s*out|reference|hdl|verilog|vhdl|board|nhiệt|thermal|package/i;

/** Giáo trình / Curriculum (không nhầm với hub Research papers — ưu tiên từ khóa học thuật) */
const CURRICULUM_INTENT_RE =
  /giáo trình|giao trinh|curriculum|học phần|hoc phan|syllabus|bài giảng|bai giang|khóa học|khoa hoc|module|đào tạo|dao tao|slide|bài tập|bai tap|giáo án|giao an|outline|lecture|course|workbook/i;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

/**
 * Call Groq LLM API
 */
async function callGroq(messages, options = {}) {
  const apiKey = env.groq?.apiKey;
  if (!apiKey) {
    logger.warn('GROQ_API_KEY not set — AI assistant disabled');
    return null;
  }

  const body = {
    model: GROQ_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 512,
    top_p: 0.9,
  };

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error(`Groq API error: ${res.status} - ${errorText}`);
    if (res.status === 401) {
      throw Object.assign(new Error('GROQ_API_KEY is invalid or expired. Please update it in .env'), { status: 503 });
    }
    throw Object.assign(new Error('AI service temporarily unavailable'), { status: 503 });
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Tách từ khóa ngắn để LIKE trên DB (MSSQL)
 */
function tokenizeForSearch(text) {
  if (!text || typeof text !== 'string') return [];
  const raw = text
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"'«»“”\-+/\\|]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !SEARCH_STOP_WORDS.has(w));
  return [...new Set(raw)].slice(0, 8);
}

function buildLikeOrConditions(fields, tokens) {
  const conds = [];
  for (const token of tokens) {
    const t = token.length > 64 ? token.slice(0, 64) : token;
    for (const field of fields) {
      conds.push({ [field]: { [Op.like]: `%${t}%` } });
    }
  }
  return conds.length ? { [Op.or]: conds } : null;
}

/**
 * Gợi ý tài liệu kỹ thuật (Books / CHIP, datasheet, v.v.) — chỉ bản published, mới nhất.
 */
async function fetchChipDocumentSuggestions(userMessage, limit = 6) {
  if (!CHIP_INTENT_RE.test(userMessage)) {
    return [];
  }
  const { Document, Category } = require('../models');
  const tokens = tokenizeForSearch(userMessage);

  const baseWhere = {
    status: DOCUMENT_STATUS.PUBLISHED,
    is_latest: true,
    deleted_at: null,
  };

  let searchWhere = buildLikeOrConditions(['title', 'description', 'manufacturer', 'technical_metadata'], tokens);

  if (!searchWhere) {
    searchWhere = {
      [Op.or]: [
        { title: { [Op.like]: '%chip%' } },
        { title: { [Op.like]: '%datasheet%' } },
        { description: { [Op.like]: '%chip%' } },
        { technical_metadata: { [Op.like]: '%chip%' } },
        { manufacturer: { [Op.like]: '%stm%' } },
      ],
    };
  }

  try {
    const rows = await Document.findAll({
      where: { [Op.and]: [baseWhere, searchWhere] },
      attributes: ['id', 'title', 'doc_type', 'description'],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['updated_at', 'DESC']],
      limit,
    });
    return rows.map((d) => {
      const j = d.toJSON();
      return {
        id: j.id,
        title: j.title,
        doc_type: j.doc_type || null,
        category_name: j.category?.name || null,
      };
    });
  } catch (e) {
    logger.warn('fetchChipDocumentSuggestions failed', e.message);
    return [];
  }
}

/**
 * Gợi ý giáo trình (Curriculum / Research-style training docs) — chỉ approved, mới nhất.
 */
async function fetchResearchCurriculumSuggestions(userMessage, limit = 6) {
  if (!CURRICULUM_INTENT_RE.test(userMessage)) {
    return [];
  }
  const { Curriculum, Category } = require('../models');
  const tokens = tokenizeForSearch(userMessage);

  const baseWhere = {
    status: CURRICULUM_STATUS.APPROVED,
    is_latest: true,
    deleted_at: null,
  };

  let searchWhere = buildLikeOrConditions(['title', 'description', 'authors'], tokens);

  if (!searchWhere) {
    searchWhere = {
      [Op.or]: [
        { title: { [Op.like]: '%research%' } },
        { title: { [Op.like]: '%giáo trình%' } },
        { description: { [Op.like]: '%curriculum%' } },
      ],
    };
  }

  try {
    const rows = await Curriculum.findAll({
      where: { [Op.and]: [baseWhere, searchWhere] },
      attributes: ['id', 'title', 'description', 'authors'],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['updated_at', 'DESC']],
      limit,
    });
    return rows.map((c) => {
      const j = c.toJSON();
      return {
        id: j.id,
        title: j.title,
        authors: j.authors ? String(j.authors).slice(0, 200) : null,
        category_name: j.category?.name || null,
      };
    });
  } catch (e) {
    logger.warn('fetchResearchCurriculumSuggestions failed', e.message);
    return [];
  }
}

function formatDocSuggestionsForPrompt(chipDocuments, curriculums) {
  const lines = [];
  if (chipDocuments.length > 0) {
    lines.push('TÀI LIỆU KỸ THUẬT / CHIP (từ kho sách VKsLab — đã xuất bản):');
    chipDocuments.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.title}${d.category_name ? ` [${d.category_name}]` : ''}${d.doc_type ? ` (${d.doc_type})` : ''}`);
    });
  }
  if (curriculums.length > 0) {
    lines.push('GIÁO TRÌNH / ĐÀO TẠO (từ mục Curriculum — đã duyệt):');
    curriculums.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.title}${c.category_name ? ` [${c.category_name}]` : ''}${c.authors ? ` — ${c.authors}` : ''}`);
    });
  }
  return lines.length ? `\n${lines.join('\n')}\n` : '';
}

/**
 * Build system context about the user (tasks, projects, reports)
 */
async function buildUserContext(userId) {
  const { Task, Project, ProjectMember, WeeklyReport } = require('../models');

  const now = new Date();
  // Use local date (not UTC) so comparison with DATEONLY values is correct
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // User's active project memberships
  const memberships = await ProjectMember.findAll({
    where: { user_id: userId },
    include: [{
      model: Project,
      as: 'project',
      attributes: ['id', 'name', 'status', 'start_date', 'end_date'],
    }],
    raw: false,
  });

  const projectIds = memberships.map(m => m.project_id);
  const projects = memberships.map(m => m.project?.toJSON?.() || m.project).filter(Boolean);

  // Tasks assigned to user (not done)
  const pendingTasks = await Task.findAll({
    where: {
      assignee_id: userId,
      status: { [Op.ne]: 'done' },
    },
    include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
    order: [['due_date', 'ASC']],
    limit: 20,
  });

  // Overdue tasks
  const overdueTasks = pendingTasks.filter(
    t => t.due_date && new Date(t.due_date) < now,
  );

  // Tasks due today
  const todayTasks = pendingTasks.filter(
    t => t.due_date && String(t.due_date).slice(0, 10) === todayStr,
  );

  // Tasks due within 3 days
  const upcomingDeadline = new Date(now);
  upcomingDeadline.setDate(upcomingDeadline.getDate() + 3);
  const soonTasks = pendingTasks.filter(
    t => t.due_date && new Date(t.due_date) > now && new Date(t.due_date) <= upcomingDeadline,
  );

  // Overdue projects
  const overdueProjects = projects.filter(
    p => p.status !== 'done' && p.status !== 'archived' && p.end_date && new Date(p.end_date) < now,
  );

  // Weekly report stats (last 4 weeks)
  let reportStats = null;
  if (projectIds.length > 0) {
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const reports = await WeeklyReport.findAll({
      where: {
        user_id: userId,
        project_id: { [Op.in]: projectIds },
        created_at: { [Op.gte]: fourWeeksAgo },
      },
    });
    const expected = projectIds.length * 4;
    reportStats = {
      submitted: reports.length,
      expected,
      rate: expected > 0 ? Math.round((reports.length / expected) * 100) : 100,
    };
  }

  return {
    todayStr,
    pendingTasks: pendingTasks.map(t => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      project: t.project?.name,
    })),
    overdueTasks: overdueTasks.map(t => ({
      title: t.title,
      due_date: t.due_date,
      project: t.project?.name,
      daysOverdue: Math.ceil((now - new Date(t.due_date)) / 86400000),
    })),
    todayTasks: todayTasks.map(t => ({ title: t.title, project: t.project?.name })),
    soonTasks: soonTasks.map(t => ({ title: t.title, due_date: t.due_date, project: t.project?.name })),
    projects: projects.map(p => ({
      name: p.name,
      status: p.status,
      end_date: p.end_date,
      isOverdue: p.end_date && new Date(p.end_date) < now && p.status !== 'done' && p.status !== 'archived',
    })),
    overdueProjects: overdueProjects.map(p => ({
      name: p.name,
      end_date: p.end_date,
      daysOverdue: Math.ceil((now - new Date(p.end_date)) / 86400000),
    })),
    reportStats,
  };
}

/**
 * Generate smart notifications for the user (called by endpoint)
 */
async function getSmartNotifications(userId) {
  const ctx = await buildUserContext(userId);

  const notifications = [];

  // Rule-based notifications (no LLM needed)
  if (ctx.overdueTasks.length > 0) {
    notifications.push({
      type: 'alert',
      title: 'Task quá hạn',
      message: `Bạn có ${ctx.overdueTasks.length} task đã quá hạn: ${ctx.overdueTasks.map(t => `"${t.title}" (trễ ${t.daysOverdue} ngày)`).join(', ')}`,
    });
  }

  if (ctx.todayTasks.length > 0) {
    notifications.push({
      type: 'warning',
      title: 'Task đến hạn hôm nay',
      message: `Bạn có ${ctx.todayTasks.length} task cần hoàn thành hôm nay: ${ctx.todayTasks.map(t => `"${t.title}"`).join(', ')}`,
    });
  }

  if (ctx.soonTasks.length > 0) {
    notifications.push({
      type: 'info',
      title: 'Deadline sắp tới',
      message: `${ctx.soonTasks.length} task sắp đến hạn trong 3 ngày tới: ${ctx.soonTasks.map(t => `"${t.title}" (${t.due_date})`).join(', ')}`,
    });
  }

  if (ctx.overdueProjects.length > 0) {
    notifications.push({
      type: 'alert',
      title: 'Dự án trễ tiến độ',
      message: ctx.overdueProjects.map(p => `Dự án "${p.name}" đang trễ ${p.daysOverdue} ngày`).join('. '),
    });
  }

  if (ctx.reportStats && ctx.reportStats.rate < 70) {
    notifications.push({
      type: 'warning',
      title: 'Tỷ lệ nộp báo cáo thấp',
      message: `Tỷ lệ nộp báo cáo của bạn trong 4 tuần gần đây là ${ctx.reportStats.rate}% (${ctx.reportStats.submitted}/${ctx.reportStats.expected}). Bạn nên nộp đầy đủ hơn.`,
    });
  }

  // Suggestions
  const suggestions = [];
  if (ctx.pendingTasks.length > 5) {
    suggestions.push({
      type: 'suggestion',
      title: 'Quá nhiều task',
      message: `Bạn đang có ${ctx.pendingTasks.length} task chưa hoàn thành. Hãy ưu tiên các task có ưu tiên "urgent" hoặc "high" trước.`,
    });
  }

  const currentWeek = getISOWeek(new Date());
  if (ctx.reportStats && ctx.projects.length > 0) {
    suggestions.push({
      type: 'suggestion',
      title: 'Báo cáo tuần',
      message: `Tuần ${currentWeek}: Bạn có thể cần tạo báo cáo tuần cho ${ctx.projects.filter(p => p.status === 'active').length} dự án đang hoạt động.`,
    });
  }

  return {
    notifications,
    suggestions,
    summary: {
      pending_tasks: ctx.pendingTasks.length,
      overdue_tasks: ctx.overdueTasks.length,
      today_tasks: ctx.todayTasks.length,
      active_projects: ctx.projects.filter(p => p.status === 'active').length,
      overdue_projects: ctx.overdueProjects.length,
      report_rate: ctx.reportStats?.rate ?? null,
    },
  };
}

/**
 * Chat with AI assistant — context-aware conversation
 */
async function chat(userId, userMessage, conversationHistory = []) {
  const ctx = await buildUserContext(userId);
  const { User } = require('../models');
  const user = await User.findByPk(userId, { attributes: ['full_name', 'system_role'] });

  const [chipDocuments, researchCurriculums] = await Promise.all([
    fetchChipDocumentSuggestions(userMessage),
    fetchResearchCurriculumSuggestions(userMessage),
  ]);
  const suggestions = { chipDocuments, researchCurriculums };
  const libraryBlock = formatDocSuggestionsForPrompt(chipDocuments, researchCurriculums);

  const systemPrompt = `Bạn là "Trợ lý AI VKsLab" — trợ lý thông minh của hệ thống quản lý phòng thí nghiệm VKsLab (hệ thống quản lý phòng thí nghiệm R&D).

NHIỆM VỤ:
- Hỗ trợ người dùng quản lý công việc, dự án, task, báo cáo tuần
- Đưa ra thông báo thông minh, gợi ý hành động, cảnh báo rủi ro
- Trả lời ngắn gọn, rõ ràng, thân thiện, bằng tiếng Việt có dấu
- Khi người dùng hỏi về tình trạng công việc, phân tích dữ liệu thực từ hệ thống
- Khi người dùng hỏi về linh kiện / CHIP / datasheet / tài liệu kỹ thuật: trả lời hữu ích, rồi nếu có danh sách "TÀI LIỆU KỸ THUẬT / CHIP" bên dưới, hãy tóm tắt và khuyên họ mở mục Sách (Documents) trên VKsLab; không bịa thêm tên tài liệu ngoài danh sách.
- Khi hỏi về giáo trình, học phần, curriculum, đào tạo (Research-style): nếu có danh sách "GIÁO TRÌNH / ĐÀO TẠO", hãy gợi ý các mục đó và nhắc mục Giáo trình (Curriculum) trên VKsLab; không bịa thêm ngoài danh sách.

THÔNG TIN NGƯỜI DÙNG:
- Tên: ${user?.full_name || 'Unknown'}
- Vai trò: ${user?.system_role || 'member'}
- Ngày hiện tại: ${ctx.todayStr}

DỮ LIỆU HIỆN TẠI:
- Tổng task chưa xong: ${ctx.pendingTasks.length}
- Task quá hạn: ${ctx.overdueTasks.length}${ctx.overdueTasks.length > 0 ? ` (${ctx.overdueTasks.map(t => `"${t.title}" trễ ${t.daysOverdue} ngày`).join(', ')})` : ''}
- Task hôm nay: ${ctx.todayTasks.length}${ctx.todayTasks.length > 0 ? ` (${ctx.todayTasks.map(t => `"${t.title}"`).join(', ')})` : ''}
- Task sắp đến hạn (3 ngày): ${ctx.soonTasks.length}
- Dự án đang tham gia: ${ctx.projects.length} (active: ${ctx.projects.filter(p => p.status === 'active').length})
- Dự án trễ tiến độ: ${ctx.overdueProjects.length}${ctx.overdueProjects.length > 0 ? ` (${ctx.overdueProjects.map(p => `"${p.name}" trễ ${p.daysOverdue} ngày`).join(', ')})` : ''}
- Tỷ lệ nộp báo cáo (4 tuần): ${ctx.reportStats ? `${ctx.reportStats.rate}%` : 'N/A'}

DANH SÁCH TASK HIỆN TẠI:
${ctx.pendingTasks.slice(0, 10).map(t => `- [${t.status}] ${t.title} | ${t.priority} | hạn: ${t.due_date || 'không có'} | dự án: ${t.project || 'N/A'}`).join('\n') || '(Không có task nào)'}

DANH SÁCH DỰ ÁN:
${ctx.projects.map(p => `- ${p.name} | ${p.status} | kết thúc: ${p.end_date || 'N/A'}${p.isOverdue ? ' | ⚠ TRỊ' : ''}`).join('\n') || '(Không có dự án nào)'}
${libraryBlock ? `DỮ LIỆU THAM KHẢO TỪ CỘT SÁCH VKsLab (chỉ dùng các mục sau, không tự thêm):${libraryBlock}` : ''}

QUY TẮC:
1. Trả lời bằng tiếng Việt có dấu, không dùng emoji
2. Ngắn gọn, đi thẳng vào vấn đề (tối đa 200 từ)
3. Khi phân tích, đưa ra số liệu cụ thể
4. Gợi ý hành động cụ thể khi có thể
5. Nếu không có dữ liệu, nói rõ là "hiện tại chưa có dữ liệu"
6. Nếu có khối "DỮ LIỆU THAM KHẢO TỪ CỘT SÁCH VKsLab", cuối câu trả lời nhắc ngắn người dùng xem các mục đã liệt kê trong hệ thống`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const reply = await callGroq(messages, { temperature: 0.7, max_tokens: 480 });

  if (!reply) {
    return {
      reply: generateFallbackReply(userMessage, ctx, libraryBlock),
      suggestions,
    };
  }

  return { reply, suggestions };
}

/**
 * Fallback when Groq API is not configured
 */
function generateFallbackReply(userMessage, ctx, libraryBlock = '') {
  const lower = userMessage.toLowerCase();

  if (lower.includes('task') || lower.includes('công việc') || lower.includes('cong viec') || lower.includes('việc') || lower.includes('viec')) {
    if (ctx.pendingTasks.length === 0) return 'Hiện tại bạn không có task nào cần xử lý. Tốt lắm!';
    let reply = `Bạn có ${ctx.pendingTasks.length} task chưa hoàn thành.`;
    if (ctx.overdueTasks.length > 0) reply += ` Trong đó ${ctx.overdueTasks.length} task đã quá hạn.`;
    if (ctx.todayTasks.length > 0) reply += ` ${ctx.todayTasks.length} task cần hoàn thành hôm nay.`;
    return reply;
  }

  if (lower.includes('dự án') || lower.includes('du an') || lower.includes('project')) {
    if (ctx.projects.length === 0) return 'Bạn chưa tham gia dự án nào.';
    let reply = `Bạn đang tham gia ${ctx.projects.length} dự án.`;
    if (ctx.overdueProjects.length > 0) reply += ` ${ctx.overdueProjects.length} dự án đang trễ tiến độ.`;
    return reply;
  }

  if (lower.includes('báo cáo') || lower.includes('bao cao') || lower.includes('report')) {
    if (!ctx.reportStats) return 'Chưa có dữ liệu báo cáo.';
    return `Tỷ lệ nộp báo cáo trong 4 tuần gần đây: ${ctx.reportStats.rate}% (${ctx.reportStats.submitted}/${ctx.reportStats.expected}).`;
  }

  let base = `Hiện tại bạn có ${ctx.pendingTasks.length} task chưa xong, ${ctx.overdueTasks.length} task quá hạn, tham gia ${ctx.projects.length} dự án. Hãy hỏi cụ thể hơn để tôi hỗ trợ bạn!`;
  if (libraryBlock && libraryBlock.trim()) {
    base += `\n\nGợi ý từ kho sách VKsLab:${libraryBlock}`;
  }
  return base;
}

/**
 * Get ISO week number
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Persist notifications to DB
 */
async function saveNotifications(userId, notifications) {
  const { Notification } = require('../models');
  const records = notifications.map(n => ({
    user_id: userId,
    type: n.type,
    title: n.title,
    message: n.message,
    action_url: n.action_url || null,
  }));
  if (records.length > 0) {
    await Notification.bulkCreate(records);
  }
}

/**
 * Get user's stored notifications
 */
async function getNotifications(userId, { page = 1, limit = 20, unread_only = false } = {}) {
  const { Notification } = require('../models');
  const where = { user_id: userId };
  if (unread_only) where.is_read = false;

  const { count, rows } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    notifications: rows,
    unread_count: await Notification.count({ where: { user_id: userId, is_read: false } }),
    pagination: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}

/**
 * Mark notification(s) as read
 */
async function markAsRead(userId, notificationId) {
  const { Notification } = require('../models');
  if (notificationId === 'all') {
    await Notification.update({ is_read: true }, { where: { user_id: userId, is_read: false } });
  } else {
    await Notification.update(
      { is_read: true },
      { where: { id: notificationId, user_id: userId } },
    );
  }
}

module.exports = {
  getSmartNotifications,
  chat,
  saveNotifications,
  getNotifications,
  markAsRead,
};
