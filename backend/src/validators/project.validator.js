const Joi = require('joi');
const {
  PROJECT_STATUS_VALUES,
  PROJECT_TAG_VALUES,
  TASK_STATUS_VALUES,
  TASK_PRIORITY_VALUES,
  GIT_PROVIDER_VALUES,
  GIT_VISIBILITY_VALUES,
  COMMITMENT_MODEL_TYPE_VALUES,
} = require('../config/constants');

// ======== Project Schemas ========

const createProjectSchema = Joi.object({
  code: Joi.string().max(50).required().uppercase()
    .messages({ 'any.required': 'Project code is required' }),
  name: Joi.string().min(5).max(255).required()
    .messages({
      'any.required': 'Project name is required',
      'string.min': 'Project name must be at least 5 characters',
    }),
  description: Joi.string().allow('', null).optional(),
  tag: Joi.string().valid(...PROJECT_TAG_VALUES).allow('', null).optional(),
  status: Joi.string().valid(...PROJECT_STATUS_VALUES).default('planning').optional(),
  start_date: Joi.date().iso().required()
    .messages({ 'any.required': 'Start date is required' }),
  end_date: Joi.date().iso().greater(Joi.ref('start_date')).required()
    .messages({
      'any.required': 'End date is required',
      'date.greater': 'End date must be after start date',
    }),
  budget: Joi.number().integer().min(0).allow(null).optional(),
  members: Joi.array().items(Joi.string().uuid()).max(5).optional(),
  git_repo_url: Joi.string().uri().max(500).allow('', null).optional(),
  
  // --- CÁC TRƯỜNG MỚI ĐƯỢC CẬP NHẬT CHO MODE 2 ---
  participation_mode: Joi.string().valid('TAG', 'SELF_JOIN').required()
    .messages({ 'any.required': 'Participation mode is required' }),
  required_members: Joi.number().integer().min(1).allow(null).optional(),
  
  // Các trường cũ giờ cho phép null (vì Mode 2 không bắt buộc ngay từ đầu)
  leader_id: Joi.string().uuid().allow(null, '').optional(),
  model_type: Joi.string().valid(...COMMITMENT_MODEL_TYPE_VALUES).allow(null, '').optional(),
  party_a_id: Joi.string().uuid().allow(null, '').optional(),
  party_a_percent: Joi.number().integer().min(0).max(100).allow(null).optional(),
  party_b_percent: Joi.number().integer().min(0).max(100).allow(null).optional(),
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(5).max(255).optional(),
  description: Joi.string().allow('', null).optional(),
  tag: Joi.string().valid(...PROJECT_TAG_VALUES).allow('', null).optional(),
  status: Joi.string().valid(...PROJECT_STATUS_VALUES).optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  budget: Joi.number().integer().min(0).allow(null).optional(),
}).min(1);

const checkCodeSchema = Joi.object({
  code: Joi.string().max(50).required().uppercase(),
});

// ======== Task Schemas ========

const createTaskSchema = Joi.object({
  title: Joi.string().max(255).required()
    .messages({ 'any.required': 'Task title is required' }),
  description: Joi.string().allow('', null).optional(),
  status: Joi.string().valid(...TASK_STATUS_VALUES).default('todo').optional(),
  priority: Joi.string().valid(...TASK_PRIORITY_VALUES).default('medium').optional(),
  assignee_id: Joi.string().uuid().allow(null).optional(),
  due_date: Joi.date().iso().allow(null).optional(),
});

const updateTaskSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  description: Joi.string().allow('', null).optional(),
  status: Joi.string().valid(...TASK_STATUS_VALUES).optional(),
  priority: Joi.string().valid(...TASK_PRIORITY_VALUES).optional(),
  assignee_id: Joi.string().uuid().allow(null).optional(),
  due_date: Joi.date().iso().allow(null).optional(),
}).min(1);

// ======== Milestone Schemas ========

const createMilestoneSchema = Joi.object({
  title: Joi.string().max(255).required()
    .messages({ 'any.required': 'Milestone title is required' }),
  description: Joi.string().allow('', null).optional(),
  due_date: Joi.date().iso().required()
    .messages({ 'any.required': 'Due date is required' }),
  linked_tasks: Joi.array().items(Joi.string().uuid()).optional(),
});

const updateMilestoneSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  description: Joi.string().allow('', null).optional(),
  due_date: Joi.date().iso().optional(),
  done: Joi.boolean().optional(),
  linked_tasks: Joi.array().items(Joi.string().uuid()).optional(),
}).min(1);

// ======== Member Schemas ========

const addMemberSchema = Joi.object({
  user_id: Joi.string().uuid().required()
    .messages({ 'any.required': 'User ID is required' }),
  role: Joi.string().valid('leader', 'member').default('member').optional(),
});

const activateProjectSchema = Joi.object({
  leader_id: Joi.string().uuid().optional(),
});

// ======== Report Schemas ========

const createReportSchema = Joi.object({
  content: Joi.string().allow('', null).optional(),
  week_number: Joi.number().integer().min(1).max(53).required(),
  year: Joi.number().integer().min(2020).max(2100).required(),
  source_type: Joi.string().valid('text', 'upload', 'link').optional(),
  link_url: Joi.string().uri().allow('', null).optional(),
  task_ids: Joi.alternatives().try(
    Joi.array().items(Joi.string().uuid()),
    Joi.string()
  ).optional(),
});

// ======== Git Repo Schemas ========

const updateGitRepoSchema = Joi.object({
  git_repo_url: Joi.string().uri().max(500).required()
    .messages({ 'any.required': 'Repository URL is required' }),
  git_provider: Joi.string().valid(...GIT_PROVIDER_VALUES).required()
    .messages({ 'any.required': 'Git provider is required' }),
  git_default_branch: Joi.string().max(100).default('main').optional(),
  git_visibility: Joi.string().valid(...GIT_VISIBILITY_VALUES).default('private').optional(),
});

const gitWebhookSchema = Joi.object({
  sha: Joi.string().max(40).required(),
  author: Joi.string().max(255).required(),
  message: Joi.string().max(500).required(),
  timestamp: Joi.date().iso().required(),
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  checkCodeSchema,
  createTaskSchema,
  updateTaskSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  addMemberSchema,
  activateProjectSchema,
  createReportSchema,
  updateGitRepoSchema,
  gitWebhookSchema,
};