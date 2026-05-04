const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { COMMITMENT_STATUS, COMMITMENT_STATUS_VALUES } = require('../config/constants');

const Commitment = sequelize.define('Commitment', {
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
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: COMMITMENT_STATUS.PENDING_B_APPROVAL,
    validate: {
      isIn: [COMMITMENT_STATUS_VALUES],
    },
  },
  reject_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hardcopy_filed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'Commitments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['project_id', 'user_id'],
      name: 'UQ_Commitment_Project_User',
    },
  ],
});

Commitment.associate = (models) => {
  // Mối quan hệ với User (Bên B - Thành viên)
  Commitment.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user',
  });

  // Mối quan hệ với Project
  Commitment.belongsTo(models.Project, {
    foreignKey: 'project_id',
    as: 'project',
  });
};

module.exports = Commitment;