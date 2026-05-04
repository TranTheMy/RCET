const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      logger.warn('Request body validation failed', {
        method: req.method,
        path: req.originalUrl || req.url,
        errorCount: errors.length,
        fields: errors.map((e) => e.field),
      });
      return ApiResponse.badRequest(res, 'Validation failed', errors);
    }

    req.body = value;
    next();
  };
};

module.exports = validate;
