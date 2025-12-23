const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
    type: DataTypes.ENUM(
      'bank_account',
      'fixed_deposit', 
      'recurring_deposit',
      'stocks',
      'mutual_funds',
      'provident_fund',
      'insurance',
      'gold',
      'real_estate',
      'crypto',
      'personal_loan',
      'other'
    ),
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
  // Remove manual indexes to let Sequelize handle them based on associations
});

module.exports = Investment; 