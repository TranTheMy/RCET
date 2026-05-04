const researchService = require('../services/research.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const { RESEARCH_STATUS } = require('../config/constants');

const submit = async (req, res, next) => {
  try {
    const item = await researchService.submit(req.body || {}, req.file, req.user);
    const message =
      item.status === RESEARCH_STATUS.APPROVED
        ? 'Đã đăng bài thành công'
        : 'Đã gửi bài chờ duyệt';
    return ApiResponse.created(res, item, message);
  } catch (error) {
    if (error.status) {
      return ApiResponse.error(res, error.message, error.status, error.errors || null);
    }
    logger.error('research submit:', error);
    return next(error);
  }
};

const listPending = async (req, res, next) => {
  try {
    const result = await researchService.listPending();
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research listPending:', error);
    return next(error);
  }
};

const approve = async (req, res, next) => {
  try {
    const item = await researchService.approve(req.params.id, req.body || {}, req.user.id);
    return ApiResponse.success(res, item, 'Đã duyệt bài');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research approve:', error);
    return next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const item = await researchService.reject(req.params.id, req.body || {}, req.user.id);
    return ApiResponse.success(res, item, 'Đã từ chối bài');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research reject:', error);
    return next(error);
  }
};

const listPublic = async (req, res, next) => {
  try {
    const result = await researchService.listPublic(req.query);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research listPublic:', error);
    return next(error);
  }
};

const publicTagFacets = async (req, res, next) => {
  try {
    const result = await researchService.publicTagFacets();
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research publicTagFacets:', error);
    return next(error);
  }
};

const internalTagFacets = async (req, res, next) => {
  try {
    const result = await researchService.internalTagFacets();
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research internalTagFacets:', error);
    return next(error);
  }
};

const listInternal = async (req, res, next) => {
  try {
    const result = await researchService.listInternal(req.query);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research listInternal:', error);
    return next(error);
  }
};

const listMine = async (req, res, next) => {
  try {
    const result = await researchService.listMine(req.user.id, req.query || {});
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research listMine:', error);
    return next(error);
  }
};

const listWithdrawn = async (req, res, next) => {
  try {
    const result = await researchService.listWithdrawn(req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research listWithdrawn:', error);
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await researchService.remove(req.params.id, req.user, req.body || {});
    return ApiResponse.success(res, null, 'Đã thu hồi bài nghiên cứu');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research remove:', error);
    return next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const item = await researchService.restore(req.params.id, req.user);
    return ApiResponse.success(res, item, 'Đã khôi phục');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research restore:', error);
    return next(error);
  }
};

const getPublicById = async (req, res, next) => {
  try {
    const item = await researchService.getPublicById(req.params.id);
    return ApiResponse.success(res, item);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research getPublicById:', error);
    return next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const item = await researchService.getById(req.params.id, req.user);
    return ApiResponse.success(res, item);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research getById:', error);
    return next(error);
  }
};

const previewPublic = async (req, res, next) => {
  try {
    const { buffer, contentType } = await researchService.getPreviewPublic(req.params.id, req.user || null, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    return res.send(buffer);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research previewPublic:', error);
    return next(error);
  }
};

const previewAuth = async (req, res, next) => {
  try {
    const { buffer, contentType } = await researchService.getPreviewAuth(req.params.id, req.user);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    return res.send(buffer);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('research previewAuth:', error);
    return next(error);
  }
};

module.exports = {
  submit,
  listPublic,
  publicTagFacets,
  internalTagFacets,
  listInternal,
  listMine,
  listWithdrawn,
  remove,
  restore,
  getPublicById,
  getById,
  previewPublic,
  previewAuth,
  listPending,
  approve,
  reject,
};
