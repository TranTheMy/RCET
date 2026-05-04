const aiAssistantService = require('../services/aiAssistant.service');
const ApiResponse = require('../utils/response');

/**
 * POST /ai/chat — Chat with AI assistant
 */
const chat = async (req, res, next) => {
  try {
    const { message, conversation_history } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return ApiResponse.badRequest(res, 'Message is required');
    }
    if (message.length > 2000) {
      return ApiResponse.badRequest(res, 'Message too long (max 2000 characters)');
    }

    const history = Array.isArray(conversation_history) ? conversation_history : [];
    const result = await aiAssistantService.chat(req.user.id, message.trim(), history);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

/**
 * GET /ai/notifications/smart — Generate smart notifications
 */
const getSmartNotifications = async (req, res, next) => {
  try {
    const result = await aiAssistantService.getSmartNotifications(req.user.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

/**
 * GET /ai/notifications — Get stored notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, unread_only } = req.query;
    const result = await aiAssistantService.getNotifications(req.user.id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      unread_only: unread_only === 'true',
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

/**
 * PATCH /ai/notifications/:id/read — Mark notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    await aiAssistantService.markAsRead(req.user.id, req.params.id);
    return ApiResponse.success(res, null, 'Marked as read');
  } catch (error) {
    if (error.status) return ApiResponse.error(res, error.message, error.status);
    next(error);
  }
};

module.exports = {
  chat,
  getSmartNotifications,
  getNotifications,
  markAsRead,
};
