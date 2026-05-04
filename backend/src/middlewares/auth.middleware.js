const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiResponse = require('../utils/response');

const authMiddleware = async (req, res, next) => {
  console.log('\n[DEBUG] Auth Middleware Triggered');
  console.log('Request URL:', req.originalUrl);
  console.log('Request Query Params:', req.query); // <-- Dòng debug quan trọng

  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    const decoded = jwt.verify(token, env.jwt.accessSecret);

    const user = await User.findByPk(decoded.user_id, {
      attributes: ['id', 'full_name', 'email', 'system_role', 'status', 'email_verified'],
    });

    if (!user) {
      return ApiResponse.unauthorized(res, 'User no longer exists');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Access token expired');
    }
    return ApiResponse.unauthorized(res, 'Invalid access token');
  }
};

const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    // req.user should be attached by authMiddleware
    if (!req.user || !req.user.system_role) {
      return ApiResponse.forbidden(res, 'Permission denied. User role not available.');
    }

    const hasRole = allowedRoles.includes(req.user.system_role);
    if (!hasRole) {
      return ApiResponse.forbidden(res, 'You do not have permission to perform this action.');
    }

    next();
  };
};

// Attach the requireRoles function as a property to the authMiddleware
authMiddleware.requireRoles = requireRoles;

module.exports = authMiddleware;