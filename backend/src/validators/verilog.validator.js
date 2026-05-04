const Joi = require('joi');

const createProblem = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().allow('', null),
  description_input: Joi.string().allow('', null),
  description_output: Joi.string().allow('', null),
  level: Joi.string().valid('easy', 'medium', 'hard').default('easy'),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string(),
  ).allow(null),
  template_code: Joi.string().allow('', null),
  testbench: Joi.string().allow('', null),
  testbench_type: Joi.string().valid('auto_generated', 'custom_uploaded').default('auto_generated'),
  deadline: Joi.date().iso().allow(null),
  is_published: Joi.boolean().default(true),
});

const updateProblem = Joi.object({
  name: Joi.string().min(1).max(255),
  description: Joi.string().allow('', null),
  description_input: Joi.string().allow('', null),
  description_output: Joi.string().allow('', null),
  level: Joi.string().valid('easy', 'medium', 'hard'),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string(),
  ).allow(null),
  template_code: Joi.string().allow('', null),
  testbench: Joi.string().allow('', null),
  testbench_type: Joi.string().valid('auto_generated', 'custom_uploaded'),
  deadline: Joi.date().iso().allow(null),
  is_published: Joi.boolean(),
}).min(1);

const createTestCase = Joi.object({
  name: Joi.string().max(255).allow('', null),
  type: Joi.string().valid('SIM', 'SYNTHSIM').default('SIM'),
  grade: Joi.number().integer().min(0).default(10),
  input: Joi.string().allow('', null),
  expected_output: Joi.string().allow('', null),
  testbench_code: Joi.string().allow('', null),
  expected_vcd: Joi.string().allow('', null),
  time_limit: Joi.number().integer().min(1).max(300).default(60),
  mem_limit: Joi.number().integer().min(1).default(128),
  order_index: Joi.number().integer().min(0).default(0),
});

const updateTestCase = Joi.object({
  name: Joi.string().max(255).allow('', null),
  type: Joi.string().valid('SIM', 'SYNTHSIM'),
  grade: Joi.number().integer().min(0),
  input: Joi.string().allow('', null),
  expected_output: Joi.string().allow('', null),
  testbench_code: Joi.string().allow('', null),
  expected_vcd: Joi.string().allow('', null),
  time_limit: Joi.number().integer().min(1).max(300),
  mem_limit: Joi.number().integer().min(1),
  order_index: Joi.number().integer().min(0),
}).min(1);

const submitCode = Joi.object({
  problem_id: Joi.string().uuid().required(),
  code: Joi.string().min(1).max(100000).required(),
  language: Joi.string().valid('verilog', 'systemverilog').default('verilog'),
});

module.exports = {
  createProblem,
  updateProblem,
  createTestCase,
  updateTestCase,
  submitCode,
};
