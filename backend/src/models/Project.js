const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const {
  PROJECT_STATUS_VALUES, PROJECT_STATUS,
  COMMITMENT_MODEL_TYPE_VALUES,
} = require('../config/constants');

const Project = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tag: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: PROJECT_STATUS.PLANNING,
    validate: {
      isIn: [PROJECT_STATUS_VALUES],
    },
  },
  leader_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  party_a_id: {
    type: DataTypes.UUID,
    allowNull: true, // Có thể để true lúc khởi tạo, tùy thuộc vào logic bắt buộc hay không của bạn
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  /** Người tạo bản ghi dự án (thường là Trưởng lab / người khởi tạo form) */
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id',
    },
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  budget: {
    type: DataTypes.DECIMAL(18, 0),
    allowNull: true,
  },
  git_repo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  git_provider: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  git_default_branch: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  git_visibility: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  git_last_commit_sha: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  git_last_commit_author: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  git_last_commit_message: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  git_last_commit_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  model_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      isIn: [COMMITMENT_MODEL_TYPE_VALUES],
    },
  },
    // Mode 1: TAG, Mode 2: SELF_JOIN
  participation_mode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'TAG',
  },
  // Số lượng thành viên yêu cầu cho Mode 2
  required_members: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  /** TAG: chủ trì dự kiến từ chối / rút — chưa có leader_id, vẫn planning để thành viên xử lý cam kết */
  awaiting_leader_assignment: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  party_a_percent: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100,
    },
  },
  party_b_percent: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100,
    },
  },
}, {
  tableName: 'Projects',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['code'],
      name: 'UQ_Project_Code',
    },
  ],
});

Project.associate = (models) => {
  // Mối quan hệ với User (Bên A - Viện trưởng/Trưởng Lab)
  Project.belongsTo(models.User, {
    foreignKey: 'party_a_id',
    as: 'partyA',
  });

  // Mối quan hệ với Commitment
  Project.hasMany(models.Commitment, {
    foreignKey: 'project_id',
    as: 'commitments',
  });
};

module.exports = Project;