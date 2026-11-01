const crypto = require('crypto');
const { Op } = require('sequelize');
const { Session } = require('../models');
const { hashData } = require('./security');
const { safeEqual } = require('./secretBox');

const COOKIE_NAME = 'mm_refresh';

const ttlMs = () => (parseInt(process.env.SESSION_TTL_DAYS, 10) || 7) * 24 * 60 * 60 * 1000;
// A second refresh with the just-rotated token inside this window is a multi-tab race, not theft
const reuseGraceMs = () => {
  const value = parseInt(process.env.REFRESH_REUSE_GRACE_MS, 10);
  return Number.isNaN(value) ? 10000 : value;
};
const newSecret = () => crypto.randomBytes(32).toString('base64url');

class SessionError extends Error {
  constructor(code, message, status = 401) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const parseToken = (token) => {
  const [id, secret] = String(token || '').split('.');
  if (!id || !secret || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { id, secret };
};

const isActive = (session) => Boolean(session && !session.revokedAt && session.expiresAt > new Date());

const createSession = async (userId, req) => {
  const secret = newSecret();
  const session = await Session.create({
    userId,
    tokenHash: hashData(secret),
    expiresAt: new Date(Date.now() + ttlMs()),
    lastUsedAt: new Date(),
    userAgent: String(req.get('user-agent') || '').slice(0, 512),
    ip: String(req.ip || '').slice(0, 64),
  });
  return { session, refreshToken: `${session.id}.${secret}` };
};

const rotateSession = async (refreshToken) => {
  const parsed = parseToken(refreshToken);
  if (!parsed) throw new SessionError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');

  const outcome = await Session.sequelize.transaction(async (transaction) => {
    const session = await Session.findByPk(parsed.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!isActive(session)) return { error: 'INVALID_REFRESH_TOKEN' };

    const hash = hashData(parsed.secret);
    if (session.previousTokenHash && safeEqual(hash, session.previousTokenHash)) {
      if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() < reuseGraceMs()) return { error: 'REFRESH_RACE' };
      // An old token came back after rotation: assume it was stolen and end the session
      await session.update({ revokedAt: new Date() }, { transaction });
      return { error: 'REFRESH_TOKEN_REUSED' };
    }
    if (!safeEqual(hash, session.tokenHash)) return { error: 'INVALID_REFRESH_TOKEN' };

    const secret = newSecret();
    await session.update({
      previousTokenHash: session.tokenHash,
      tokenHash: hashData(secret),
      rotatedAt: new Date(),
      lastUsedAt: new Date(),
    }, { transaction });
    return { session, refreshToken: `${session.id}.${secret}` };
  });

  if (outcome.error === 'REFRESH_RACE') throw new SessionError('REFRESH_RACE', 'Session was just refreshed. Retry.', 409);
  if (outcome.error) throw new SessionError(outcome.error, 'Session expired. Please login again.');
  return outcome;
};

const sessionIdFromToken = (refreshToken) => parseToken(refreshToken)?.id || null;

const revokeSession = (id, userId) => Session.update(
  { revokedAt: new Date() },
  { where: { id, revokedAt: null, ...(userId ? { userId } : {}) } }
);

const revokeUserSessions = (userId, { except } = {}) => Session.update(
  { revokedAt: new Date() },
  { where: { userId, revokedAt: null, ...(except ? { id: { [Op.ne]: except } } : {}) } }
);

const listSessions = (userId) => Session.findAll({
  where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
  attributes: ['id', 'userAgent', 'ip', 'createdAt', 'lastUsedAt', 'expiresAt'],
  order: [['lastUsedAt', 'DESC']],
});

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
});

const setRefreshCookie = (res, refreshToken) => res.cookie(COOKIE_NAME, refreshToken, { ...cookieOptions(), maxAge: ttlMs() });
const clearRefreshCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions());

module.exports = {
  COOKIE_NAME,
  SessionError,
  isActive,
  createSession,
  rotateSession,
  sessionIdFromToken,
  revokeSession,
  revokeUserSessions,
  listSessions,
  setRefreshCookie,
  clearRefreshCookie,
};
