/**
 * Custom testbench multi-subtest convention:
 *
 * 1) In the testbench (.v), declare subtests in a comment block (JSON array):
 *    /\* VKSLAB_SUBTESTS_JSON
 *    [
 *      { "id": "t1", "name": "AND", "grade": 5 },
 *      { "id": "t2", "name": "OR",  "grade": 5 }
 *    ]
 *    \*\/
 *
 * 2) During simulation, print one line per subtest (order-free):
 *    $display("VKSLAB_SUBTEST id=t1 status=PASS");
 *    $display("VKSLAB_SUBTEST id=t2 status=FAIL");
 *    status is PASS | FAIL | SKIP (case-insensitive)
 */

const META_BLOCK_RE = /\/\*\s*VKSLAB_SUBTESTS_JSON\s*([\s\S]*?)\*\//i;
const RESULT_LINE_RE = /VKSLAB_SUBTEST\s+id=([^\s]+)\s+status=(PASS|FAIL|SKIP)\b/gi;

/**
 * @returns {{ ok: boolean, error: string|null, subtests: Array<{ id: string, name: string, grade: number, order_index: number }> }}
 */
function parseSubtestsFromTestbench(tbText) {
  if (!tbText || typeof tbText !== 'string') {
    return { ok: false, error: 'Empty testbench', subtests: [] };
  }
  const m = tbText.match(META_BLOCK_RE);
  if (!m) {
    return {
      ok: false,
      error:
        'Không tìm thấy block /* VKSLAB_SUBTESTS_JSON ... */ trong testbench. Thêm block JSON mô tả các subtest.',
      subtests: [],
    };
  }
  let json;
  try {
    json = JSON.parse(m[1].trim());
  } catch (e) {
    return { ok: false, error: `JSON trong VKSLAB_SUBTESTS_JSON không hợp lệ: ${e.message}`, subtests: [] };
  }
  if (!Array.isArray(json)) {
    return { ok: false, error: 'VKSLAB_SUBTESTS_JSON phải là mảng JSON', subtests: [] };
  }
  const subtests = [];
  for (let i = 0; i < json.length; i++) {
    const row = json[i] || {};
    const id = String(row.id ?? row.key ?? '').trim();
    if (!id) continue;
    const g = Number(row.grade);
    subtests.push({
      id,
      name: String(row.name ?? row.label ?? id).slice(0, 255),
      grade: Number.isFinite(g) && g >= 0 ? Math.floor(g) : 10,
      order_index: Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : i,
    });
  }
  if (subtests.length === 0) {
    return { ok: false, error: 'Mảng subtest rỗng hoặc thiếu trường id', subtests: [] };
  }
  return { ok: true, error: null, subtests };
}

/** @returns {Record<string, 'PASS'|'FAIL'|'SKIP'>} */
function parseSubtestResultsFromSimOutput(output) {
  const map = {};
  if (!output) return map;
  let m;
  RESULT_LINE_RE.lastIndex = 0;
  while ((m = RESULT_LINE_RE.exec(output)) !== null) {
    const id = m[1].trim();
    const st = m[2].toUpperCase();
    if (st === 'PASS' || st === 'FAIL' || st === 'SKIP') map[id] = st;
  }
  return map;
}

module.exports = {
  parseSubtestsFromTestbench,
  parseSubtestResultsFromSimOutput,
  META_BLOCK_RE,
};
