const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerilogSubmission = sequelize.define('VerilogSubmission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  problem_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  code: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'verilog',
    validate: { isIn: [['verilog', 'systemverilog']] },
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'PENDING',
    validate: { isIn: [['PENDING', 'JUDGING', 'DONE', 'ERROR']] },
  },
  total_grade: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  max_grade: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  passed_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  total_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  overall_failure: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'NA',
    validate: { isIn: [['CE', 'RLE', 'TLE', 'WA', 'NONE', 'NA']] },
  },
  judge_log: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  judge_method: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'verilog_submissions',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = VerilogSubmission;
