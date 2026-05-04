/**
 * REST /api/documents
 * GET / — public (đã publish). Các route còn lại: auth + active.
 */
const router = require('express').Router();
const authMiddleware = require('../middlewares/auth.middleware');
const checkActive = require('../middlewares/status.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/researchUpload.middleware');
const documentController = require('../controllers/document.controller');
const { approveDocumentSchema, rejectDocumentSchema } = require('../validators/document.validator');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

/** Danh sách đã publish — public (khách xem Home / kho tài liệu) */
router.get('/', documentController.listPublic);

router.use(authMiddleware, checkActive, forbidBasicUser);
router.get('/mine', documentController.listMine);
router.get('/pending/list', documentController.listPending);
router.get('/history', documentController.history);

router.post('/', upload.single('file'), documentController.create);

router.get('/:id/download-url', documentController.getDownloadUrl);
router.get('/:id/preview', documentController.preview);

router.put('/:id', upload.single('file'), documentController.update);
router.delete('/:id', documentController.remove);
router.patch('/:id/restore', documentController.restore);

router.post('/:id/submit', documentController.submit);
router.patch('/:id/approve', validate(approveDocumentSchema), documentController.approve);
router.patch('/:id/reject', validate(rejectDocumentSchema), documentController.reject);
router.post('/:id/versions', upload.single('file'), documentController.createVersion);

router.get('/:id', documentController.getOne);

module.exports = router;