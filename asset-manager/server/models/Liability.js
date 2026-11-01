const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Liability model represents debts or obligations (negative value items) for a user.
const Liability = sequelize.define('Liability', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100],
    },
  },
  category: {
    type: DataTypes.ENUM('loan', 'credit_card', 'mortgage', 'tax', 'other'),
    allowNull: false,
    defaultValue: 'other',
  },
  outstandingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  interestRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'asset_id',
    references: {
      model: 'assets',
      key: 'id',
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  indexes: [{ name: 'liabilities_user_id', fields: ['user_id'] }],
});

module.exports = Liability; 