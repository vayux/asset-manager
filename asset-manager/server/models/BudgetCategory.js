const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BudgetCategory = sequelize.define('BudgetCategory', {
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
    field: 'user_id'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  frameworkTag: {
    type: DataTypes.ENUM('need','want','saving'),
    allowNull: false,
    defaultValue: 'need',
    field: 'framework_tag'
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order'
  },
}, {
  tableName: 'budget_categories',
  indexes: [{ name: 'budget_categories_user_id', fields: ['user_id'] }],
  underscored: true,
});

module.exports = BudgetCategory; 