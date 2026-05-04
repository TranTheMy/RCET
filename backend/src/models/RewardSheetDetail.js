const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RewardSheetDetail = sequelize.define('RewardSheetDetail', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sheet_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'RewardSheets',
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  model_type: {
    type: DataTypes.TINYINT,
    allowNull: true,
  },
  base_share: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  },
  model_cut_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  },
  report_grade: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  grade_multiplier: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 1.00,
  },
  late_task_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  penalty_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  },
  calculated_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  },
  final_override_amount: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: true,
  },
  is_overridden: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  appeal_status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'NONE',
  },
  appeal_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  penalty_metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'RewardSheetDetails',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = RewardSheetDetail;