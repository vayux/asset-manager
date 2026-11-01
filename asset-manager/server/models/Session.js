const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One row per signed-in device. The refresh cookie holds "<id>.<secret>"; only a hash of the secret is stored.
const Session = sequelize.define('Session', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false },
  previousTokenHash: { type: DataTypes.STRING(64), allowNull: true },
  rotatedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
  lastUsedAt: { type: DataTypes.DATE, allowNull: true },
  userAgent: { type: DataTypes.STRING(512), allowNull: true },
  ip: { type: DataTypes.STRING(64), allowNull: true },
}, {
  tableName: 'sessions',
  indexes: [{ name: 'sessions_user_id', fields: ['user_id'] }],
});

module.exports = Session;
