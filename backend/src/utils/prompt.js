/**
 * Nội dung user cho chat guest: chỉ lịch sử + câu hỏi.
 * Không inject RAG / knowledge base — mọi kiến thức nằm trong systemPrompt.js.
 */
function buildGuestChatUserContent(message, history = []) {
  const historyText = history
    .map((h) => `${h.role === 'user' ? 'Khách' : 'AI'}: ${h.content}`)
    .join('\n');

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 LỊCH SỬ HỘI THOẠI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${historyText || 'Chưa có lịch sử.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÂU HỎI HIỆN TẠI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Khách: ${message}

Trả lời đúng một JSON theo schema trong system prompt (không markdown).`;
}

module.exports = { buildGuestChatUserContent };
