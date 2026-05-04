const sequelize = require('../config/database');
const logger = require('./logger');

/**
 * Bảng Notifications có thể tồn tại từ phiên bản cũ thiếu cột (MSSQL).
 * Sequelize sync() mặc định không ALTER bảng có sẵn → thêm cột thủ công.
 */
async function ensureNotificationsSchema() {
  if (sequelize.getDialect() !== 'mssql') return;
  try {
    await sequelize.query(`
      IF COL_LENGTH(N'Notifications', N'is_read') IS NULL
      BEGIN
        ALTER TABLE [Notifications] ADD [is_read] BIT NOT NULL
          CONSTRAINT [DF_Notifications_is_read] DEFAULT ((0));
      END
    `);
    logger.info('Notifications schema: is_read column OK');
  } catch (err) {
    logger.warn('ensureNotificationsSchema:', err.message);
  }
}

module.exports = { ensureNotificationsSchema };
