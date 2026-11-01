const { DataTypes } = require('sequelize');
const { SUPPORTED_CURRENCIES } = require('../constants/currencies');
const { sequelize } = require('../config/database');
const { INVESTMENT_CATEGORIES } = require('../constants/categories');

const Investment = sequelize.define('Investment', {
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
    type: DataTypes.ENUM(...INVESTMENT_CATEGORIES),
    allowNull: false,
  },
  subCategory: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'For example: SBI, HDFC, Axis for bank_account category',
  },
  currentAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
    },
  },
  initialAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },
  interestRate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'Annual interest rate in percentage',
  },
  maturityDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  accountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  institutionName: {
    type: DataTypes.STRING,
    allowNull: true,
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
  investmentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'investment_date',
    comment: 'Date of investment or the last valuation date',
  },
}, {
  indexes: [{ name: 'investments_user_id', fields: ['user_id'] }],
});

module.exports = Investment; 