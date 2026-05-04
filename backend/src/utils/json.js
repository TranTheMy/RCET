/**
 * Parse JSON an toàn từ output của AI model.
 *
 * AI hay trả về text lẫn JSON kiểu:
 *   "Here are the steps: [{"step":1,...}]"
 *   ```json\n[...]\n```
 *   { "steps": [...] }   ← object bọc ngoài
 *
 * Hàm này xử lý tất cả các trường hợp đó.
 */
function safeParse(content) {
    if (!content || typeof content !== "string") {
      throw new Error("safeParse: content must be a non-empty string");
    }
  
    const cleaned = content.trim();
  
    // 1. Thử parse thẳng trước (happy path)
    try {
      const parsed = JSON.parse(cleaned);
      return unwrapArray(parsed);
    } catch {
      // tiếp tục
    }
  
    // 2. Strip markdown code fences: ```json ... ``` hoặc ``` ... ```
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        return unwrapArray(parsed);
      } catch {
        // tiếp tục
      }
    }
  
    // 3. Tìm JSON array [...] đầu tiên trong chuỗi
    //    Dùng cách đếm bracket thay vì regex greedy để tránh bắt sai
    const arrayResult = extractFirstArray(cleaned);
    if (arrayResult !== null) {
      try {
        const parsed = JSON.parse(arrayResult);
        return unwrapArray(parsed);
      } catch {
        // tiếp tục
      }
    }
  
    // 4. Tìm JSON object {...} đầu tiên rồi unwrap
    const objectResult = extractFirstObject(cleaned);
    if (objectResult !== null) {
      try {
        const parsed = JSON.parse(objectResult);
        return unwrapArray(parsed);
      } catch {
        // tiếp tục
      }
    }
  
    throw new Error(`safeParse: could not extract valid JSON from:\n${cleaned.slice(0, 200)}`);
  }
  
  /**
   * Nếu AI trả về object bọc ngoài kiểu { steps: [...] } hoặc { data: [...] }
   * thì tự động lấy value đầu tiên là array.
   */
  function unwrapArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
  
    if (parsed && typeof parsed === "object") {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val)) return val;
      }
    }
  
    // Trả nguyên nếu không tìm thấy array (caller tự validate)
    return parsed;
  }
  
  /**
   * Tìm chuỗi JSON array đầu tiên bằng cách đếm bracket.
   * Chính xác hơn regex greedy khi có nested array.
   */
  function extractFirstArray(str) {
    const start = str.indexOf("[");
    if (start === -1) return null;
    return extractBalanced(str, start, "[", "]");
  }
  
  function extractFirstObject(str) {
    const start = str.indexOf("{");
    if (start === -1) return null;
    return extractBalanced(str, start, "{", "}");
  }
  
  function extractBalanced(str, start, open, close) {
    let depth = 0;
    let inString = false;
    let escape = false;
  
    for (let i = start; i < str.length; i++) {
      const ch = str[i];
  
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
  
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return str.slice(start, i + 1);
      }
    }
  
    return null; // không tìm thấy cặp đóng mở hợp lệ
  }

  module.exports = { safeParse };