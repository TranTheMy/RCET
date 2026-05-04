const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { REPORT_STATUS_VALUES, REPORT_STATUS } = require('../config/constants');

const WeeklyReport = sequelize.define('WeeklyReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  week_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: REPORT_STATUS.SUBMITTED,
    validate: {
      isIn: [REPORT_STATUS_VALUES],
    },
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'WeeklyReports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['project_id', 'user_id', 'week_number', 'year'],
      name: 'UQ_WeeklyReport',
    },
  ],
});

module.exports = WeeklyReport;
