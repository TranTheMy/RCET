const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { APPROVAL_STATUS, APPROVAL_STATUS_VALUES } = require('../config/constants');

const ApprovalRequest = sequelize.define('ApprovalRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: APPROVAL_STATUS.PENDING,
    validate: {
      isIn: [APPROVAL_STATUS_VALUES],
    },
  },
  reviewed_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  review_note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'ApprovalRequests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ApprovalRequest;
