const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('./env');
const cloudinary = require('cloudinary').v2;

const { cloudName, apiKey, apiSecret } = env.cloudinary;
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

function isConfigured() {
  const c = env.cloudinary;
  return !!(c && c.cloudName && c.apiKey && c.apiSecret);
}

/**
 * Upload buffer lên Cloudinary (stream).
 * @param {Buffer} buffer
 * @param {{ folder?: string, resource_type?: 'image'|'raw'|'auto' }} [options]
 * @returns {Promise<{ secure_url: string, public_id: string, [k: string]: unknown }>}
 */
function uploadBuffer(buffer, options = {}) {
  if (!isConfigured()) {
    return Promise.reject(
      new Error('Cloudinary chưa cấu hình: thêm CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET vào .env'),
    );
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Promise.reject(new Error('File rỗng hoặc không hợp lệ'));
  }

  const { folder = 'vkslab/uploads', resource_type = 'auto', originalFilename, ...uploadOpts } = options;

  const opts = {
    folder,
    resource_type,
    ...uploadOpts,
  };

  if (resource_type === 'raw') {
    const ext = (originalFilename && path.extname(originalFilename)) || '.pdf';
    opts.public_id = `${uuidv4()}${ext}`;
    opts.use_filename = false;
    opts.unique_filename = false;
  } else {
    opts.use_filename = true;
    opts.unique_filename = true;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(opts, (err, result) => {
      if (err) {
        const msg =
          (typeof err.message === 'string' && err.message.trim()) ||
          (err.error && typeof err.error === 'object' && err.error.message) ||
          (typeof err.error === 'string' ? err.error : null) ||
          'Upload Cloudinary thất bại';
        const wrapped = new Error(msg);
        if (err.http_code != null) wrapped.http_code = err.http_code;
        if (err.statusCode != null) wrapped.statusCode = err.statusCode;
        reject(wrapped);
      } else resolve(result);
    });
    uploadStream.end(buffer);
  });
}

module.exports = {
  cloudinary,
  uploadBuffer,
  isConfigured,
};
