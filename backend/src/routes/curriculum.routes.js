/**
 * REST /api/curriculum — giáo trình (bảng Curriculums).
 * GET / — public (đã duyệt). Các route còn lại: auth + active.
 */
const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const checkActive = require('../middlewares/status.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/researchUpload.middleware');
const curriculumController = require('../controllers/curriculum.controller');
const { approveCurriculumSchema, rejectCurriculumSchema } = require('../validators/curriculum.validator');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

/** Danh sách đã duyệt — public (khách xem Home / kho giáo trình) */
router.get('/', curriculumController.listPublic);

router.use(authMiddleware, checkActive, forbidBasicUser);
router.get('/mine', curriculumController.listMine);
router.get('/pending/list', curriculumController.listPending);
router.get('/history', curriculumController.history);

router.post('/', upload.single('file'), curriculumController.create);

router.get('/:id/download-url', curriculumController.getDownloadUrl);
router.get('/:id/preview', curriculumController.preview);

router.put('/:id', upload.single('file'), curriculumController.update);
router.delete('/:id', curriculumController.remove);
router.patch('/:id/restore', curriculumController.restore);

router.post('/:id/submit', curriculumController.submit);
router.patch('/:id/approve', validate(approveCurriculumSchema), curriculumController.approve);
router.patch('/:id/reject', validate(rejectCurriculumSchema), curriculumController.reject);
router.post('/:id/versions', upload.single('file'), curriculumController.createVersion);

router.get('/:id', curriculumController.getOne);

module.exports = router;
