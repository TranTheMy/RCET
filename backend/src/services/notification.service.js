const { User, Notification } = require('../models');
const realtimeService = require('./realtime.service');
const { SYSTEM_ROLES } = require('../config/constants');

async function createAndPushNotification({
  userId,
  title,
  message,
  type = 'info',
  actionUrl = null,
  metadata = null,
  eventName = null,
  eventPayload = null,
}) {
  const row = await Notification.create({
    user_id: userId,
    title,
    message,
    type,
    action_url: actionUrl,
    metadata: metadata || null,
  });

  realtimeService.sendNotification(userId, {
    type: eventName || 'notification',
    title,
    message,
    data: {
      notificationId: row.id,
      ...(metadata || {}),
      ...(eventPayload || {}),
    },
  });

  if (eventName) {
    realtimeService.emitDomainEventToUser(userId, eventName, {
      notificationId: row.id,
      ...(eventPayload || {}),
    });
  }

  return row;
}

async function notifyInstituteManagers({
  title,
  message,
  actionUrl = null,
  metadata = null,
  eventName = null,
  eventPayload = null,
}) {
  const directors = await User.findAll({
    where: { system_role: SYSTEM_ROLES.VIEN_TRUONG, status: 'active' },
    attributes: ['id'],
  });

  for (const director of directors) {
    await createAndPushNotification({
      userId: director.id,
      title,
      message,
      type: 'alert',
      actionUrl,
      metadata,
      eventName,
      eventPayload,
    });
  }
}

async function notifyLabManagers({
  title,
  message,
  actionUrl = null,
  metadata = null,
  eventName = null,
  eventPayload = null,
}) {
  const labHeads = await User.findAll({
    where: { system_role: SYSTEM_ROLES.TRUONG_LAB, status: 'active' },
    attributes: ['id'],
  });

  for (const u of labHeads) {
    await createAndPushNotification({
      userId: u.id,
      title,
      message,
      type: 'alert',
      actionUrl,
      metadata,
      eventName,
      eventPayload,
    });
  }
}

module.exports = {
  createAndPushNotification,
  notifyInstituteManagers,
  notifyLabManagers,
};
