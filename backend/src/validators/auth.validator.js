const Joi = require('joi');

const registerSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(255).required()
    .messages({ 'string.min': 'Full name must be at least 2 characters' }),
  email: Joi.string().email().required()
    .messages({ 'string.email': 'Please provide a valid email address' }),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase, one lowercase, one digit, and one special character',
      'string.min': 'Password must be at least 8 characters',
    }),
  student_code: Joi.string().trim().max(50).allow('', null).optional(),
  department: Joi.string().trim().max(255).allow('', null).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase, one lowercase, one digit, and one special character',
      'string.min': 'Password must be at least 8 characters',
    }),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase, one lowercase, one digit, and one special character',
      'string.min': 'Password must be at least 8 characters',
    }),
});

const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(255).optional(),
  student_code: Joi.string().trim().max(50).allow('', null).optional(),
  department: Joi.string().trim().max(255).allow('', null).optional(),
  phone_number: Joi.string()
    .trim()
    .allow('', null)
    .optional()
    .custom((value, helpers) => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const s = String(value).trim();
      if (s === '') return null;
      if (!/^\d+$/.test(s)) {
        return helpers.error('any.invalid');
      }
      if (s.length < 8 || s.length > 15) {
        return helpers.error('string.length');
      }
      return s;
    })
    .messages({
      'any.invalid': 'Số điện thoại chỉ được nhập chữ số (không nhập chữ cái hoặc ký tự đặc biệt).',
      'string.length': 'Số điện thoại phải có từ 8 đến 15 chữ số.',
    }),
}).min(1);

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
};
