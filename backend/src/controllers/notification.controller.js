const { Notification } = require('../models');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

function mapRowToFrontend(n) {
  const j = n.toJSON ? n.toJSON() : n;
  return {
    id: j.id,
    user_id: j.user_id,
    type: j.type,
    title: j.title,
    body: j.message ?? null,
    link: j.action_url ?? null,
    read_at: j.is_read ? (j.updated_at || j.created_at) : null,
    created_at: j.created_at,
    updated_at: j.updated_at,
  };
}

exports.getUnreadCount = async (req, res) => {
  try {
    const unread_count = await Notification.count({
      where: { user_id: req.user.id, is_read: false },
    });
    return ApiResponse.success(res, { unread_count });
  } catch (err) {
    logger.error('getUnreadCount:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const unreadOnly =
      req.query.unreadOnly === 'true' ||
      req.query.unread_only === 'true' ||
      req.query.unreadOnly === true;

    const where = { user_id: req.user.id };
    if (unreadOnly) where.is_read = false;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const items = rows.map(mapRowToFrontend);
    return ApiResponse.success(res, {
      items,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (err) {
    logger.error('notification list:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.markRead = async (req, res) => {
  try {
    const [affected] = await Notification.update(
      { is_read: true },
      { where: { id: req.params.id, user_id: req.user.id } },
    );
    if (!affected) return ApiResponse.notFound(res, 'Notification not found');
    const row = await Notification.findByPk(req.params.id);
    return ApiResponse.success(res, row ? mapRowToFrontend(row) : null, 'Marked as read');
  } catch (err) {
    logger.error('markRead notification:', err);
    return ApiResponse.error(res, err.message);
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const [updated] = await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } },
    );
    return ApiResponse.success(res, { updated: updated ?? 0 });
  } catch (err) {
    logger.error('markAllRead:', err);
    return ApiResponse.error(res, err.message);
  }
};
