const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { PROJECT_ROLE_VALUES, PROJECT_ROLES } = require('../config/constants');

const ProjectMember = sequelize.define('ProjectMember', {
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
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: PROJECT_ROLES.MEMBER,
    validate: {
      isIn: [PROJECT_ROLE_VALUES],
    },
  },
  joined_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'ProjectMembers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['project_id', 'user_id'],
      name: 'UQ_ProjectMember',
    },
  ],
});

module.exports = ProjectMember;
