const Joi = require('joi');
const { COMMITMENT_STATUS } = require('../config/constants');

const updateCommitmentStatusSchema = Joi.object({
  status: Joi.string().valid(COMMITMENT_STATUS.B_APPROVED, COMMITMENT_STATUS.B_REJECTED).required()
    .messages({
      'any.required': 'Status is required.',
      'any.only': `Status must be one of [${COMMITMENT_STATUS.B_APPROVED}, ${COMMITMENT_STATUS.B_REJECTED}]`,
    }),
  reason: Joi.string().when('status', {
    is: COMMITMENT_STATUS.B_REJECTED,
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }).messages({
    'any.required': 'Rejection reason is required when status is B_REJECTED.',
  }),
});

const bulkArchiveCommitmentsSchema = Joi.object({
  commitmentIds: Joi.array().items(Joi.string().uuid()).min(1).required()
    .messages({
      'any.required': 'commitmentIds is required.',
      'array.min': 'At least one commitment ID is required.',
      'array.base': 'commitmentIds must be an array.',
      'string.guid': 'Each item in commitmentIds must be a valid UUID.',
    }),
});

module.exports = {
  updateCommitmentStatusSchema,
  bulkArchiveCommitmentsSchema,
};