const Joi = require('joi');

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().allow('', null).max(5000).optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().allow('', null).max(5000).optional(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
};
