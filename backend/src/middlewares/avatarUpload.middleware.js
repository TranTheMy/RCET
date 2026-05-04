const multer = require('multer');

/** Ảnh vào RAM → Cloudinary */
const storage = multer.memoryStorage();

module.exports = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF'));
  },
});
