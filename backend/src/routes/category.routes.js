const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const checkActive = require('../middlewares/status.middleware');
const checkRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { SYSTEM_ROLES } = require('../config/constants');
const categoryController = require('../controllers/category.controller');
const { createCategorySchema, updateCategorySchema } = require('../validators/category.validator');

router.get('/', categoryController.list);
router.get('/:id', categoryController.getById);

router.post(
  '/',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  validate(createCategorySchema),
  categoryController.create,
);
router.put(
  '/:id',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  validate(updateCategorySchema),
  categoryController.update,
);
router.delete(
  '/:id',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  categoryController.remove,
);

module.exports = router;
