const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require('docx');
const logger = require('../utils/logger');
const env = require('../config/env');

/** Dòng ngày mặc định trong mẫu Bản-cam-kết-NCKH-mẫu.docx (một khối &lt;w:t&gt;) */
const VIET_TEMPLATE_DATE_LINE =
  'Hôm nay, ngày …… tháng …… năm ……, tại ……………………………';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Địa điểm ghi sau "tại …" — ưu tiên ô nhập, sau đó địa chỉ/đơn vị Bên A, cuối cùng biến môi trường.
 */
function resolveContractLocationForTemplate(p) {
  const candidates = [p.contractLocation, p.partyAAddress, p.partyAWorkUnit, env.contractDefaultLocation];
  for (const v of candidates) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/**
 * Tìm thẻ mở &lt;w:r&gt; (không nhầm &lt;w:rFonts&gt;…) ngay trước vị trí.
 */
function lastWROpen(xml, beforePos) {
  const slice = xml.slice(0, beforePos);
  let best = -1;
  let idx = 0;
  while ((idx = slice.indexOf('<w:r', idx)) !== -1) {
    const c = slice[idx + 4];
    if (c === ' ' || c === '>') best = idx;
    idx += 1;
  }
  return best;
}

/**
 * Mẫu Bản-cam-kết-NCKH-mẫu: ô trống là tab chấm (&lt;w:tab/&gt;), không có {{}} — thay 8 tab theo thứ tự + dòng ngày.
 */
function fillVietnameseTabLeaderDocumentXml(xml, data) {
  let out = xml;
  if (out.includes(VIET_TEMPLATE_DATE_LINE)) {
    out = out.split(VIET_TEMPLATE_DATE_LINE).join(buildVietnameseDateLineText(data.contractDate, data.contractLocation));
  }

  const tabValues = [
    data.partyAName,
    data.partyATitle,
    data.partyAWorkUnit,
    data.partyAEmail,
    data.partyBName,
    data.partyBStudentId,
    data.partyBFaculty,
    data.partyBEmail,
  ];

  let vi = 0;
  let searchPos = 0;
  while (vi < tabValues.length) {
    const tabPos = out.indexOf('<w:tab/>', searchPos);
    if (tabPos === -1) break;
    const rStart = lastWROpen(out, tabPos);
    if (rStart === -1) {
      searchPos = tabPos + 1;
      continue;
    }
    const rEnd = out.indexOf('</w:r>', tabPos);
    if (rEnd === -1) break;
    const runXml = out.slice(rStart, rEnd + '</w:r>'.length);
    if (!runXml.includes('<w:tab/>')) {
      searchPos = tabPos + 1;
      continue;
    }
    const openMatch = runXml.match(/^<w:r\b[^>]*>/);
    if (!openMatch) {
      searchPos = tabPos + 1;
      continue;
    }
    const openTag = openMatch[0];
    const rPrMatch = runXml.match(/^<w:r\b[^>]*>(<w:rPr>[\s\S]*?<\/w:rPr>)/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    const val = escapeXml(tabValues[vi] ?? '');
    const newRun = `${openTag}${rPr}<w:t xml:space="preserve">${val}</w:t></w:r>`;
    out = out.slice(0, rStart) + newRun + out.slice(rEnd + '</w:r>'.length);
    vi += 1;
    searchPos = rStart + newRun.length;
  }

  if (vi < tabValues.length) {
    logger.warn(`Mẫu cam kết (tab): mới thay được ${vi}/${tabValues.length} ô`);
  }
  return out;
}

function buildVietnameseDateLineText(contractDate, contractLocation) {
  const rawLoc =
    contractLocation != null && String(contractLocation).trim() !== ''
      ? String(contractLocation).trim()
      : null;
  const loc = rawLoc != null ? escapeXml(rawLoc) : '……………………………';
  if (contractDate && /^\d{4}-\d{2}-\d{2}$/.test(String(contractDate))) {
    const [y, m, d] = String(contractDate).split('-');
    const day = String(parseInt(d, 10));
    const month = String(parseInt(m, 10));
    return `Hôm nay, ngày ${day} tháng ${month} năm ${y}, tại ${loc}`;
  }
  return `Hôm nay, ngày …… tháng …… năm ……, tại ${loc}`;
}

/** Thay chuỗi {{key}} liên tục trong XML (fallback khi không dùng docxtemplater). */
function fillDocxPlaceholdersSimple(inputBuffer, data) {
  const zip = new PizZip(inputBuffer);
  const keys = Object.keys(data).sort((a, b) => b.length - a.length);

  Object.keys(zip.files).forEach((name) => {
    const f = zip.files[name];
    if (!f || f.dir) return;
    if (!name.startsWith('word/') || !name.endsWith('.xml')) return;
    if (name.includes('_rels')) return;

    let xml = zip.file(name).asText();
    let touched = false;
    for (const k of keys) {
      const needle = `{{${k}}}`;
      if (!xml.includes(needle)) continue;
      const val = escapeXml(data[k] == null ? '' : data[k]);
      xml = xml.split(needle).join(val);
      touched = true;
    }
    if (touched) zip.file(name, xml);
  });

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Điền mẫu Word: (1) mẫu Việt tab chấm, (2) docxtemplater cho {{key}} (Word hay tách run),
 * (3) thay {{key}} chuỗi liên tục trên toàn bộ word/*.xml.
 * @param {Buffer} inputBuffer
 * @param {Record<string, string | number | undefined | null>} data — key không gồm ngoặc
 * @returns {Buffer}
 */
function fillDocxPlaceholders(inputBuffer, data) {
  const zip = new PizZip(inputBuffer);
  const docPath = 'word/document.xml';
  if (zip.files[docPath]) {
    let xml = zip.file(docPath).asText();
    const tabs = (xml.match(/<w:tab\/>/g) || []).length;
    if (xml.includes('Hôm nay, ngày ……') && tabs >= 8) {
      xml = fillVietnameseTabLeaderDocumentXml(xml, data);
      zip.file(docPath, xml);
    }
  }

  let buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  try {
    const z2 = new PizZip(buf);
    const doc = new Docxtemplater(z2, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '',
    });
    doc.render(data);
    buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  } catch (e) {
    logger.warn(`docxtemplater: ${e.message}`);
  }

  return fillDocxPlaceholdersSimple(buf, data);
}

/** Thứ tự: CONTRACT_TEMPLATE_PATH → Bản-cam-kết-NCKH-mẫu.docx → scientist-contract-default.docx */
function getContractTemplateCandidates() {
  const dir = path.join(__dirname, '../templates');
  const list = [];
  const custom = env.contractTemplatePath || process.env.CONTRACT_TEMPLATE_PATH;
  if (custom && String(custom).trim()) {
    list.push(path.isAbsolute(custom) ? custom : path.join(process.cwd(), custom));
  }
  list.push(path.join(dir, 'Bản-cam-kết-NCKH-mẫu.docx'));
  list.push(path.join(dir, 'scientist-contract-default.docx'));
  return list;
}

/** @deprecated Dùng getContractTemplateCandidates — giữ tương thích: file ưu tiên đầu tiên tồn tại */
function resolveTemplatePath() {
  for (const p of getContractTemplateCandidates()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '../templates/Bản-cam-kết-NCKH-mẫu.docx');
}

/** Map payload API → key thay thế trong mẫu Word */
function payloadToTemplateData(p) {
  const contractDate = p.contractDate || new Date().toISOString().slice(0, 10);
  const contractLocation = resolveContractLocationForTemplate(p);
  return {
    partyAName: p.partyAName || '',
    partyAEmail: p.partyAEmail || '',
    partyAPhone: p.partyAPhone || '',
    partyAAddress: p.partyAAddress || '',
    partyATitle: p.partyATitle || '',
    partyAWorkUnit: p.partyAWorkUnit || '',
    partyBName: p.partyBName || '',
    partyBEmail: p.partyBEmail || '',
    partyBPhone: p.partyBPhone || '',
    partyBAddress: p.partyBAddress || '',
    partyBStudentId: p.partyBStudentId || '',
    partyBFaculty: p.partyBFaculty || '',
    contractDate,
    contractLocation,
    contractSummary: p.contractSummary || '',
  };
}

/**
 * Thử lần lượt các file .docx mẫu, điền {{biến}} (payloadToTemplateData).
 * Không có file hợp lệ → tạo docx bằng code.
 */
async function buildContractDocxBuffer(p) {
  const data = payloadToTemplateData(p);
  for (const tplPath of getContractTemplateCandidates()) {
    if (!fs.existsSync(tplPath)) continue;
    try {
      const input = fs.readFileSync(tplPath);
      return fillDocxPlaceholders(input, data);
    } catch (e) {
      logger.warn(`Mẫu Word (${tplPath}) lỗi khi điền: ${e.message}`);
    }
  }
  logger.warn('Không có file mẫu .docx nào đọc được — dùng bản tạo trong code.');
  return buildScientistCommitmentDocx(p);
}

/**
 * Tạo buffer .docx — bản cam kết mặc định (không dùng file mẫu).
 * @param {Record<string, string | undefined>} p
 * @returns {Promise<Buffer>}
 */
async function buildScientistCommitmentDocx(p) {
  const line = (text, opts = {}) =>
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: String(text || ''), size: 22, ...opts })],
    });

  const boldLine = (text) =>
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: String(text || ''), bold: true, size: 24 })],
    });

  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    heading: HeadingLevel.HEADING_1,
    children: [
      new TextRun({
        text: 'BẢN CAM KẾT CỘNG TÁC NGHIÊN CỨU KHOA HỌC',
        bold: true,
        size: 28,
      }),
    ],
  });

  const dateStr = p.contractDate || new Date().toISOString().slice(0, 10);
  const resolvedLoc = resolveContractLocationForTemplate(p);
  const location = resolvedLoc || '……………';

  const children = [
    title,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: '(Ban hành kèm Quy chế hoạt động Lab — phiên bản điện tử)',
          italics: true,
          size: 20,
        }),
      ],
    }),
    line(`Hôm nay, ngày ${dateStr}, tại ${location}, chúng tôi gồm:`),
    boldLine('BÊN A (Đại diện Lab / đơn vị chủ trì):'),
    line(`Họ tên: ${p.partyAName || ''}`),
    line(`Chức danh: ${p.partyATitle || '—'}`),
    line(`Đơn vị công tác: ${p.partyAWorkUnit || ''}`),
    line(`Địa chỉ: ${p.partyAAddress || '—'}`),
    line(`Email: ${p.partyAEmail || ''}`),
    line(`Điện thoại: ${p.partyAPhone || '—'}`),
    boldLine('BÊN B (Cộng tác viên / ứng viên):'),
    line(`Họ tên: ${p.partyBName || ''}`),
    line(`Mã SV / mã định danh: ${p.partyBStudentId || '—'}`),
    line(`Khoa / đơn vị: ${p.partyBFaculty || '—'}`),
    line(`Địa chỉ: ${p.partyBAddress || '—'}`),
    line(`Email: ${p.partyBEmail || ''}`),
    line(`Điện thoại: ${p.partyBPhone || '—'}`),
    boldLine('Điều 1. Mục đích'),
    line(
      'Hai bên thống nhất cộng tác trong các hoạt động nghiên cứu khoa học và phát triển công nghệ tại Lab, tuân thủ quy định của đơn vị và pháp luật hiện hành.',
    ),
    boldLine('Điều 2. Nội dung cộng tác'),
    line(p.contractSummary || '—'),
    boldLine('Điều 3. Cam kết chung'),
    line(
      'Hai bên cam kết thực hiện trung thực các nội dung đã thỏa thuận, bảo mật thông tin theo quy định của Lab và pháp luật.',
    ),
    boldLine('Điều 4. Hiệu lực'),
    line(
      'Bản cam kết có hiệu lực kể từ ngày ký và được lưu trữ dưới dạng bản điện tử trên hệ thống VKsLab.',
    ),
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'ĐẠI DIỆN BÊN A',
          bold: true,
          size: 22,
        }),
      ],
    }),
    line('(Ký và ghi rõ họ tên)'),
    new Paragraph({ spacing: { before: 360 } }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'ĐẠI DIỆN BÊN B',
          bold: true,
          size: 22,
        }),
      ],
    }),
    line('(Ký và ghi rõ họ tên)'),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = {
  buildScientistCommitmentDocx,
  buildContractDocxBuffer,
  fillDocxPlaceholders,
  fillDocxPlaceholdersSimple,
  payloadToTemplateData,
  resolveContractLocationForTemplate,
  getContractTemplateCandidates,
  resolveTemplatePath,
};
