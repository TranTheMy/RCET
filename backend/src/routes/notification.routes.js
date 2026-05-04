const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/notification.controller');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

router.use(authMiddleware);
router.use(forbidBasicUser);

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
