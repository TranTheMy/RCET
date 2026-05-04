const { SYSTEM_ROLES } = require('../config/constants');
const ApiResponse = require('../utils/response');

/**
 * Chặn tài khoản system_role `user` (người dùng cơ bản) — cùng phạm vi truy cập
 * với khách (guest): không dùng API thành viên / dự án / nội dung nội bộ.
 */
function forbidBasicUser(req, res, next) {
  if (req.user?.system_role === SYSTEM_ROLES.USER) {
    return ApiResponse.forbidden(
      res,
      'Tài khoản này chỉ truy cập được nội dung công khai. Liên hệ quản trị để được cấp quyền thành viên.',
    );
  }
  next();
}

module.exports = forbidBasicUser;
