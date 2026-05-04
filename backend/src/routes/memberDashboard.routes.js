const express = require('express');
const router = express.Router();
const memberDashboardController = require('../controllers/memberDashboard.controller');
const auth = require('../middlewares/auth.middleware');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

// All dashboard routes require authentication
router.use(auth);
router.use(forbidBasicUser);

/**
 * @swagger
 * /api/members/dashboard:
 *   get:
 *     tags:
 *       - Member Dashboard
 *     summary: Get member dashboard data
 *     description: Retrieve comprehensive dashboard data for authenticated member
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Dashboard data retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     personal:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "user-uuid"
 *                         full_name:
 *                           type: string
 *                           example: "Nguyễn Văn A"
 *                         email:
 *                           type: string
 *                           example: "nguyenvana@lab.com"
 *                         department:
 *                           type: string
 *                           example: "Computer Science"
 *                         system_role:
 *                           type: string
 *                           example: "member"
 *                         joined_at:
 *                           type: string
 *                           format: date-time
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           role:
 *                             type: string
 *                             enum: [leader, member]
 *                           joined_at:
 *                             type: string
 *                             format: date-time
 *                           tasks:
 *                             type: object
 *                             properties:
 *                               total:
 *                                 type: integer
 *                               done:
 *                                 type: integer
 *                               in_progress:
 *                                 type: integer
 *                               todo:
 *                                 type: integer
 *                               overdue:
 *                                 type: integer
 *                           report_rate:
 *                             type: integer
 *                             description: "Percentage of on-time reports"
 *                           at_risk:
 *                             type: boolean
 *                           next_milestones:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 title:
 *                                   type: string
 *                                 due_date:
 *                                   type: string
 *                                   format: date-time
 *                                 done:
 *                                   type: boolean
 *                     tasks:
 *                       type: object
 *                       properties:
 *                         in_progress:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               priority:
 *                                 type: string
 *                               due_date:
 *                                 type: string
 *                                 format: date-time
 *                               project:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   code:
 *                                     type: string
 *                         todo:
 *                           type: array
 *                         done_this_week:
 *                           type: array
 *                         overdue:
 *                           type: array
 *                     reports:
 *                       type: object
 *                       properties:
 *                         history:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               week:
 *                                 type: integer
 *                               year:
 *                                 type: integer
 *                               status:
 *                                 type: string
 *                                 enum: [submitted, late, missing]
 *                               submitted_at:
 *                                 type: string
 *                                 format: date-time
 *                               due_date:
 *                                 type: string
 *                                 format: date-time
 *                         rate:
 *                           type: integer
 *                           description: "Compliance rate percentage"
 *                         streak:
 *                           type: integer
 *                           description: "Consecutive on-time weeks"
 *                         next_due:
 *                           type: string
 *                           format: date-time
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         task_completion_rate:
 *                           type: integer
 *                         report_submission_rate:
 *                           type: integer
 *                         average_completion_time:
 *                           type: number
 *                         team_ranking:
 *                           type: object
 *                           properties:
 *                             position:
 *                               type: integer
 *                             total_members:
 *                               type: integer
 *                             percentile:
 *                               type: integer
 *                         achievements:
 *                           type: array
 *                           items:
 *                             type: string
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [task_completed, report_submitted]
 *                           description:
 *                             type: string
 *                           project:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           icon:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard', memberDashboardController.getDashboard);
router.patch('/dashboard/tasks/:taskId/complete', memberDashboardController.completeTask);

module.exports = router;