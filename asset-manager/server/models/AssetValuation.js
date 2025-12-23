const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// AssetValuation keeps track of historical value for an asset (e.g. property appraisal)
const AssetValuation = sequelize.define('AssetValuation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'asset_id',
    references: {
      model: 'assets',
      key: 'id',
    },
  },
  valuationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0,
    },
  },
}, {
  tableName: 'asset_valuations',
  underscored: true,
  indexes: [
    { fields: ['asset_id'] },
    { fields: ['valuation_date'] },
  ],
});

module.exports = AssetValuation; 