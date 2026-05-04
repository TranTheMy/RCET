const ApiResponse = require('../utils/response');
const scientistApplicationService = require('../services/scientistApplication.service');
const logger = require('../utils/logger');

const submit = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.fullName || !body.email) {
      return ApiResponse.badRequest(res, 'Thiếu fullName hoặc email');
    }
    const file = req.file;
    const data = await scientistApplicationService.submit(
      req.user.id,
      body,
      file?.buffer,
      file?.originalname,
    );
    return ApiResponse.created(res, data, 'Đã nộp hồ sơ');
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    logger.error('scientist submit:', err);
    next(err);
  }
};

const checkPhone = async (req, res, next) => {
  try {
    const phone = req.query.phone ?? '';
    const available = await scientistApplicationService.isPhoneAvailableForApplicant(req.user.id, phone);
    return ApiResponse.success(res, { available });
  } catch (err) {
    next(err);
  }
};

const listMine = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const data = await scientistApplicationService.listMine(req.user.id, page, limit);
    return ApiResponse.success(res, data);
  } catch (err) {
    next(err);
  }
};

const listForReview = async (req, res, next) => {
  try {
    const data = await scientistApplicationService.listForReview(req.user);
    return ApiResponse.success(res, data);
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await scientistApplicationService.getById(req.params.id, req.user);
    return ApiResponse.success(res, data);
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    next(err);
  }
};

const labReview = async (req, res, next) => {
  try {
    const { action, comment } = req.body || {};
    if (action !== 'APPROVE' && action !== 'REJECT') {
      return ApiResponse.badRequest(res, 'action phải là APPROVE hoặc REJECT');
    }
    const data = await scientistApplicationService.labReview(req.params.id, req.user.id, action, comment);
    return ApiResponse.success(res, data);
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    next(err);
  }
};

const directorReview = async (req, res, next) => {
  try {
    const { action, comment } = req.body || {};
    if (action !== 'APPROVE' && action !== 'REJECT') {
      return ApiResponse.badRequest(res, 'action phải là APPROVE hoặc REJECT');
    }
    const data = await scientistApplicationService.directorReview(req.params.id, req.user.id, action, comment);
    return ApiResponse.success(res, data);
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    next(err);
  }
};

const generateContract = async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.partyAName || !b.partyAWorkUnit || !b.partyAEmail || !b.partyBName || !b.partyBEmail || !b.contractSummary) {
      return ApiResponse.badRequest(res, 'Thiếu thông tin bắt buộc (bên A, bên B, contractSummary)');
    }
    const data = await scientistApplicationService.generateContract(req.params.id, req.user.id, b);
    return ApiResponse.success(res, data, 'Đã tạo file hợp đồng');
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    logger.error('scientist generateContract:', err);
    next(err);
  }
};

const confirmContract = async (req, res, next) => {
  try {
    const data = await scientistApplicationService.confirmContract(req.params.id, req.user.id);
    return ApiResponse.success(res, data, 'Đã xác nhận hợp đồng');
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    next(err);
  }
};

const recordContract = async (req, res, next) => {
  try {
    const b = req.body || {};
    const file = req.file;
    const data = await scientistApplicationService.recordContract(
      req.params.id,
      req.user.id,
      {
        contractSummary: b.contractSummary,
        contractFileUrl: b.contractFileUrl,
      },
      file?.buffer,
      file?.originalname,
    );
    return ApiResponse.success(res, data, 'Đã ghi nhận hợp đồng');
  } catch (err) {
    if (err.status) return ApiResponse.error(res, err.message, err.status);
    logger.error('scientist recordContract:', err);
    next(err);
  }
};

module.exports = {
  submit,
  checkPhone,
  listMine,
  listForReview,
  getOne,
  labReview,
  directorReview,
  generateContract,
  confirmContract,
  recordContract,
};
