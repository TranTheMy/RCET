/**
 * REST /api/research — logic trong research.service.js (store in-memory + Cloudinary).
 */
const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const checkActive = require('../middlewares/status.middleware');
const checkRole = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const { SYSTEM_ROLES } = require('../config/constants');
const researchUpload = require('../middlewares/researchUpload.middleware');
const researchController = require('../controllers/research.controller');
const { approveResearchSchema, rejectResearchSchema } = require('../validators/research.validator');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

router.get('/public', researchController.listPublic);
router.get('/public/facets/tags', researchController.publicTagFacets);
router.get('/public/:id/preview', researchController.previewPublic);
router.get('/public/:id', researchController.getPublicById);

router.get('/internal', authMiddleware, checkActive, forbidBasicUser, researchController.listInternal);
router.get('/internal/facets/tags', authMiddleware, checkActive, forbidBasicUser, researchController.internalTagFacets);
router.get('/mine', authMiddleware, checkActive, forbidBasicUser, researchController.listMine);

router.post(
  '/',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  researchUpload.single('file'),
  researchController.submit,
);

router.get(
  '/pending',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  researchController.listPending,
);
router.get(
  '/withdrawn',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  researchController.listWithdrawn,
);
router.patch(
  '/:id/approve',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  validate(approveResearchSchema),
  researchController.approve,
);
router.patch(
  '/:id/reject',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  checkRole(SYSTEM_ROLES.VIEN_TRUONG),
  validate(rejectResearchSchema),
  researchController.reject,
);

router.delete(
  '/:id',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  researchController.remove,
);
router.patch(
  '/:id/restore',
  authMiddleware,
  checkActive,
  forbidBasicUser,
  researchController.restore,
);

router.get('/:id/preview', authMiddleware, checkActive, forbidBasicUser, researchController.previewAuth);
router.get('/:id', authMiddleware, checkActive, forbidBasicUser, researchController.getById);

module.exports = router;
