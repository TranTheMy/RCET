const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ForumLike = sequelize.define('ForumLike', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  post_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ForumPosts',
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
}, {
  tableName: 'ForumLikes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['post_id', 'user_id'],
      name: 'UQ_ForumLike_PostUser',
    },
  ],
});

module.exports = ForumLike;
