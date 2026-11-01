const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ENTITY_TYPES = ['investment', 'asset', 'liability'];

const Attachment = sequelize.define('Attachment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  entityType: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [ENTITY_TYPES] } },
  entityId: { type: DataTypes.UUID, allowNull: false },
  fileName: { type: DataTypes.STRING(255), allowNull: false },
  mimeType: { type: DataTypes.STRING(100), allowNull: false },
  sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
  storageDriver: { type: DataTypes.STRING(20), allowNull: false },
  storageKey: { type: DataTypes.STRING(512), allowNull: false, unique: true },
}, {
  tableName: 'attachments',
  underscored: true,
  indexes: [{ name: 'attachments_user_entity', fields: ['user_id', 'entity_type', 'entity_id'] }],
});

Attachment.ENTITY_TYPES = ENTITY_TYPES;

module.exports = Attachment;
