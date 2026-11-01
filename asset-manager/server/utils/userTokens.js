const crypto = require('crypto');
const { Op } = require('sequelize');
const { UserToken } = require('../models');
const { hashData } = require('./security');

const TTL_MS = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
};

// Issuing a new token voids any earlier unused token of the same type
const issueUserToken = async (userId, type) => {
  await UserToken.update({ usedAt: new Date() }, { where: { userId, type, usedAt: null } });
  const token = crypto.randomBytes(32).toString('base64url');
  await UserToken.create({ userId, type, tokenHash: hashData(token), expiresAt: new Date(Date.now() + TTL_MS[type]) });
  return token;
};

// Atomically marks the token used; returns the owning user id, or null if invalid, expired or already used
const consumeUserToken = async (token, type) => {
  const [count, rows] = await UserToken.update(
    { usedAt: new Date() },
    { where: { tokenHash: hashData(String(token || '')), type, usedAt: null, expiresAt: { [Op.gt]: new Date() } }, returning: true }
  );
  return count ? rows[0].userId : null;
};

module.exports = { issueUserToken, consumeUserToken };
