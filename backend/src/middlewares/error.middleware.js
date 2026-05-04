const logger = require('../utils/logger');
const ApiResponse = require('../utils/response');
const env = require('../config/env');

function resolveErrorMessage(err) {
  if (!err) return 'Internal server error';
  if (typeof err === 'string') return err;
  if (err.name === 'SequelizeDatabaseError' && err.parent) {
    const p = err.parent;
    const base = (p.message && String(p.message).trim()) || '';
    const code =
      p.number != null
        ? ` (SQL ${p.number}${p.state != null ? `, state ${p.state}` : ''})`
        : '';
    const out = `${base}${code}`.trim();
    if (out) return out;
  }
  const m = err.message;
  if (typeof m === 'string' && m.trim() && m.trim() !== 'Internal server error') return m.trim();
  if (err.error) {
    if (typeof err.error === 'string') return err.error;
    if (err.error.message) return String(err.error.message);
  }
  if (err.parent && err.parent.message) return String(err.parent.message);
  return 'Internal server error';
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error(err?.stack || err?.message || err);

  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return ApiResponse.badRequest(res, 'Validation error', errors);
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return ApiResponse.conflict(res, 'Duplicate entry', errors);
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.badRequest(res, 'File đính kèm không được vượt quá dung lượng cho phép');
    }
    return ApiResponse.badRequest(res, err.message || 'Upload failed');
  }

  if (
    err.message &&
    (err.message.includes('Chỉ chấp nhận ảnh') || err.message.includes('Chỉ chấp nhận tài liệu'))
  ) {
    return ApiResponse.badRequest(res, err.message);
  }

  const statusCode = err.http_code || err.status || err.statusCode || 500;
  let message = resolveErrorMessage(err);
  if (message === 'Internal server error' && env.nodeEnv === 'development' && err?.name) {
    message = `${err.name}: ${message}`;
  }

  const code = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const body = { success: false, message };
  if (env.nodeEnv === 'development' && err?.stack) {
    body.stack = err.stack.split('\n').slice(0, 8).join('\n');
  }
  if (env.nodeEnv === 'development' && err?.name === 'SequelizeDatabaseError' && err.sql) {
    body.sql = String(err.sql).slice(0, 2000);
  }
  return res.status(code).json(body);
};

module.exports = errorHandler;
