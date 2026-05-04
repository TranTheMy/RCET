const { buildGuestChatUserContent } = require('../utils/prompt');
const { systemPrompt } = require('../utils/systemPrompt');
const { generateAI } = require('../services/ai.service');

/** Tách JSON nếu model bọc trong ```json ... ``` */
function extractJsonPayload(raw) {
  const t = String(raw || '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const history = req.body.history ?? req.body.conversation_history ?? [];

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const userContent = buildGuestChatUserContent(message, Array.isArray(history) ? history : []);
    const aiRaw = await generateAI({ system: systemPrompt, user: userContent });

    let parsed;
    try {
      parsed = JSON.parse(extractJsonPayload(aiRaw));
    } catch {
      return res.json({
        message: aiRaw,
        isQualified: false,
      });
    }

    res.json({
      message: parsed.reply,
      suggestion: parsed.suggestion,
      isQualified: parsed.stage === 'qualified',
      description: parsed.description || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { chat };
