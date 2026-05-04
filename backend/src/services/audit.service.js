const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../models');
const logger = require('../utils/logger');

const log = async (action, performedBy, targetUserId = null, metadata = null) => {
  try {
    const id = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Use raw SQL to avoid Sequelize date issues
    await sequelize.query(
      `INSERT INTO [AuditLogs] ([id], [action], [performed_by], [target_user_id], [metadata_json], [created_at])
       VALUES (?, ?, ?, ?, ?, CONVERT(DATETIME, ?))`,
      {
        replacements: [
          id,
          action,
          performedBy,
          targetUserId || null,
          metadata ? JSON.stringify(metadata) : null,
          now,
        ],
      },
    );
  } catch (error) {
    logger.error(`Audit log failed: ${error.message}`);
  }
};

module.exports = { log };
