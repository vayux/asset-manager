const { DataTypes } = require('sequelize');
const { SUPPORTED_CURRENCIES } = require('../constants/currencies');
const { sequelize } = require('../config/database');
const { ASSET_CATEGORIES } = require('../constants/categories');

// Asset model represents any positive-valued item owned by a user that is not necessarily an investment
// Examples: property, vehicle, cash, collectibles etc.
const Asset = sequelize.define('Asset', {
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
    type: DataTypes.ENUM(...ASSET_CATEGORIES),
    allowNull: false,
    defaultValue: 'other',
  },
  currentValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  purchaseDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  depreciationRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'depreciation_rate',
    validate: {
      min: 0,
      max: 100,
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR',
    validate: { isIn: [SUPPORTED_CURRENCIES] },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  indexes: [{ name: 'assets_user_id', fields: ['user_id'] }],
});

module.exports = Asset; 