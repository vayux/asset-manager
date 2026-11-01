const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BudgetEntry = sequelize.define('BudgetEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    field: 'user_id'
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'budget_categories', key: 'id' },
    field: 'category_id'
  },
  month: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  budgetedAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    field: 'budgeted_amount'
  },
  spentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'spent_amount'
  },
}, {
  tableName: 'budget_entries',
  indexes: [{ name: 'budget_entries_user_id_category_id_month', unique: true, fields: ['user_id', 'category_id', 'month'] }],
  underscored: true,
});

module.exports = BudgetEntry; 