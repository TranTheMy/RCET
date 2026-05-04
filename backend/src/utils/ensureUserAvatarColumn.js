const sequelize = require('../config/database');
const logger = require('./logger');

/**
 * Cột bổ sung trên Users (DB cũ có thể thiếu).
 */
async function ensureUserProfileColumns() {
  if (sequelize.getDialect() !== 'mssql') return;
  try {
    await sequelize.query(`
      IF COL_LENGTH(N'Users', N'avatar') IS NULL
      BEGIN
        ALTER TABLE [Users] ADD [avatar] NVARCHAR(2000) NULL;
      END
    `);
    await sequelize.query(`
      IF COL_LENGTH(N'Users', N'phone_number') IS NULL
      BEGIN
        ALTER TABLE [Users] ADD [phone_number] NVARCHAR(50) NULL;
      END
    `);
    await sequelize.query(`
      UPDATE [Users] SET [system_role] = N'user' WHERE [system_role] = N'guest';
    `);
    logger.info('Users schema: avatar, phone_number columns OK; guest→user role migrated if any');
  } catch (err) {
    logger.warn('ensureUserProfileColumns:', err.message);
  }
}

module.exports = { ensureUserProfileColumns, ensureUserAvatarColumn: ensureUserProfileColumns };
