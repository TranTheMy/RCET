const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');

class RealtimeService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  /**
   * Initialize WebSocket server
   */
  init(io) {
    this.io = io;

    io.use(this.authenticateSocket.bind(this));

    io.on('connection', (socket) => {
      const userId = socket.userId;
      const userRole = socket.userRole;

      logger.info(`User ${userId} (${userRole}) connected via WebSocket`);

      // Store connection
      this.connectedUsers.set(userId, socket.id);

      // Join user-specific room
      socket.join(`user_${userId}`);

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected from WebSocket`);
        this.connectedUsers.delete(userId);
      });

      // Handle dashboard subscription
      socket.on('subscribe_dashboard', () => {
        socket.join(`dashboard_${userId}`);
        logger.debug(`User ${userId} subscribed to dashboard updates`);
      });

      // Handle project room subscription
      socket.on('subscribe_project', (projectId) => {
        socket.join(`project_${projectId}`);
        logger.debug(`User ${userId} subscribed to project ${projectId}`);
      });
    });
  }

  /**
   * Authenticate WebSocket connection using JWT
   */
  authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, env.jwt.accessSecret);

      // Attach user info to socket (JWT payload uses user_id)
      socket.userId = decoded.user_id || decoded.id;
      socket.userRole = decoded.system_role || decoded.role;

      next();
    } catch (error) {
      logger.warn('WebSocket authentication failed:', error.message);
      next(new Error('Authentication failed'));
    }
  }

  /**
   * Broadcast dashboard update to specific user
   */
  broadcastDashboardUpdate(userId, updateType, data) {
    if (!this.io) return;

    const eventData = {
      type: updateType,
      data: data,
      timestamp: new Date().toISOString()
    };

    // Send to user's dashboard room
    this.io.to(`dashboard_${userId}`).emit('dashboard_update', eventData);

    logger.debug(`Broadcasted ${updateType} update to user ${userId}`);
  }

  /**
   * Broadcast project update to all project members
   */
  broadcastProjectUpdate(projectId, updateType, data, excludeUserId = null) {
    if (!this.io) return;

    const eventData = {
      type: updateType,
      data: data,
      timestamp: new Date().toISOString(),
      projectId: projectId
    };

    // Send to project room (all members)
    this.io.to(`project_${projectId}`).emit('project_update', eventData);

    logger.debug(`Broadcasted ${updateType} update to project ${projectId}`);
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId, notification) {
    if (!this.io) return;

    const notificationData = {
      id: Date.now(),
      ...notification,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user_${userId}`).emit('notification', notificationData);

    logger.debug(`Sent notification to user ${userId}: ${notification.title}`);
  }

  /**
   * Check if user is currently connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Broadcast system-wide announcement
   */
  broadcastAnnouncement(message, level = 'info') {
    if (!this.io) return;

    const announcement = {
      message,
      level, // info, warning, error, success
      timestamp: new Date().toISOString()
    };

    this.io.emit('announcement', announcement);

    logger.info(`Broadcasted system announcement: ${message}`);
  }

  /**
   * Broadcast projects list update (global)
   */
  broadcastProjectsUpdate(updateType, data = {}) {
    if (!this.io) return;
    const eventData = {
      type: updateType,
      data,
      timestamp: new Date().toISOString(),
    };
    this.io.emit('projects_update', eventData);
    logger.debug(`Broadcasted projects_update: ${updateType}`);
  }

  /** Danh sách hồ sơ nhà khoa học / hợp đồng thay đổi — FE refetch listForReview */
  broadcastScientistApplicationListChanged() {
    if (!this.io) return;
    this.io.emit('scientist-application:list-changed', { timestamp: new Date().toISOString() });
    logger.debug('Emitted scientist-application:list-changed');
  }

  emitDocumentStatusChanged(payload) {
    if (!this.io) return;
    this.io.emit('document:status-changed', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted document:status-changed');
  }

  emitDocumentPendingSubmitted(payload) {
    if (!this.io) return;
    this.io.emit('document:pending-submitted', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted document:pending-submitted');
  }

  emitCurriculumStatusUpdated(payload) {
    if (!this.io) return;
    this.io.emit('curriculum:status-updated', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted curriculum:status-updated');
  }

  emitCurriculumPendingSubmitted(payload) {
    if (!this.io) return;
    this.io.emit('curriculum:pending-submitted', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted curriculum:pending-submitted');
  }

  emitMemberDashboardTaskCompleted(userId, payload) {
    if (!this.io) return;
    const data = { ...payload, timestamp: new Date().toISOString() };
    this.io.to(`user_${userId}`).emit('member-dashboard:task-completed', data);
    this.io.to(`dashboard_${userId}`).emit('member-dashboard:task-completed', data);
    logger.debug(`Emitted member-dashboard:task-completed for user ${userId}`);
  }

  emitDomainEventToUser(userId, eventName, payload = {}) {
    if (!this.io) return;
    const data = { ...payload, timestamp: new Date().toISOString() };
    this.io.to(`user_${userId}`).emit(eventName, data);
    logger.debug(`Emitted ${eventName} to user ${userId}`);
  }

  emitResearchPendingSubmitted(payload = {}) {
    if (!this.io) return;
    this.io.emit('research:pending-submitted', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted research:pending-submitted');
  }

  emitResearchStatusUpdated(payload = {}) {
    if (!this.io) return;
    this.io.emit('research:status-updated', { ...payload, timestamp: new Date().toISOString() });
    logger.debug('Emitted research:status-updated');
  }
}

module.exports = new RealtimeService();