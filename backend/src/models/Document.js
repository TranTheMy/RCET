/**
 * Tài liệu kỹ thuật (kho Books) — file trên Cloudinary, workflow duyệt trong document.service.js.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { DOCUMENT_STATUS_VALUES } = require('../config/constants');

const Document = sequelize.define(
  'Document',
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Categories', key: 'id' },
    },
    doc_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    manufacturer: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    technical_metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pdf_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    /** Cloudinary secure_url hoặc URL nguồn tải */
    file_path: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    cloudinary_public_id: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    source_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'upload',
    },
    checksum_sha256: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    version_group_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    version_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    parent_document_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Documents', key: 'id' },
    },
    is_latest: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
      validate: { isIn: [DOCUMENT_STATUS_VALUES] },
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
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archived_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'Documents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['version_group_id'] },
      { fields: ['created_by'] },
      { fields: ['status'] },
      { fields: ['category_id'] },
    ],
  },
);

module.exports = Document;
