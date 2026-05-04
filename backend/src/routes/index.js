const router = require('express').Router();
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const projectRoutes = require('./project.routes');
const userRoutes = require('./user.routes');
const commitmentRoutes = require('./commitment.routes');
const rewardRoutes = require('./reward.routes');
const categoryRoutes = require('./category.routes');
const documentRoutes = require('./document.routes');
const curriculumRoutes = require('./curriculum.routes');
const verilogRoutes = require('./verilog.routes');
const forumRoutes = require('./forum.routes');
const aiAssistantRoutes = require('./aiAssistant.routes');
const commentRoutes = require('./comment.routes');
const memberDashboardRoutes = require('./memberDashboard.routes');
const tutorialRoutes = require('./tutorial.routes');
const searchRoutes = require('./search.routes');

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/projects', projectRoutes);
router.use('/users', userRoutes);
router.use('/commitments', commitmentRoutes);
router.use('/rewards', rewardRoutes);
router.use('/categories', categoryRoutes);
router.use('/documents', documentRoutes);
router.use('/curriculum', curriculumRoutes);
router.use('/verilog', verilogRoutes);
router.use('/forum', forumRoutes);
router.use('/ai', aiAssistantRoutes);
router.use('/members', memberDashboardRoutes);
router.use('/tutorial', tutorialRoutes);
router.use('/search', searchRoutes);

// Weekly report comments: GET|POST /:weeklyReportId/comments, PUT|DELETE /comments/:commentId
router.use('/', commentRoutes);

module.exports = router;