const Joi = require('joi');

const approveCurriculumSchema = Joi.object({
  review_note: Joi.string().trim().max(5000).allow('', null).optional(),
});

const rejectCurriculumSchema = Joi.object({
  review_note: Joi.string().trim().min(1).max(5000).required(),
});

module.exports = {
  approveCurriculumSchema,
  rejectCurriculumSchema,
};
