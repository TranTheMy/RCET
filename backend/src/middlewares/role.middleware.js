const ApiResponse = require('../utils/response');

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    if (!req.user.system_role || !allowedRoles.includes(req.user.system_role)) {
      return ApiResponse.forbidden(res, 'You do not have permission to access this resource');
    }

    next();
  };
};

module.exports = checkRole;
