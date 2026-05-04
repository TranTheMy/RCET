const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { RESEARCH_STATUS_VALUES } = require('../config/constants');

const Research = sequelize.define(
  'Research',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    authors: {
      type: DataTypes.STRING(1000),
      allowNull: false,
      defaultValue: '',
    },
    published_date: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: '',
    },
    journal: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '',
    },
    volume: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    issue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pages: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
    },
    publisher: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    total_citations: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pdf_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    /** Cloudinary secure_url */
    file_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    /** Cloudinary public_id */
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    source_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'upload',
    },
    impact_rank: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'No Rank',
    },
    is_peer_reviewed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_open_access: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    doi: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    /** JSON string — mảng tag */
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [RESEARCH_STATUS_VALUES] },
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    review_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'Researches',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['status'] },
      { fields: ['created_by'] },
      { fields: ['is_public'] },
    ],
  },
);

module.exports = Research;
