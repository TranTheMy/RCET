const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { SCIENTIST_APPLICATION_STATUS_VALUES } = require('../config/constants');

const ScientistApplication = sequelize.define(
  'ScientistApplication',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    position: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    portfolio_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    cover_letter: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'pending_lab_review',
      validate: { isIn: [SCIENTIST_APPLICATION_STATUS_VALUES] },
    },
    lab_reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    lab_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lab_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    director_reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    director_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    director_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contract_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contract_file_url: {
      type: DataTypes.STRING(2000),
      allowNull: true,
    },
    contract_created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contract_created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    contract_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contract_confirmed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
  },
  {
    tableName: 'ScientistApplications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    /** Không khai báo indexes ở đây: MSSQL + Sequelize thường đã có index theo FK user_id;
     * thêm index trùng cột khiến sync() lỗi tại addIndex. Cần index status → tạo thủ công trong DB nếu cần. */
  },
);

module.exports = ScientistApplication;
