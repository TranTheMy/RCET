const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('./logger');

/**
 * Bảng Projects có thể tạo trước khi model có cột created_by.
 * sequelize.sync() không ALTER thêm cột mới → bổ sung khi thiếu (MSSQL).
 */
async function ensureProjectsSchema() {
  if (sequelize.getDialect() !== 'mssql') return;

  try {
    const tables = await sequelize.query(
      `SELECT t.name AS name FROM sys.tables t
       INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = N'dbo' AND t.name = N'Projects'`,
      { type: QueryTypes.SELECT },
    );
    if (!tables.length) {
      logger.debug('Projects: table not present yet (sync will create).');
      return;
    }

    const addCol = async (colName, ddl) => {
      try {
        await sequelize.query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE s.name = N'dbo' AND t.name = N'Projects' AND c.name = N'${colName.replace(/'/g, "''")}'
          )
          BEGIN
            ALTER TABLE [dbo].[Projects] ADD ${ddl};
          END
        `);
      } catch (e) {
        logger.error(`ensureProjectsSchema: ALTER ADD [${colName}] — ${e.message}`);
      }
    };

    await addCol('created_by', '[created_by] UNIQUEIDENTIFIER NULL');

    logger.info('Projects schema: migration pass OK (created_by)');
  } catch (err) {
    logger.error('ensureProjectsSchema:', err?.parent?.message || err?.message || err);
  }
}

module.exports = { ensureProjectsSchema };
