const Joi = require('joi');
const { SYSTEM_ROLES } = require('../config/constants');
/** Admin chỉ được cấp vai trò người dùng cơ bản (`user`); nâng quyền qua kênh khác. */
const APPROVABLE_ROLES = [SYSTEM_ROLES.USER];

const approveSchema = Joi.object({
  system_role: Joi.string().valid(...APPROVABLE_ROLES).required()
    .messages({ 'any.only': `Role must be one of: ${APPROVABLE_ROLES.join(', ')}` }),
  review_note: Joi.string().max(1000).allow('', null).optional(),
});

const rejectSchema = Joi.object({
  review_note: Joi.string().max(1000).allow('', null).optional(),
});

module.exports = {
  approveSchema,
  rejectSchema,
};
