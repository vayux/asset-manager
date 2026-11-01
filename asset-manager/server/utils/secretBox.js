const crypto = require('crypto');

const PREFIX = 'v1:';

const getKey = () => {
  const raw = process.env.MFA_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes), e.g. `openssl rand -hex 32`');
  }
  return Buffer.from(raw, 'hex');
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

// AES-256-GCM; output is "v1:<iv>:<tag>:<ciphertext>" in base64
const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':');
};

// Values written before encryption existed are returned unchanged until the migration re-encrypts them
const decrypt = (value) => {
  if (!isEncrypted(value)) return value;
  const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

// Keyed hash for short secrets (backup codes) so a database leak alone cannot brute-force them
const keyedHash = (value) => crypto.createHmac('sha256', getKey()).update(String(value)).digest('hex');

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

module.exports = { encrypt, decrypt, isEncrypted, keyedHash, safeEqual, getKey };
