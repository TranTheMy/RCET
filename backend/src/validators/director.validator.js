const Joi = require('joi');
const { SYSTEM_ROLES } = require('../config/constants');

const updateStaffRoleSchema = Joi.object({
  system_role: Joi.string()
    .valid(SYSTEM_ROLES.MEMBER, SYSTEM_ROLES.TRUONG_LAB)
    .required()
    .messages({
      'any.only': `system_role must be ${SYSTEM_ROLES.MEMBER} or ${SYSTEM_ROLES.TRUONG_LAB}`,
    }),
  note: Joi.string().max(1000).allow('', null).optional(),
});

module.exports = {
  updateStaffRoleSchema,
};
