const path = require('path');
const multer = require('multer');

/** Tài liệu lên RAM → Cloudinary raw */
const storage = multer.memoryStorage();

/** Đuôi file cho phép */
const ALLOWED_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.rtf',
  '.txt',
]);

/** MIME phổ biến (trình duyệt/OS có thể gửi khác nhau) */
const ALLOWED_MIME_PREFIX = [
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/rtf',
  'text/plain',
];
const ALLOWED_MIME_FULL = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

function isAllowedDocument(file) {
  const name = String(file.originalname || '');
  const ext = path.extname(name).toLowerCase();
  if (ext && ALLOWED_EXT.has(ext)) return true;

  const mt = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_MIME_FULL.has(mt)) return true;
  if (ALLOWED_MIME_PREFIX.some((p) => mt === p || mt.startsWith(`${p};`))) return true;

  /** Một số trình duyệt gửi application/octet-stream — chỉ tin khi đuôi nằm trong whitelist */
  if (mt === 'application/octet-stream' && ext && ALLOWED_EXT.has(ext)) return true;

  return false;
}

module.exports = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedDocument(file)) return cb(null, true);
    cb(
      new Error(
        'Chỉ chấp nhận tài liệu: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), ODT/ODS/ODP, RTF, TXT',
      ),
    );
  },
});
