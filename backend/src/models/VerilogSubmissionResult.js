const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerilogSubmissionResult = sequelize.define('VerilogSubmissionResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  submission_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  testcase_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'PENDING',
    validate: { isIn: [['PENDING', 'JUDGING', 'DONE', 'ERROR']] },
  },
  possible_failure: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'NA',
    validate: { isIn: [['CE', 'RLE', 'TLE', 'WA', 'NONE', 'NA']] },
  },
  grade: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  log: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  app_data: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('app_data');
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    },
    set(val) {
      this.setDataValue('app_data', typeof val === 'string' ? val : JSON.stringify(val));
    },
  },
}, {
  tableName: 'verilog_submission_results',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['submission_id', 'testcase_id'] },
  ],
});

module.exports = VerilogSubmissionResult;
