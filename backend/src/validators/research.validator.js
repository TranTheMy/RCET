const Joi = require('joi');

/** PATCH /research/:id/approve */
const approveResearchSchema = Joi.object({
  isPublic: Joi.boolean().optional(),
  review_note: Joi.string().trim().max(5000).allow('', null).optional(),
});

/** PATCH /research/:id/reject */
const rejectResearchSchema = Joi.object({
  review_note: Joi.string().trim().min(1).max(5000).required(),
});

module.exports = {
  approveResearchSchema,
  rejectResearchSchema,
};
