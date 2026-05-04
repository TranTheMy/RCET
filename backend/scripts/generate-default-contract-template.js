/**
 * Tạo src/templates/scientist-contract-default.docx — placeholder dạng {{tên_biến}} (thay thế trong XML).
 * Mỗi placeholder nên nằm trong một TextRun; tránh tách chữ khi sửa tay trong Word.
 * Chạy: node scripts/generate-default-contract-template.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require('docx');

const outDir = path.join(__dirname, '../src/templates');
const outFile = path.join(outDir, 'scientist-contract-default.docx');

const sz = 22;

/** Ghép đoạn văn + placeholder — mỗi phần một TextRun */
function mix(parts, spacing = { after: 120 }) {
  return new Paragraph({
    spacing,
    children: parts.map((p) => new TextRun({ text: String(p), size: sz })),
  });
}

/** Một đoạn chỉ chứa text tĩnh */
function t(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: String(text), size: sz })],
  });
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: 'BẢN CAM KẾT CỘNG TÁC NGHIÊN CỨU KHOA HỌC',
          bold: true,
          size: 28,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text:
            '(Sửa nội dung tĩnh tùy ý; giữ nguyên các ô {{partyAName}}, {{contractDate}}, … xem src/templates/contract-placeholders.txt)',
          italics: true,
          size: 20,
        }),
      ],
    }),
    mix([
      'Hôm nay, ngày ',
      '{{contractDate}}',
      ', tại ',
      '{{contractLocation}}',
      ', chúng tôi gồm:',
    ]),
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: 'BÊN A (Đại diện Lab):', bold: true, size: 24 })],
    }),
    mix(['Họ tên: ', '{{partyAName}}']),
    mix(['Chức danh: ', '{{partyATitle}}']),
    mix(['Đơn vị công tác: ', '{{partyAWorkUnit}}']),
    mix(['Địa chỉ: ', '{{partyAAddress}}']),
    mix(['Email: ', '{{partyAEmail}}']),
    mix(['Điện thoại: ', '{{partyAPhone}}']),
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: 'BÊN B (Cộng tác viên / ứng viên):', bold: true, size: 24 })],
    }),
    mix(['Họ tên: ', '{{partyBName}}']),
    mix(['Mã SV / mã định danh: ', '{{partyBStudentId}}']),
    mix(['Khoa / đơn vị: ', '{{partyBFaculty}}']),
    mix(['Địa chỉ: ', '{{partyBAddress}}']),
    mix(['Email: ', '{{partyBEmail}}']),
    mix(['Điện thoại: ', '{{partyBPhone}}']),
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: 'Điều 1. Mục đích', bold: true, size: 24 })],
    }),
    t(
      'Hai bên thống nhất cộng tác trong các hoạt động nghiên cứu khoa học và phát triển công nghệ tại Lab, tuân thủ quy định của đơn vị và pháp luật hiện hành.',
    ),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: 'Điều 2. Nội dung cộng tác', bold: true, size: 24 })],
    }),
    mix(['{{contractSummary}}']),
    new Paragraph({
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: 'Điều 3. Cam kết chung', bold: true, size: 24 })],
    }),
    t(
      'Hai bên cam kết thực hiện trung thực các nội dung đã thỏa thuận, bảo mật thông tin theo quy định của Lab và pháp luật.',
    ),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: 'Điều 4. Hiệu lực', bold: true, size: 24 })],
    }),
    t(
      'Bản cam kết có hiệu lực kể từ ngày ký và được lưu trữ dưới dạng bản điện tử trên hệ thống VKsLab.',
    ),
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: 'ĐẠI DIỆN BÊN A', bold: true, size: 22 })],
    }),
    t('(Ký và ghi rõ họ tên)'),
    new Paragraph({ spacing: { before: 360 } }),
    new Paragraph({
      children: [new TextRun({ text: 'ĐẠI DIỆN BÊN B', bold: true, size: 22 })],
    }),
    t('(Ký và ghi rõ họ tên)'),
  ];

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outFile, buf);
  console.log('Written:', outFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
