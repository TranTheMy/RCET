const documentService = require('../services/document.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const listPublic = async (req, res, next) => {
  try {
    const result = await documentService.listPublic(req.query, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.listPublic:', error);
    return next(error);
  }
};

const listMine = async (req, res, next) => {
  try {
    const result = await documentService.listMine(req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.listMine:', error);
    return next(error);
  }
};

const listPending = async (req, res, next) => {
  try {
    const result = await documentService.listPending(req.query, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.listPending:', error);
    return next(error);
  }
};

const history = async (req, res, next) => {
  try {
    const result = await documentService.history(req.query.version_group_id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.history:', error);
    return next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const result = await documentService.getById(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.getOne:', error);
    return next(error);
  }
};

const getDownloadUrl = async (req, res, next) => {
  try {
    const result = await documentService.getDownloadPayload(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.getDownloadUrl:', error);
    return next(error);
  }
};

const preview = async (req, res, next) => {
  try {
    const url = await documentService.getPreviewRedirectUrl(req.params.id, req.user);
    return res.redirect(302, url);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.preview:', error);
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await documentService.create(req.body || {}, req.file, req.user);
    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('document.create:', error);
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await documentService.update(req.params.id, req.body || {}, req.file, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('document.update:', error);
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await documentService.remove(req.params.id, req.user, req.body || {});
    return ApiResponse.success(res, null, 'Đã xóa');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.remove:', error);
    return next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const result = await documentService.restore(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.restore:', error);
    return next(error);
  }
};

const submit = async (req, res, next) => {
  try {
    const result = await documentService.submit(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.submit:', error);
    return next(error);
  }
};

const approve = async (req, res, next) => {
  try {
    const result = await documentService.approve(req.params.id, req.body || {}, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.approve:', error);
    return next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const result = await documentService.reject(req.params.id, req.body || {}, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.reject:', error);
    return next(error);
  }
};

const createVersion = async (req, res, next) => {
  try {
    const result = await documentService.createVersion(req.params.id, req.body || {}, req.file, req.user);
    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('document.createVersion:', error);
    return next(error);
  }
};

module.exports = {
  listPublic,
  listMine,
  listPending,
  history,
  getOne,
  getDownloadUrl,
  preview,
  create,
  update,
  remove,
  restore,
  submit,
  approve,
  reject,
  createVersion,
};
