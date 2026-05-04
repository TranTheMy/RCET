const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../testbenches'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.v';
    cb(null, `tb_${uniqueSuffix}${ext}`);
  },
});

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.v', '.sv', '.vh', '.svh', '.txt'].includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file Verilog (.v, .sv, .vh, .svh, .txt)'));
  },
});
