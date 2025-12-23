const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Goal = sequelize.define('Goal', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    field: 'user_id',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  targetAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'target_amount',
  },
  targetDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'target_date',
  },
  currentAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'current_amount',
  },
  monthlyContribution: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'monthly_contribution',
  },
  scope: {
    type: DataTypes.ENUM('investments','net_worth'),
    allowNull: false,
    defaultValue: 'investments',
  },
}, {
  tableName: 'goals',
  underscored: true,
});

module.exports = Goal; 