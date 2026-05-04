/**
 * Xóa bảng ScientistApplications sai schema — chạy một lần rồi khởi động lại API (sync tạo lại).
 * Usage: node scripts/drop-scientist-applications-table.js
 */
const sequelize = require('../src/config/database');

async function main() {
  await sequelize.authenticate();
  await sequelize.query(`
    IF OBJECT_ID(N'dbo.ScientistApplications', N'U') IS NOT NULL
      DROP TABLE [dbo].[ScientistApplications];
  `);
  console.log('Dropped dbo.ScientistApplications (if existed). Restart the API to recreate the table.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
