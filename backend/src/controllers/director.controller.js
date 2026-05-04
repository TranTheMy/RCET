const directorService = require('../services/director.service');
const ApiResponse = require('../utils/response');

const listLabStaff = async (req, res, next) => {
  try {
    const { role, search, page, limit } = req.query;
    const result = await directorService.listLabStaff({
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

const updateLabStaffRole = async (req, res, next) => {
  try {
    const result = await directorService.updateLabStaffRole(req.user.id, req.params.id, req.body);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

module.exports = {
  listLabStaff,
  updateLabStaffRole,
};
