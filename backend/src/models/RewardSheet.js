const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RewardSheet = sequelize.define('RewardSheet', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4, // Vẫn dùng UUIDV4 để tự sinh chuỗi 36 ký tự
    primaryKey: true,
  },
  project_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'Projects',
      key: 'id',
    },
  },
  total_budget: {
    type: DataTypes.DECIMAL(18, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'DRAFT',
  },
  generated_by: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  finalized_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  finalized_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'RewardSheets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['project_id'],
      name: 'UQ_RewardSheet_Project',
    },
  ],
});

module.exports = RewardSheet;