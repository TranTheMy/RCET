const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VerilogProblem = sequelize.define('VerilogProblem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  logic_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  description_input: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  description_output: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  level: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'easy',
    validate: { isIn: [['easy', 'medium', 'hard']] },
  },
  tags: {
    type: DataTypes.STRING(500),
    allowNull: true,
    get() {
      const raw = this.getDataValue('tags');
      return raw ? raw.split(',') : [];
    },
    set(val) {
      this.setDataValue('tags', Array.isArray(val) ? val.join(',') : val);
    },
  },
  template_code: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  testbench: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  testbench_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'auto_generated',
    validate: { isIn: [['auto_generated', 'custom_uploaded']] },
  },
  owner_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_published: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'verilog_problems',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = VerilogProblem;
