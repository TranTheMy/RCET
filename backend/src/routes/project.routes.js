const router = require('express').Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware');
const checkStatus = require('../middlewares/status.middleware');
const validate = require('../middlewares/validate.middleware');
const researchUpload = require('../middlewares/researchUpload.middleware');
const {
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  addMemberSchema,
  activateProjectSchema,
  createReportSchema,
  updateGitRepoSchema,
  gitWebhookSchema,
} = require('../validators/project.validator');
const { SYSTEM_ROLES } = require('../config/constants');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

// Git webhook has no auth (called by GitHub/GitLab/Bitbucket)
router.post('/:id/git/webhook', validate(gitWebhookSchema), projectController.handleGitWebhook);

/** Tổng dự án trạng thái active — Home / thống kê công khai */
router.get('/public/active-count', projectController.countActiveProjectsPublic);

// ==========================================
// TẤT CẢ CÁC ROUTES BÊN DƯỚI ĐỀU PHẢI ĐĂNG NHẬP
// ==========================================
router.use(authMiddleware);
router.use(forbidBasicUser);

// ======== Projects ========

// Check project code availability — requires authentication (tested)
router.get('/check-code', projectController.checkCode);

// List projects (all authenticated + active users)
router.get('/', projectController.listProjects);

// Search active users (for leader picker when creating project)
router.get('/active-users', projectController.searchActiveUsers);

// Create project (truong_lab, vien_truong only)
router.post(
  '/',
  checkRole(SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG),
  validate(createProjectSchema),
  projectController.createProject,
);
// Assign new leader (truong_lab, vien_truong only)
router.patch(
  '/:id/assign-leader',
  checkRole(SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG),
  projectController.assignNewLeader
);
// Get project detail
router.get('/:id', projectController.getProjectDetail);

// Update project
router.put('/:id', validate(updateProjectSchema), projectController.updateProject);

// Get project overview (Tab 1)
router.get('/:id/overview', projectController.getProjectOverview);

// ======== Tasks (Tab 2) ========

router.get('/:id/tasks', projectController.listTasks);
router.get('/:id/workload/:userId', projectController.getMemberWorkload);
router.post('/:id/tasks', validate(createTaskSchema), projectController.createTask);
router.get('/:id/tasks/:taskId', projectController.getTaskDetail);
router.put('/:id/tasks/:taskId', validate(updateTaskSchema), projectController.updateTask);

// ======== Reports (Tab 3) ========

router.get('/:id/reports', projectController.listReports);
router.get('/:id/reports/compliance', projectController.getComplianceMatrix);
router.get('/:id/reports/:reportId/preview', projectController.previewReport);
router.post('/:id/reports', researchUpload.single('file'), validate(createReportSchema), projectController.createReport);

// ======== Members & Join Actions (Tab 4) ========

router.get('/:id/members', projectController.listMembers);
router.post('/:id/members', validate(addMemberSchema), projectController.addMember);
router.delete('/:id/members/:memberId', projectController.removeMember);
router.post('/:id/activate', validate(activateProjectSchema), projectController.activateProject);

// User chủ động thao tác với Dự án (Đã gom gọn vào đây)
router.post('/:id/join', projectController.joinProject);
router.post('/:id/reject', projectController.rejectProject);
router.post('/:id/accept-leader', projectController.acceptLeaderRole);
router.post('/:id/decline-leader', projectController.declineLeaderRole);

// ======== Milestones (Tab 5 - Master Plan) ========

router.get('/:id/milestones', projectController.listMilestones);
router.post('/:id/milestones', validate(createMilestoneSchema), projectController.createMilestone);
router.put('/:id/milestones/:milestoneId', validate(updateMilestoneSchema), projectController.updateMilestone);

// ======== Checklists (Tab 5 - Master Plan) ========
const checklistRoutes = require('./checklist.routes');
router.use('/:id/milestones/:milestoneId/checklists', checklistRoutes);

// ======== Git Repo (Tab 5 - truong_lab only) ========

router.get('/:id/git', checkRole(SYSTEM_ROLES.TRUONG_LAB), projectController.getGitRepo);
router.put(
  '/:id/git',
  checkRole(SYSTEM_ROLES.TRUONG_LAB),
  validate(updateGitRepoSchema),
  projectController.updateGitRepo,
);

module.exports = router;