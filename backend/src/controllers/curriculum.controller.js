const curriculumService = require('../services/curriculum.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const listPublic = async (req, res, next) => {
  try {
    const result = await curriculumService.listPublic(req.query, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('curriculum.listPublic:', error);
    return next(error);
  }
};

const listMine = async (req, res, next) => {
  try {
    const result = await curriculumService.listMine(req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('curriculum.listMine:', error);
    return next(error);
  }
};

const listPending = async (req, res, next) => {
  try {
    const result = await curriculumService.listPending(req.query, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.listPending:', error);
    return next(error);
  }
};

const history = async (req, res, next) => {
  try {
    const result = await curriculumService.history(req.query.version_group_id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.history:', error);
    return next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const result = await curriculumService.getById(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.getOne:', error);
    return next(error);
  }
};

const getDownloadUrl = async (req, res, next) => {
  try {
    const result = await curriculumService.getDownloadPayload(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.getDownloadUrl:', error);
    return next(error);
  }
};

const preview = async (req, res, next) => {
  try {
    const url = await curriculumService.getPreviewRedirectUrl(req.params.id, req.user);
    return res.redirect(302, url);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.preview:', error);
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const result = await curriculumService.create(req.body || {}, req.file, req.user);
    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('curriculum.create:', error);
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const result = await curriculumService.update(req.params.id, req.body || {}, req.file, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status, error.errors || null);
    logger.error('curriculum.update:', error);
    return next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await curriculumService.remove(req.params.id, req.user, req.body || {});
    return ApiResponse.success(res, null, 'Đã xóa');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.remove:', error);
    return next(error);
  }
};

const restore = async (req, res, next) => {
  try {
    const result = await curriculumService.restore(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.restore:', error);
    return next(error);
  }
};

const submit = async (req, res, next) => {
  try {
    const result = await curriculumService.submit(req.params.id, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.submit:', error);
    return next(error);
  }
};

const approve = async (req, res, next) => {
  try {
    const result = await curriculumService.approve(req.params.id, req.body || {}, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.approve:', error);
    return next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const result = await curriculumService.reject(req.params.id, req.body || {}, req.user);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.reject:', error);
    return next(error);
  }
};

const createVersion = async (req, res, next) => {
  try {
    const result = await curriculumService.createVersion(req.params.id, req.body || {}, req.file, req.user);
    return ApiResponse.created(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    logger.error('curriculum.createVersion:', error);
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
