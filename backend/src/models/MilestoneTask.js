const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MilestoneTask = sequelize.define('MilestoneTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  milestone_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Milestones',
      key: 'id',
    },
  },
  task_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Tasks',
      key: 'id',
    },
  },
}, {
  tableName: 'MilestoneTasks',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['milestone_id', 'task_id'],
      name: 'UQ_MilestoneTask',
    },
  ],
});

module.exports = MilestoneTask;
