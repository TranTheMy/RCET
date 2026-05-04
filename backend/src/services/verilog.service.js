const { Op, fn, col, literal } = require('sequelize');
const {
  VerilogProblem,
  VerilogTestCase,
  VerilogSubmission,
  VerilogSubmissionResult,
  User,
} = require('../models');

const escapeLike = (s) => s.replace(/[%_]/g, '\\$&');

/* ================================================================== */
/*  PROBLEMS                                                           */
/* ================================================================== */

const listProblems = async ({ page = 1, limit = 20, search, level, tag, is_published }) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const where = {};
  if (search) where.name = { [Op.like]: `%${escapeLike(search)}%` };
  if (level) where.level = level;
  if (tag) where.tags = { [Op.like]: `%${escapeLike(tag)}%` };
  if (is_published !== undefined) where.is_published = is_published === 'true';

  const offset = (pageNum - 1) * limitNum;
  const { rows, count } = await VerilogProblem.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'full_name'] }],
    order: [['logic_id', 'ASC']],
    limit: limitNum,
    offset,
  });

  // Enrich each problem with stats
  const problems = await Promise.all(
    rows.map(async (p) => {
      const json = p.toJSON();
      const testcases = await VerilogTestCase.findAll({ where: { problem_id: p.id } });
      json.total_grade = testcases.reduce((s, t) => s + t.grade, 0);
      json.testcase_count = testcases.length;

      // Submission stats
      const submittedUsers = await VerilogSubmission.count({
        where: { problem_id: p.id },
        distinct: true,
        col: 'user_id',
      });
      const acUsers = await VerilogSubmission.count({
        where: { problem_id: p.id, overall_failure: 'NONE' },
        distinct: true,
        col: 'user_id',
      });
      json.submitted_users = submittedUsers;
      json.ac_users = acUsers;
      return json;
    }),
  );

  return {
    problems,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
    },
  };
};

const getProblemById = async (id) => {
  const problem = await VerilogProblem.findByPk(id, {
    include: [
      { model: User, as: 'owner', attributes: ['id', 'full_name'] },
      { model: VerilogTestCase, as: 'testcases' },
    ],
    order: [[{ model: VerilogTestCase, as: 'testcases' }, 'order_index', 'ASC']],
  });
  return problem;
};

const createProblem = async (data) => {
  return VerilogProblem.create(data);
};

const updateProblem = async (id, data) => {
  const problem = await VerilogProblem.findByPk(id);
  if (!problem) return null;
  await problem.update(data);
  return problem;
};

const deleteProblem = async (id) => {
  const problem = await VerilogProblem.findByPk(id);
  if (!problem) return false;
  // Delete results for all submissions of this problem
  const submissions = await VerilogSubmission.findAll({ where: { problem_id: id }, attributes: ['id'] });
  const submissionIds = submissions.map((s) => s.id);
  if (submissionIds.length) {
    await VerilogSubmissionResult.destroy({ where: { submission_id: submissionIds } });
  }
  await VerilogSubmission.destroy({ where: { problem_id: id } });
  await VerilogTestCase.destroy({ where: { problem_id: id } });
  await problem.destroy();
  return true;
};

/* ================================================================== */
/*  TEST CASES                                                         */
/* ================================================================== */

const listTestCases = async (problemId) => {
  return VerilogTestCase.findAll({
    where: { problem_id: problemId },
    order: [['order_index', 'ASC']],
  });
};

const createTestCase = async (data) => {
  return VerilogTestCase.create(data);
};

const updateTestCase = async (id, data) => {
  const tc = await VerilogTestCase.findByPk(id);
  if (!tc) return null;
  await tc.update(data);
  return tc;
};

const deleteTestCase = async (id) => {
  const tc = await VerilogTestCase.findByPk(id);
  if (!tc) return false;
  await tc.destroy();
  return true;
};

/**
 * Reads VKSLAB_SUBTESTS_JSON from problem.testbench and upserts VerilogTestCase rows
 * (match by problem_id + subtest_key). Safe to run repeatedly after editing TB.
 */
const syncSubtestsFromTestbench = async (problemId) => {
  const problem = await VerilogProblem.findByPk(problemId);
  if (!problem) throw new Error('Problem not found');
  if (problem.testbench_type !== 'custom_uploaded' || !String(problem.testbench || '').trim()) {
    throw new Error('Chỉ dùng khi loại testbench là custom_uploaded và đã có nội dung testbench');
  }

  const { parseSubtestsFromTestbench } = require('./verilog.subtest.meta');
  const parsed = parseSubtestsFromTestbench(problem.testbench);
  if (!parsed.ok) throw new Error(parsed.error || 'Không parse được VKSLAB_SUBTESTS_JSON');

  const sequelize = VerilogProblem.sequelize;
  await sequelize.transaction(async (transaction) => {
    for (const s of parsed.subtests) {
      const [row, created] = await VerilogTestCase.findOrCreate({
        where: { problem_id: problemId, subtest_key: s.id },
        defaults: {
          problem_id: problemId,
          subtest_key: s.id,
          name: s.name,
          grade: s.grade,
          order_index: s.order_index,
          synced_from_tb: true,
          type: 'SIM',
          input: null,
          expected_output: null,
          testbench_code: null,
        },
        transaction,
      });
      if (!created) {
        await row.update(
          {
            name: s.name,
            grade: s.grade,
            order_index: s.order_index,
            synced_from_tb: true,
          },
          { transaction },
        );
      }
    }
  });

  return listTestCases(problemId);
};

/* ================================================================== */
/*  SUBMISSIONS                                                        */
/* ================================================================== */

const listSubmissions = async ({ page = 1, limit = 20, problem_id, user_id, status }) => {
  const where = {};
  if (problem_id) where.problem_id = problem_id;
  if (user_id) where.user_id = user_id;
  if (status) where.status = status;

  const offset = (page - 1) * limit;
  const { rows, count } = await VerilogSubmission.findAndCountAll({
    where,
    include: [
      { model: VerilogProblem, as: 'problem', attributes: ['id', 'name', 'level'] },
      { model: User, as: 'user', attributes: ['id', 'full_name'] },
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit, 10),
    offset,
    attributes: { exclude: ['code'] }, // Don't send code in list
  });

  return {
    submissions: rows,
    pagination: {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getSubmissionById = async (id) => {
  return VerilogSubmission.findByPk(id, {
    include: [
      { model: VerilogProblem, as: 'problem', attributes: ['id', 'name', 'level'] },
      { model: User, as: 'user', attributes: ['id', 'full_name'] },
      {
        model: VerilogSubmissionResult,
        as: 'results',
        include: [{ model: VerilogTestCase, as: 'testcase', attributes: ['id', 'name', 'grade', 'order_index'] }],
      },
    ],
  });
};

const createSubmission = async (data) => {
  return VerilogSubmission.create(data);
};

/* ================================================================== */
/*  USER STATS                                                         */
/* ================================================================== */

const getUserStats = async (userId) => {
  const submitted = await VerilogSubmission.count({
    where: { user_id: userId },
    distinct: true,
    col: 'problem_id',
  });
  const accepted = await VerilogSubmission.count({
    where: { user_id: userId, overall_failure: 'NONE' },
    distinct: true,
    col: 'problem_id',
  });

  // Sum only best accepted submission per problem
  const [bestScores] = await VerilogSubmission.sequelize.query(
    `SELECT COALESCE(SUM(best), 0) AS total FROM (
       SELECT MAX(total_grade) AS best
       FROM verilog_submissions
       WHERE user_id = :userId AND overall_failure = 'NONE'
       GROUP BY problem_id
     ) sub`,
    { replacements: { userId }, type: VerilogSubmission.sequelize.QueryTypes.SELECT },
  );

  return {
    submitted_problems: submitted,
    accepted_problems: accepted,
    total_score: bestScores?.total || 0,
  };
};

/**
 * Get the user's best submission status per problem (for the problem list status icons).
 */
const getUserProblemStatuses = async (userId) => {
  const submissions = await VerilogSubmission.findAll({
    where: { user_id: userId },
    attributes: ['problem_id', 'overall_failure', 'total_grade', 'max_grade'],
    order: [['created_at', 'DESC']],
  });

  const map = {};
  for (const sub of submissions) {
    const pid = sub.problem_id;
    if (!map[pid]) {
      map[pid] = sub.overall_failure === 'NONE' ? 'accepted' : 'attempted';
    } else if (sub.overall_failure === 'NONE') {
      map[pid] = 'accepted';
    }
  }
  return map; // { problemId: 'accepted' | 'attempted' }
};

const updateSubmission = async (id, data) => {
  const submission = await VerilogSubmission.findByPk(id);
  if (!submission) return null;
  await submission.update(data);
  return submission;
};

module.exports = {
  listProblems,
  getProblemById,
  createProblem,
  updateProblem,
  deleteProblem,
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  syncSubtestsFromTestbench,
  listSubmissions,
  getSubmissionById,
  createSubmission,
  updateSubmission,
  getUserStats,
  getUserProblemStatuses,
};
