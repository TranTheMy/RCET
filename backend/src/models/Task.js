const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { TASK_STATUS_VALUES, TASK_STATUS, TASK_PRIORITY_VALUES, TASK_PRIORITY } = require('../config/constants');

const Task = sequelize.define('Task', {
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
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: TASK_STATUS.TODO,
    validate: {
      isIn: [TASK_STATUS_VALUES],
    },
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: TASK_PRIORITY.MEDIUM,
    validate: {
      isIn: [TASK_PRIORITY_VALUES],
    },
  },
  assignee_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName: 'Tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Task;
