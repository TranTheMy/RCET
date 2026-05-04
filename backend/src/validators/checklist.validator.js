const Joi = require('joi');

// Validation for creating a checklist
const createChecklistSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  category: Joi.string().valid('hardware', 'software', 'integration', 'testing').default('testing'),
  description: Joi.string().max(1000).allow('', null),
  items: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(500).required(),
      description: Joi.string().max(1000).allow('', null),
      expected_value: Joi.string().max(255).allow('', null),
    })
  ).optional(),
});

// Validation for updating a checklist
const updateChecklistSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  category: Joi.string().valid('hardware', 'software', 'integration', 'testing').optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
});

// Validation for updating a checklist item
const updateChecklistItemSchema = Joi.object({
  actual_value: Joi.string().max(255).allow('', null).optional(),
  status: Joi.string().valid('pending', 'pass', 'fail', 'na').required(),
  notes: Joi.string().max(1000).allow('', null).optional(),
});

// Validation for adding a checklist item
const addChecklistItemSchema = Joi.object({
  title: Joi.string().min(1).max(500).required(),
  description: Joi.string().max(1000).allow('', null),
  expected_value: Joi.string().max(255).allow('', null),
});

module.exports = {
  createChecklistSchema,
  updateChecklistSchema,
  updateChecklistItemSchema,
  addChecklistItemSchema,
};
