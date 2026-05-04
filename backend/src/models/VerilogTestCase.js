const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerilogTestCase = sequelize.define('VerilogTestCase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  problem_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'SIM',
    validate: { isIn: [['SIM', 'SYNTHSIM']] },
  },
  grade: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  input: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expected_output: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  testbench_code: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expected_vcd: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  time_limit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
  },
  mem_limit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 128,
  },
  order_index: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  /** Matches VKSLAB_SUBTESTS_JSON id — enables single-run multi-subtest grading */
  subtest_key: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  /** Created/updated by POST .../sync-subtests-from-testbench */
  synced_from_tb: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'verilog_test_cases',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = VerilogTestCase;
