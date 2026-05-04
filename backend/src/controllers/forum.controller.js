const { ForumPost, ForumComment, ForumLike, User } = require('../models');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const notificationService = require('../services/notification.service');
const forumModeration = require('../services/forumModeration.service');

function truncateForumTitle(title, max = 80) {
  const s = String(title || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function sendForumModerationError(res, error) {
  if (error?.status === 422) {
    return ApiResponse.error(res, error.message || 'Nội dung không phù hợp quy định diễn đàn.', 422);
  }
  if (error?.status === 503) {
    return ApiResponse.error(
      res,
      error.message || 'Dịch vụ kiểm duyệt tạm thời không khả dụng.',
      503,
    );
  }
  return null;
}

// List forum posts with pagination and optional author filter
const listPosts = async (req, res) => {
  try {
    const { user_id, page, limit } = req.query;
    const pageNumber = page ? parseInt(page, 10) : 1;
    const pageSize = limit ? parseInt(limit, 10) : 20;

    const where = {};
    if (user_id) where.user_id = user_id;

    const posts = await ForumPost.findAndCountAll({
      where,
      include: [
        { model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'system_role', 'avatar'] },
        { model: ForumLike, as: 'likes', attributes: ['id'] },
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (pageNumber - 1) * pageSize,
    });

    const formatted = posts.rows.map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      user_id: post.user_id,
      author: post.author,
      likes_count: post.likes.length,
      created_at: post.created_at,
      updated_at: post.updated_at,
    }));

    return ApiResponse.success(res, {
      posts: formatted,
      pagination: {
        total: posts.count,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(posts.count / pageSize),
      },
    });
  } catch (error) {
    logger.error('listPosts error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await ForumPost.findByPk(postId, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'system_role', 'avatar'] },
        {
          model: ForumComment,
          as: 'comments',
          include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'system_role', 'avatar'] }],
          order: [['created_at', 'ASC']],
        },
        { model: ForumLike, as: 'likes', attributes: ['id', 'user_id'] },
      ],
    });

    if (!post) {
      return ApiResponse.notFound(res, 'Forum post not found');
    }

    return ApiResponse.success(res, {
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author,
      comments: post.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        author: comment.author,
        user_id: comment.user_id,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
      })),
      likes_count: post.likes.length,
      liked_by: post.likes.map((like) => like.user_id),
      created_at: post.created_at,
      updated_at: post.updated_at,
    });
  } catch (error) {
    logger.error('getPostById error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const createPost = async (req, res) => {
  try {
    const { title, content } = req.body;
    const userId = req.user.id;

    await forumModeration.assertAllowedPost(title.trim(), content.trim());

    const post = await ForumPost.create({ title: title.trim(), content: content.trim(), user_id: userId });

    return ApiResponse.created(res, post, 'Forum post created successfully');
  } catch (error) {
    const mod = sendForumModerationError(res, error);
    if (mod) return mod;
    logger.error('createPost error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    const post = await ForumPost.findByPk(postId);
    if (!post) {
      return ApiResponse.notFound(res, 'Forum post not found');
    }

    if (post.user_id !== userId) {
      return ApiResponse.forbidden(res, 'Not allowed to edit this post');
    }

    const nextTitle = title != null ? title.trim() : post.title;
    const nextContent = content != null ? content.trim() : post.content;
    await forumModeration.assertAllowedPost(nextTitle, nextContent);

    await post.update({
      title: nextTitle,
      content: nextContent,
    });

    return ApiResponse.success(res, post, 'Forum post updated successfully');
  } catch (error) {
    const mod = sendForumModerationError(res, error);
    if (mod) return mod;
    logger.error('updatePost error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await ForumPost.findByPk(postId);
    if (!post) {
      return ApiResponse.notFound(res, 'Forum post not found');
    }

    if (post.user_id !== userId) {
      return ApiResponse.forbidden(res, 'Not allowed to delete this post');
    }

    await post.destroy();
    return ApiResponse.success(res, null, 'Forum post deleted successfully');
  } catch (error) {
    logger.error('deletePost error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const post = await ForumPost.findByPk(postId);
    if (!post) {
      return ApiResponse.notFound(res, 'Forum post not found');
    }

    await forumModeration.assertAllowedComment(content.trim());

    const comment = await ForumComment.create({ post_id: postId, user_id: userId, content: content.trim() });

    try {
      const rows = await ForumComment.findAll({
        where: { post_id: postId },
        attributes: ['user_id'],
      });
      const recipients = new Set(
        [post.user_id, ...rows.map((r) => r.user_id)].filter(Boolean),
      );
      recipients.delete(userId);

      if (recipients.size > 0) {
        const actor = await User.findByPk(userId, { attributes: ['full_name'] });
        const actorName = (actor?.full_name && String(actor.full_name).trim()) || 'Một thành viên';
        const shortTitle = truncateForumTitle(post.title);
        for (const uid of recipients) {
          await notificationService.createAndPushNotification({
            userId: uid,
            title: 'Diễn đàn: bình luận mới',
            message: `${actorName} đã bình luận bài đăng "${shortTitle}".`,
            type: 'info',
            actionUrl: `/publication/forums#${postId}`,
            metadata: { kind: 'forum_comment', postId, commentId: comment.id, fromUserId: userId },
          });
        }
      }
    } catch (e) {
      logger.error('forum comment notification:', e);
    }

    return ApiResponse.created(res, comment, 'Comment added successfully');
  } catch (error) {
    const mod = sendForumModerationError(res, error);
    if (mod) return mod;
    logger.error('addComment error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await ForumComment.findByPk(commentId);
    if (!comment) {
      return ApiResponse.notFound(res, 'Comment not found');
    }

    if (comment.user_id !== userId) {
      return ApiResponse.forbidden(res, 'Not allowed to edit this comment');
    }

    await forumModeration.assertAllowedComment(content.trim());

    await comment.update({ content: content.trim() });
    return ApiResponse.success(res, comment, 'Comment updated successfully');
  } catch (error) {
    const mod = sendForumModerationError(res, error);
    if (mod) return mod;
    logger.error('updateComment error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await ForumComment.findByPk(commentId);
    if (!comment) {
      return ApiResponse.notFound(res, 'Comment not found');
    }

    if (comment.user_id !== userId) {
      return ApiResponse.forbidden(res, 'Not allowed to delete this comment');
    }

    await comment.destroy();
    return ApiResponse.success(res, null, 'Comment deleted successfully');
  } catch (error) {
    logger.error('deleteComment error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await ForumPost.findByPk(postId);
    if (!post) {
      return ApiResponse.notFound(res, 'Forum post not found');
    }

    const existing = await ForumLike.findOne({ where: { post_id: postId, user_id: userId } });
    if (existing) {
      return ApiResponse.conflict(res, 'Already liked this post');
    }

    const like = await ForumLike.create({ post_id: postId, user_id: userId });

    if (post.user_id !== userId) {
      try {
        const actor = await User.findByPk(userId, { attributes: ['full_name'] });
        const actorName = (actor?.full_name && String(actor.full_name).trim()) || 'Một thành viên';
        const shortTitle = truncateForumTitle(post.title);
        await notificationService.createAndPushNotification({
          userId: post.user_id,
          title: 'Diễn đàn: tim mới',
          message: `${actorName} đã thả tim bài đăng "${shortTitle}".`,
          type: 'info',
          actionUrl: `/publication/forums#${postId}`,
          metadata: { kind: 'forum_like', postId, fromUserId: userId },
        });
      } catch (e) {
        logger.error('forum like notification:', e);
      }
    }

    return ApiResponse.created(res, like, 'Post liked successfully');
  } catch (error) {
    logger.error('likePost error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

const unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const like = await ForumLike.findOne({ where: { post_id: postId, user_id: userId } });
    if (!like) {
      return ApiResponse.notFound(res, 'Like not found');
    }

    await like.destroy();
    return ApiResponse.success(res, null, 'Like removed successfully');
  } catch (error) {
    logger.error('unlikePost error:', error);
    return ApiResponse.error(res, 'Internal server error', 500);
  }
};

module.exports = {
  listPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  addComment,
  updateComment,
  deleteComment,
  likePost,
  unlikePost,
};
