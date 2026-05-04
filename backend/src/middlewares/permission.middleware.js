const { AppError } = require('../utils/response');
const { SYSTEM_ROLES } = require('../config/constants');

/**
 * Middleware to check if the user has one of the required roles.
 * @param {Array<string>} allowedRoles - Array of roles that are allowed to access the route.
 */
const checkPermission = (allowedRoles) => (req, res, next) => {
  const user = req.user;

  if (!user || !user.system_role) {
    return next(new AppError(401, 'Authentication error: User data is missing.'));
  }

  if (!allowedRoles.includes(user.system_role)) {
    return next(new AppError(403, 'Forbidden: You do not have permission to perform this action.'));
  }

  next();
};

module.exports = checkPermission;