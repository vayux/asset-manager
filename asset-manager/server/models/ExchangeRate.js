const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { SUPPORTED_CURRENCIES } = require('../constants/currencies');

// A rate the user entered by hand; used when the live sources are unavailable
const ExchangeRate = sequelize.define('ExchangeRate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  currency: { type: DataTypes.STRING(3), allowNull: false, validate: { isIn: [SUPPORTED_CURRENCIES] } },
  rateToInr: { type: DataTypes.DECIMAL(18, 6), allowNull: false, validate: { min: 0.000001 } },
}, {
  tableName: 'exchange_rates',
  underscored: true,
  indexes: [{ unique: true, fields: ['user_id', 'currency'] }],
});

module.exports = ExchangeRate;
