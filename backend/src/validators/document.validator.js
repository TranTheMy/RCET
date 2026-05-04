const Joi = require('joi');

/** PATCH /documents/:id/approve */
const approveDocumentSchema = Joi.object({
  review_note: Joi.string().trim().max(5000).allow('', null).optional(),
});

/** PATCH /documents/:id/reject */
const rejectDocumentSchema = Joi.object({
  review_note: Joi.string().trim().min(1).max(5000).required(),
});

module.exports = {
  approveDocumentSchema,
  rejectDocumentSchema,
};
