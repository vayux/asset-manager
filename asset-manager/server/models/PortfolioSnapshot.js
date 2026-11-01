const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PortfolioSnapshot = sequelize.define('PortfolioSnapshot', {
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
  snapshotDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  totalValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  categoryBreakdown: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON object containing category-wise breakdown of investments',
  },
  investments: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Snapshot of all investments at this point in time',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isManual: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if manually created, false if auto-generated',
  },
}, {
  indexes: [{ name: 'portfolio_snapshots_user_id_snapshot_date', unique: true, fields: ['user_id', 'snapshot_date'] }],
});

module.exports = PortfolioSnapshot; 