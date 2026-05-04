const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const checkActive = require('../middlewares/status.middleware');
const checkRole = require('../middlewares/role.middleware');
const researchUpload = require('../middlewares/researchUpload.middleware');
const { SYSTEM_ROLES } = require('../config/constants');
const c = require('../controllers/scientistApplication.controller');

router.post(
  '/',
  authMiddleware,
  checkActive,
  researchUpload.single('file'),
  c.submit,
);

router.get('/check-phone', authMiddleware, checkActive, c.checkPhone);

router.get('/mine', authMiddleware, checkActive, c.listMine);
router.get('/for-review', authMiddleware, checkActive, checkRole(SYSTEM_ROLES.TRUONG_LAB, SYSTEM_ROLES.VIEN_TRUONG), c.listForReview);

router.patch(
  '/:id/lab-review',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.TRUONG_LAB),
  c.labReview,
);

router.patch(
  '/:id/director-review',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  c.directorReview,
);

router.post(
  '/:id/contract/generate',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  c.generateContract,
);

router.post(
  '/:id/contract/confirm',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  c.confirmContract,
);

router.post(
  '/:id/contract',
  authMiddleware,
  checkActive,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  researchUpload.single('file'),
  c.recordContract,
);

router.get('/:id', authMiddleware, checkActive, c.getOne);

module.exports = router;
