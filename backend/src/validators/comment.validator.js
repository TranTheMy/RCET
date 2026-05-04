const Joi = require('joi');

const createCommentSchema = Joi.object({
  content: Joi.string()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Comment content cannot be empty',
      'string.min': 'Comment content must be at least 1 character',
      'string.max': 'Comment content cannot exceed 1000 characters',
      'any.required': 'Comment content is required'
    })
});

const updateCommentSchema = Joi.object({
  content: Joi.string()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Comment content cannot be empty',
      'string.min': 'Comment content must be at least 1 character',
      'string.max': 'Comment content cannot exceed 1000 characters',
      'any.required': 'Comment content is required'
    })
});

module.exports = {
  createCommentSchema,
  updateCommentSchema,
};