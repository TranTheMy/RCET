const router = require('express').Router();
const directorController = require('../controllers/director.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateStaffRoleSchema } = require('../validators/director.validator');
const { SYSTEM_ROLES } = require('../config/constants');

router.use(authMiddleware);
router.use(checkRole(SYSTEM_ROLES.VIEN_TRUONG));

router.get('/lab-staff', directorController.listLabStaff);
router.patch('/lab-staff/:id/system-role', validate(updateStaffRoleSchema), directorController.updateLabStaffRole);

module.exports = router;
