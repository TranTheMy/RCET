/**
 * Giải thích thuật ngữ (POST /api/tutorial/explain) — Groq OpenAI-compatible API.
 * Dùng GROQ_API_KEY (xem config/env.js).
 */
const axios = require("axios");
const env = require("../config/env");
const { safeParse } = require("../utils/json");

const GROQ_BASE = "https://api.groq.com/openai/v1";

const client = axios.create({
  baseURL: GROQ_BASE,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  const key = (env.groq?.apiKey || process.env.GROQ_API_KEY || "").trim();
  if (key) {
    config.headers.Authorization = `Bearer ${key}`;
  }
  return config;
});

/** Thử lần lượt các model Groq khi một model lỗi tạm thời. */
const EXPLAIN_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "gemma2-9b-it",
];

function salvageExplanationFromRaw(raw, fallbackTerm) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const termMatch = text.match(/"term"\s*:\s*"([^"]*)"/i);
  const explanationKeyMatch = text.match(/"explanation"\s*:\s*/i);
  if (!explanationKeyMatch) return null;

  let explanation = text.slice(explanationKeyMatch.index + explanationKeyMatch[0].length).trim();

  if (explanation.startsWith('"')) {
    explanation = explanation.slice(1);
    const closingQuoteIdx = explanation.indexOf('"');
    if (closingQuoteIdx >= 0) {
      explanation = explanation.slice(0, closingQuoteIdx);
    }
  }

  explanation = explanation.replace(/[}\],\s]+$/g, "").trim();
  if (!explanation) return null;

  return {
    term: termMatch?.[1] || fallbackTerm,
    explanation,
  };
}

function extractMessageContent(data) {
  const message = data?.choices?.[0]?.message;
  const rawContent = message?.content;

  if (typeof rawContent === "string" && rawContent.trim()) {
    return rawContent.trim();
  }

  if (Array.isArray(rawContent)) {
    const text = rawContent
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        if (part && typeof part.content === "string") return part.content;
        return "";
      })
      .join("")
      .trim();
    if (text) return text;
  }

  return "";
}

async function callModel(model, prompt) {
  const controller = new AbortController();
  const hardTimeoutMs = 18000;
  const timer = setTimeout(() => controller.abort(), hardTimeoutMs);

  try {
    const res = await client.post(
      "/chat/completions",
      {
        model,
        messages: [
          {
            role: "system",
            content: "You must return ONLY valid JSON. No explanation outside JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 260,
      },
      { signal: controller.signal }
    );

    const content = extractMessageContent(res.data);
    if (!content) {
      const finishReason = res.data?.choices?.[0]?.finish_reason || "unknown";
      throw new Error(`Empty response from model (finish_reason=${finishReason})`);
    }
    return content;
  } catch (err) {
    if (err?.code === "ERR_CANCELED") {
      throw new Error(`Model timeout after ${hardTimeoutMs}ms`);
    }
    if (err.response?.status === 401) {
      const authErr = new Error("Groq API key invalid");
      authErr.authFail = true;
      throw authErr;
    }
    if (err.response && [403, 404].includes(err.response.status)) {
      const skipErr = new Error(`Skip model ${model}`);
      skipErr.skip = true;
      throw skipErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callModelWithRetries(model, prompt, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await callModel(model, prompt);
    } catch (err) {
      lastErr = err;
      if (err?.authFail) throw err;
      if (err?.skip) throw err;
      if (i < maxAttempts - 1) {
        const status = err?.response?.status;
        const waitMs = status === 429 ? Math.min(2500 * 2 ** i, 20000) : 1000;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr || new Error("callModelWithRetries: unknown failure");
}

async function explainTerm(selectedText) {
  const apiKey = (env.groq?.apiKey || process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error(
      "Chưa cấu hình GROQ_API_KEY trên server. Thêm khóa vào file .env của backend và khởi động lại."
    );
    err.statusCode = 503;
    throw err;
  }

  const termJson = JSON.stringify(String(selectedText));
  const prompt = `Giải thích ngắn gọn (<= 30 từ) bằng tiếng Việt cho thuật ngữ/cụm sau (đã bọc JSON an toàn):
${termJson}

Trả về DUY NHẤT một dòng JSON hợp lệ, đúng cấu trúc:
{"term":${termJson},"explanation":"..."}
Trong đó "explanation" là chuỗi tiếng Việt ngắn. Không markdown, không text ngoài JSON.`;

  console.log(`\n📋 Tutorial explain — trying ${EXPLAIN_MODELS.length} Groq model(s)...`);

  for (const model of EXPLAIN_MODELS) {
    try {
      console.log("\n👉 Trying model:", model);

      const result = await callModelWithRetries(model, prompt, 3);

      let parsed = null;
      try {
        parsed = safeParse(result);
      } catch (parseErr) {
        const salvaged = salvageExplanationFromRaw(result, selectedText);
        if (salvaged?.explanation) {
          console.warn(`⚠️ Salvaged truncated JSON from model: ${model}`);
          return salvaged;
        }
        const preview = String(result).slice(0, 160).replace(/\s+/g, " ");
        throw new Error(
          `Invalid JSON output from ${model}: ${parseErr.message}. Raw preview: ${preview}`
        );
      }

      const explanation =
        parsed?.explanation != null ? String(parsed.explanation).trim() : "";
      if (parsed && explanation) {
        console.log("✅ SUCCESS MODEL:", model);
        return { term: parsed.term != null ? String(parsed.term) : selectedText, explanation };
      }
    } catch (err) {
      if (err?.authFail || err?.response?.status === 401) {
        const e = new Error(
          "GROQ_API_KEY không hợp lệ hoặc hết hạn. Kiểm tra khóa trong .env của backend."
        );
        e.statusCode = 503;
        throw e;
      }
      const extra =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        "";
      console.warn(
        `❌ Model failed: ${model} — ${err?.message || String(err)}${extra ? ` | ${extra}` : ""}`
      );
    }
  }

  const err = new Error(
    "Không thể giải thích: mọi model Groq đều thất bại (quota, timeout hoặc lỗi API). Thử lại sau hoặc kiểm tra GROQ_API_KEY."
  );
  err.statusCode = 502;
  throw err;
}

module.exports = { explainTerm };
