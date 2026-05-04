const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('./logger');

/**
 * Cột subtest_key / synced_from_tb: sequelize.sync() thường không ALTER bảng cũ (MSSQL).
 */
async function ensureVerilogTestCaseSubtestColumns() {
  if (sequelize.getDialect() !== 'mssql') return;

  try {
    const tables = await sequelize.query(
      `SELECT t.name AS name FROM sys.tables t
       INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
       WHERE s.name = N'dbo' AND t.name = N'verilog_test_cases'`,
      { type: QueryTypes.SELECT },
    );
    if (!tables.length) {
      logger.debug('verilog_test_cases: table not present yet.');
      return;
    }

    const addCol = async (colName, ddl) => {
      try {
        await sequelize.query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE s.name = N'dbo' AND t.name = N'verilog_test_cases' AND c.name = N'${colName.replace(/'/g, "''")}'
          )
          BEGIN
            ALTER TABLE [dbo].[verilog_test_cases] ADD ${ddl};
          END
        `);
      } catch (e) {
        logger.error(`ensureVerilogTestCaseSubtestColumns: ALTER ADD [${colName}] — ${e.message}`);
      }
    };

    await addCol('subtest_key', '[subtest_key] NVARCHAR(64) NULL');
    await addCol('synced_from_tb', '[synced_from_tb] BIT NOT NULL CONSTRAINT [DF_verilog_tc_synced_tb] DEFAULT ((0))');

    logger.info('verilog_test_cases schema: subtest_key / synced_from_tb OK');
  } catch (err) {
    logger.error('ensureVerilogTestCaseSubtestColumns:', err?.parent?.message || err?.message || err);
  }
}

module.exports = { ensureVerilogTestCaseSubtestColumns };
