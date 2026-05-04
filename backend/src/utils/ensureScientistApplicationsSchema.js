const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('./logger');

/**
 * Bảng ScientistApplications có thể tạo từ bản model cũ, thiếu cột hợp đồng / duyệt.
 * Sequelize sync() không ALTER thêm cột → bổ sung thủ công (MSSQL).
 */
async function ensureScientistApplicationsSchema() {
  if (sequelize.getDialect() !== 'mssql') return;

  try {
    const tables = await sequelize.query(
      `SELECT t.name AS name FROM sys.tables t
       INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = N'dbo' AND t.name = N'ScientistApplications'`,
      { type: QueryTypes.SELECT },
    );
    if (!tables.length) {
      logger.debug('ScientistApplications: table not present yet (sync will create).');
      return;
    }

    const existingCols = await sequelize.query(
      `SELECT c.name AS name FROM sys.columns c
       INNER JOIN sys.tables t ON c.object_id = t.object_id
       INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = N'dbo' AND t.name = N'ScientistApplications'`,
      { type: QueryTypes.SELECT },
    );
    const colSet = new Set(existingCols.map((r) => r.name));
    const required = ['id', 'user_id', 'full_name', 'email', 'position', 'status', 'created_at', 'updated_at'];
    const missingBase = required.filter((c) => !colSet.has(c));
    if (missingBase.length) {
      logger.error(
        `ScientistApplications: thiếu cột bắt buộc (${missingBase.join(', ')}). Bảng có thể tạo sai thủ công. ` +
          'Trên SQL Server chạy: DROP TABLE [dbo].[ScientistApplications]; sau đó khởi động lại backend (sequelize.sync sẽ tạo lại bảng đúng).',
      );
      return;
    }

    const addCol = async (colName, ddl) => {
      try {
        await sequelize.query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE s.name = N'dbo' AND t.name = N'ScientistApplications' AND c.name = N'${colName.replace(/'/g, "''")}'
          )
          BEGIN
            ALTER TABLE [dbo].[ScientistApplications] ADD ${ddl};
          END
        `);
      } catch (e) {
        logger.error(`ensureScientistApplicationsSchema: ALTER ADD [${colName}] — ${e.message}`);
      }
    };

    await addCol('portfolio_url', '[portfolio_url] NVARCHAR(2000) NULL');
    await addCol('cover_letter', '[cover_letter] NVARCHAR(MAX) NULL');
    await addCol('file_url', '[file_url] NVARCHAR(2000) NULL');
    await addCol('lab_reviewed_by', '[lab_reviewed_by] UNIQUEIDENTIFIER NULL');
    await addCol('lab_comment', '[lab_comment] NVARCHAR(MAX) NULL');
    await addCol('lab_reviewed_at', '[lab_reviewed_at] DATETIME2 NULL');
    await addCol('director_reviewed_by', '[director_reviewed_by] UNIQUEIDENTIFIER NULL');
    await addCol('director_comment', '[director_comment] NVARCHAR(MAX) NULL');
    await addCol('director_reviewed_at', '[director_reviewed_at] DATETIME2 NULL');
    await addCol('contract_summary', '[contract_summary] NVARCHAR(MAX) NULL');
    await addCol('contract_file_url', '[contract_file_url] NVARCHAR(2000) NULL');
    await addCol('contract_created_at', '[contract_created_at] DATETIME2 NULL');
    await addCol('contract_created_by', '[contract_created_by] UNIQUEIDENTIFIER NULL');
    await addCol('contract_confirmed_at', '[contract_confirmed_at] DATETIME2 NULL');
    await addCol('contract_confirmed_by', '[contract_confirmed_by] UNIQUEIDENTIFIER NULL');

    logger.info('ScientistApplications schema: migration pass OK');
  } catch (err) {
    logger.error('ensureScientistApplicationsSchema:', err?.parent?.message || err?.message || err);
  }
}

module.exports = { ensureScientistApplicationsSchema };
