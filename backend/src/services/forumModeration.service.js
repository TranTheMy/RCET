const env = require('../config/env');
const logger = require('../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const MAX_INPUT_CHARS = 12000;

/**
 * Khi không có GROQ_API_KEY: nếu FORUM_MODERATION_DISABLED=true thì bỏ qua kiểm duyệt (chỉ nên dùng trên dev).
 */
function moderationDisabledEnv() {
  return String(process.env.FORUM_MODERATION_DISABLED || '').toLowerCase() === 'true';
}

function clip(s, max = MAX_INPUT_CHARS) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

const MODERATOR_SYSTEM = `Bạn là bộ lọc nội dung cho diễn đàn kỹ thuật/giáo dục VKsLab. Chỉ trả về MỘT khối JSON hợp lệ, không markdown, không giải thích thêm.

Định dạng cho phép:
{"allowed":true}
hoặc
{"allowed":false,"categories":["mã_loại"],"reason":"Một câu tiếng Việt ngắn, lịch sự, không trích dẫn nguyên văn nội dung nhạy cảm"}

Mã loại (categories) dùng tiếng Anh snake_case, có thể nhiều mã:
- sexual_content (18+, khiêu dâm, gợi dục)
- violence_hate (kích động bạo lực, thù hằn, cực đoan)
- sensitive_politics (chính trị nhạy cảm, chống phá, lật đổ)
- scam_spam (lừa đảo, đa cấp, spam bán hàng, quảng cáo lố)
- illegal_hacking (hack, crack, hướng dẫn vi phạm pháp luật rõ ràng)
- doxxing (lộ thông tin cá nhân người khác: SĐT, CCCD, địa chỉ nhà, mật khẩu…)
- other (vi phạm khác không khớp trên)

QUY TẮC:
- Thảo luận kỹ thuật, an ninh mạng mang tính học thuật/hợp pháp được phép (allowed:true).
- Nghi ngờ nhẹ → ưu tiên allowed:true để tránh chặn nhầm.
- Chỉ allowed:false khi vi phạm rõ ràng theo các nhóm trên.`;

function parseModerationJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGroqModeration(userPayload) {
  const apiKey = (env.groq?.apiKey || '').trim();
  if (!apiKey) {
    if (moderationDisabledEnv()) {
      logger.warn('[forumModeration] Skipped: no GROQ_API_KEY and FORUM_MODERATION_DISABLED=true');
      return { skipped: true, raw: null };
    }
    throw Object.assign(
      new Error(
        'Hệ thống kiểm duyệt nội dung chưa được cấu hình (GROQ_API_KEY). Vui lòng liên hệ quản trị viên.',
      ),
      { status: 503 },
    );
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: MODERATOR_SYSTEM },
        { role: 'user', content: userPayload },
      ],
      temperature: 0.05,
      max_tokens: 220,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    logger.error(`[forumModeration] Groq HTTP ${res.status}: ${errBody.slice(0, 500)}`);
    if (res.status === 401) {
      throw Object.assign(new Error('Khóa API kiểm duyệt không hợp lệ.'), { status: 503 });
    }
    throw Object.assign(new Error('Dịch vụ kiểm duyệt tạm thời không khả dụng. Vui lòng thử lại sau.'), {
      status: 503,
    });
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  return { skipped: false, raw };
}

/**
 * @param {string} title
 * @param {string} content
 */
async function moderatePost(title, content) {
  const titleC = clip(title || '', 2000);
  const bodyC = clip(content || '', MAX_INPUT_CHARS);
  const userPayload = `TIÊU ĐỀ:\n${titleC}\n\nNỘI DUNG BÀI:\n${bodyC}`;

  const { skipped, raw } = await callGroqModeration(userPayload);
  if (skipped) return { allowed: true, skipped: true };

  const parsed = parseModerationJson(raw);
  if (!parsed || typeof parsed.allowed !== 'boolean') {
    logger.warn('[forumModeration] Invalid JSON from model:', String(raw).slice(0, 300));
    throw Object.assign(new Error('Không thể hoàn tất kiểm duyệt. Vui lòng thử lại sau.'), { status: 503 });
  }

  return {
    allowed: parsed.allowed === true,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '',
  };
}

/**
 * @param {string} title
 * @param {string} content
 */
async function assertAllowedPost(title, content) {
  const r = await moderatePost(title, content);
  if (r.skipped || r.allowed) return;
  const msg =
    r.reason ||
    'Nội dung không phù hợp quy định diễn đàn (nội dung nhạy cảm, bạo lực, lừa đảo, vi phạm pháp luật hoặc lộ thông tin cá nhân). Vui lòng chỉnh sửa.';
  throw Object.assign(new Error(msg), { status: 422, moderation: r });
}

/**
 * @param {string} content
 */
async function assertAllowedComment(content) {
  return assertAllowedPost('', content || '');
}

module.exports = {
  assertAllowedPost,
  assertAllowedComment,
  moderatePost,
};
