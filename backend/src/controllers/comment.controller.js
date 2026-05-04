const { Comment, WeeklyReport, User, ProjectMember, Project } = require('../models');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const realtimeService = require('../services/realtime.service');
const notificationService = require('../services/notification.service');

// Get all comments for a weekly report
const getComments = async (req, res) => {
  try {
    const { weeklyReportId } = req.params;
    const userId = req.user.id;

    // Check if weekly report exists
    const weeklyReport = await WeeklyReport.findByPk(weeklyReportId);

    if (!weeklyReport) {
      return ApiResponse.error(res, 'Weekly report not found', 404);
    }

    // Check if user is member of the project
    const isMember = await ProjectMember.findOne({
      where: { project_id: weeklyReport.project_id, user_id: userId }
    });

    if (!isMember) {
      return ApiResponse.error(res, 'Access denied', 403);
    }

    const comments = await Comment.findAll({
      where: { weekly_report_id: weeklyReportId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email']
      }],
      order: [['created_at', 'ASC']]
    });

    ApiResponse.success(res, comments, 'Comments retrieved successfully');
  } catch (error) {
    logger.error('Error getting comments:', error);
    ApiResponse.error(res, 'Internal server error', 500);
  }
};

// Create a new comment
const createComment = async (req, res) => {
  try {
    const { weeklyReportId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return ApiResponse.error(res, 'Comment content is required', 400);
    }

    // Check if weekly report exists and user has access
    const weeklyReport = await WeeklyReport.findByPk(weeklyReportId);
    if (!weeklyReport) {
      return ApiResponse.error(res, 'Weekly report not found', 404);
    }

    // Check if user is member of the project
    const isMember = await ProjectMember.findOne({
      where: { project_id: weeklyReport.project_id, user_id: userId }
    });

    if (!isMember) {
      return ApiResponse.error(res, 'Access denied', 403);
    }

    const comment = await Comment.create({
      weekly_report_id: weeklyReportId,
      user_id: userId,
      content: content.trim()
    });

    // Fetch the created comment with user info
    const commentWithUser = await Comment.findByPk(comment.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'avatar']
      }]
    });

    realtimeService.broadcastProjectUpdate(weeklyReport.project_id, 'report_comment_created', {
      weeklyReportId,
      comment: commentWithUser,
    }, userId);

    try {
      const [project, commentRows, actor] = await Promise.all([
        Project.findByPk(weeklyReport.project_id, { attributes: ['id', 'name'] }),
        Comment.findAll({
          where: { weekly_report_id: weeklyReportId },
          attributes: ['user_id'],
        }),
        User.findByPk(userId, { attributes: ['full_name'] }),
      ]);
      const actorName = (actor?.full_name && String(actor.full_name).trim()) || 'Một thành viên';
      const projectName = (project?.name && String(project.name).trim()) || 'Dự án';
      const recipients = new Set(
        [weeklyReport.user_id, ...commentRows.map((c) => c.user_id)].filter(Boolean),
      );
      recipients.delete(userId);
      const preview =
        content.trim().length > 120 ? `${content.trim().slice(0, 120)}…` : content.trim();
      for (const uid of recipients) {
        await notificationService.createAndPushNotification({
          userId: uid,
          title: 'Dự án: bình luận báo cáo tuần',
          message: `${actorName} đã bình luận trong "${projectName}": ${preview}`,
          type: 'info',
          actionUrl: `/projects/${weeklyReport.project_id}`,
          metadata: {
            kind: 'weekly_report_comment',
            projectId: weeklyReport.project_id,
            weeklyReportId,
            commentId: comment.id,
            fromUserId: userId,
          },
        });
      }
    } catch (e) {
      logger.error('weekly report comment notification:', e);
    }

    ApiResponse.created(res, commentWithUser, 'Comment created successfully');
  } catch (error) {
    logger.error('Error creating comment:', error);
    ApiResponse.error(res, 'Internal server error', 500);
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return ApiResponse.error(res, 'Comment content is required', 400);
    }

    const comment = await Comment.findByPk(commentId, {
      include: [{ model: WeeklyReport, as: 'weeklyReport' }]
    });

    if (!comment) {
      return ApiResponse.error(res, 'Comment not found', 404);
    }

    // Only comment author can update
    if (comment.user_id !== userId) {
      return ApiResponse.error(res, 'Access denied', 403);
    }

    await comment.update({ content: content.trim() });

    // Fetch updated comment with user info
    const updatedComment = await Comment.findByPk(commentId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'avatar']
      }]
    });

    realtimeService.broadcastProjectUpdate(comment.weeklyReport.project_id, 'report_comment_updated', {
      weeklyReportId: comment.weekly_report_id,
      comment: updatedComment,
    }, userId);

    ApiResponse.success(res, updatedComment, 'Comment updated successfully');
  } catch (error) {
    logger.error('Error updating comment:', error);
    ApiResponse.error(res, 'Internal server error', 500);
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findByPk(commentId, {
      include: [{ model: WeeklyReport, as: 'weeklyReport' }]
    });

    if (!comment) {
      return ApiResponse.error(res, 'Comment not found', 404);
    }

    // Only comment author can delete
    if (comment.user_id !== userId) {
      return ApiResponse.error(res, 'Access denied', 403);
    }

    const projectId = comment.weeklyReport.project_id;
    const weeklyReportId = comment.weekly_report_id;
    await comment.destroy();

    realtimeService.broadcastProjectUpdate(projectId, 'report_comment_deleted', {
      weeklyReportId,
      commentId,
    }, userId);

    ApiResponse.success(res, null, 'Comment deleted successfully');
  } catch (error) {
    logger.error('Error deleting comment:', error);
    ApiResponse.error(res, 'Internal server error', 500);
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
};