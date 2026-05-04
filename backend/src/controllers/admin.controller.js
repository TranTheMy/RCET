const adminService = require('../services/admin.service');
const ApiResponse = require('../utils/response');

const getApprovalRequests = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await adminService.getApprovalRequests({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.approveUser(id, req.user.id, req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await adminService.rejectUser(id, req.user.id, req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { status, role, search, page, limit } = req.query;
    const result = await adminService.getUsers({
      status,
      role,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const banUser = async (req, res, next) => {
  try {
    const result = await adminService.banUser(req.params.id, req.user.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const unbanUser = async (req, res, next) => {
  try {
    const result = await adminService.unbanUser(req.params.id, req.user.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const { action, page, limit } = req.query;
    const result = await adminService.getAuditLogs({
      action,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

module.exports = {
  getApprovalRequests,
  approveUser,
  rejectUser,
  getUsers,
  banUser,
  unbanUser,
  getAuditLogs,
};
