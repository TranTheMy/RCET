const router = require('express').Router();
const aiController = require('../controllers/aiAssistant.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

// All AI routes require authentication
router.use(authMiddleware);
router.use(forbidBasicUser);

// Chat with AI assistant
router.post('/chat', aiController.chat);

// Smart notifications (generated on-the-fly)
router.get('/notifications/smart', aiController.getSmartNotifications);

// Stored notifications
router.get('/notifications', aiController.getNotifications);

// Mark as read (use "all" as id to mark all)
router.patch('/notifications/:id/read', aiController.markAsRead);

module.exports = router;
