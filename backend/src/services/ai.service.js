const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY_CHAT });

/**
 * @param {{ system: string; user: string }} params
 */
const generateAI = async ({ system, user }) => {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || 'AI không trả về dữ liệu';
  } catch (err) {
    console.error('GROQ ERROR:', err.message);
    throw new Error('AI generation failed');
  }
};

module.exports = { generateAI };
