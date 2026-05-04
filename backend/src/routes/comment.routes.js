const express = require('express');
const router = express.Router();
const commentController = require('../controllers/comment.controller');
const { createCommentSchema, updateCommentSchema } = require('../validators/comment.validator');
const validate = require('../middlewares/validate.middleware');
const auth = require('../middlewares/auth.middleware');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

// All routes require authentication
router.use(auth);
router.use(forbidBasicUser);

// Static segment first — tránh nhầm với :weeklyReportId
router.put('/comments/:commentId', validate(updateCommentSchema), commentController.updateComment);
router.delete('/comments/:commentId', commentController.deleteComment);

router.get('/:weeklyReportId/comments', commentController.getComments);
router.post('/:weeklyReportId/comments', validate(createCommentSchema), commentController.createComment);

module.exports = router;