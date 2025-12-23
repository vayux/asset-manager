const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvestmentHistory = sequelize.define('InvestmentHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  investmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'investment_id',
  },
  valuationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'valuation_date',
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
}, {
  indexes: [
    { fields: ['investment_id'] },
    { fields: ['valuation_date'] },
  ],
});

module.exports = InvestmentHistory; 