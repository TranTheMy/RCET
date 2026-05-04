const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const forumController = require('../controllers/forum.controller');
const {
  createPostSchema,
  updatePostSchema,
  createCommentSchema,
  updateCommentSchema,
} = require('../validators/forum.validator');
const forbidBasicUser = require('../middlewares/forbidBasicUser.middleware');

router.use(auth);
router.use(forbidBasicUser);

// Forum posts
router.get('/posts', forumController.listPosts);
router.get('/posts/:postId', forumController.getPostById);
router.post('/posts', validate(createPostSchema), forumController.createPost);
router.put('/posts/:postId', validate(updatePostSchema), forumController.updatePost);
router.delete('/posts/:postId', forumController.deletePost);

// Comments on forum posts
router.post('/posts/:postId/comments', validate(createCommentSchema), forumController.addComment);
router.put('/comments/:commentId', validate(updateCommentSchema), forumController.updateComment);
router.delete('/comments/:commentId', forumController.deleteComment);

// Likes on forum posts
router.post('/posts/:postId/likes', forumController.likePost);
router.delete('/posts/:postId/likes', forumController.unlikePost);

module.exports = router;
