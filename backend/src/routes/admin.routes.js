const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { approveSchema, rejectSchema } = require('../validators/admin.validator');
const { SYSTEM_ROLES } = require('../config/constants');

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(checkRole(SYSTEM_ROLES.ADMIN));

router.get('/approval-requests', adminController.getApprovalRequests);
router.post('/approval/:id/approve', validate(approveSchema), adminController.approveUser);
router.post('/approval/:id/reject', validate(rejectSchema), adminController.rejectUser);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/ban', adminController.banUser);
router.patch('/users/:id/unban', adminController.unbanUser);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
