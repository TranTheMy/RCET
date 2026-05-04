const ApiResponse = require('../utils/response');
const { USER_STATUS } = require('../config/constants');

const checkActiveStatus = (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res, 'Authentication required');
  }

  if (req.user.status === USER_STATUS.PENDING) {
    return ApiResponse.forbidden(res, 'Your account is waiting for Admin approval');
  }

  if (req.user.status === USER_STATUS.REJECTED) {
    return ApiResponse.forbidden(res, 'Your account has been rejected');
  }

  if (req.user.status === USER_STATUS.LOCKED) {
    return ApiResponse.forbidden(res, 'Your account has been locked');
  }

  next();
};

module.exports = checkActiveStatus;
