const Joi = require('joi');

const createPostSchema = Joi.object({
  title: Joi.string().min(3).max(150).required(),
  content: Joi.string().min(3).max(5000).required(),
});

const updatePostSchema = Joi.object({
  title: Joi.string().min(3).max(150),
  content: Joi.string().min(3).max(5000),
}).or('title', 'content');

const createCommentSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
});

const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required(),
});

module.exports = {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
};
