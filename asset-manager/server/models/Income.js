const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Income = sequelize.define('Income', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  frequency: {
    type: DataTypes.ENUM('once','weekly','biweekly','monthly'),
    allowNull: false,
    defaultValue: 'monthly',
  },
  nextPayDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'next_pay_date',
  },
}, {
  tableName: 'incomes',
  indexes: [{ name: 'incomes_user_id', fields: ['user_id'] }],
  underscored: true,
});

module.exports = Income; 