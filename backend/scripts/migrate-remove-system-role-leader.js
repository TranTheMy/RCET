/**
 * One-time: đổi system_role cũ `leader` → `member` (vai trò chủ trì dự án dùng ProjectMember + leader_id).
 *
 * Usage: node scripts/migrate-remove-system-role-leader.js
 */
require('dotenv').config();
const { User } = require('../src/models');
const sequelize = require('../src/config/database');

async function run() {
  const [n] = await User.update(
    { system_role: 'member' },
    { where: { system_role: 'leader' } },
  );
  console.log(`Updated ${n} user(s) from system_role 'leader' to 'member'.`);
  await sequelize.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
