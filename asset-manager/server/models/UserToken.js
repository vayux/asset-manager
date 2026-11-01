const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Single-use emailed tokens (email verification, password reset); only a hash is stored
const UserToken = sequelize.define('UserToken', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  type: { type: DataTypes.ENUM('email_verification', 'password_reset'), allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'user_tokens',
  indexes: [{ name: 'user_tokens_user_id_type', fields: ['user_id', 'type'] }],
});

module.exports = UserToken;
