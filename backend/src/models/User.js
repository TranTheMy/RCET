const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SYSTEM_ROLE_VALUES, USER_STATUS_VALUES, USER_STATUS } = require('../config/constants');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  student_code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  system_role: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isIn: [SYSTEM_ROLE_VALUES],
    },
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: USER_STATUS.PENDING,
    validate: {
      isIn: [USER_STATUS_VALUES],
    },
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  email_verify_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refresh_token: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  /** URL đầy đủ tới ảnh (hiển thị từ frontend khác port) */
  avatar: {
    type: DataTypes.STRING(2000),
    allowNull: true,
  },
}, {
  tableName: 'Users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['email'],
      name: 'UQ_User_Email',
    },
  ],
});

module.exports = User;
