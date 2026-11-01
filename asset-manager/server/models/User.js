const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { encrypt, decrypt } = require('../utils/secretBox');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [8, 72],
    },
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 50],
    },
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 50],
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // 2FA fields
  mfaEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Encrypted at rest; reads return the plain base32 secret
  mfaSecret: {
    type: DataTypes.STRING,
    allowNull: true,
    get() {
      const raw = this.getDataValue('mfaSecret');
      return raw ? decrypt(raw) : raw;
    },
    set(value) {
      this.setDataValue('mfaSecret', value ? encrypt(value) : null);
    },
  },
  // Last accepted TOTP time step, so a code cannot be replayed
  mfaLastUsedStep: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  backupCodes: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  emailOtpSecret: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailOtpExpiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  emailOtpAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
    // Notification preferences
    emailNotifications: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    securityAlerts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    investmentUpdates: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const salt = await bcrypt.genSalt(saltRounds);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const salt = await bcrypt.genSalt(saltRounds);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

// Instance method to check password
User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Instance method to get user without password and sensitive MFA data
User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.mfaSecret;
  delete values.backupCodes;
  delete values.emailOtpSecret;
  delete values.emailOtpExpiry;
  delete values.emailOtpAttempts;
  delete values.mfaLastUsedStep;
  return values;
};

module.exports = User; 