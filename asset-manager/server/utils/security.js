const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Short-lived access token bound to a server-side session (sid) so logout and revocation take effect
const generateAccessToken = (userId, sessionId) => jwt.sign(
  { userId, sid: sessionId, type: 'access' },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE || '15m', issuer: 'asset-manager', audience: 'asset-manager-client' }
);

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'asset-manager',
      audience: 'asset-manager-client'
    });
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

const JWT_OPTIONS = { issuer: 'asset-manager', audience: 'asset-manager-client' };

// Short-lived token proving the password step passed; only accepted by the MFA login step
const generateMfaPendingToken = (userId) => jwt.sign(
  { userId, type: 'mfa_pending' },
  process.env.JWT_SECRET,
  { ...JWT_OPTIONS, expiresIn: '5m' }
);

const verifyMfaPendingToken = (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_OPTIONS);
  } catch (error) {
    throw new Error('Invalid or expired MFA session');
  }
  if (decoded.type !== 'mfa_pending') throw new Error('Invalid or expired MFA session');
  return decoded;
};

// Generate secure random string
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash sensitive data
const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Create CSRF token
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate CSRF token
const validateCSRFToken = (token, sessionToken) => {
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(sessionToken, 'hex')
  );
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self';"
  );
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

// Refuse to start without strong secrets
const validateSecrets = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'fallback_secret' || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long and not use default values');
  }
  // Throws if MFA_ENCRYPTION_KEY is missing or malformed
  require('./secretBox').getKey();
};

// Generate a secure session ID
const generateSessionId = () => {
  return crypto.randomUUID();
};

module.exports = {
  generateAccessToken,
  generateMfaPendingToken,
  verifyMfaPendingToken,
  verifyAccessToken,
  generateSecureToken,
  hashData,
  generateCSRFToken,
  validateCSRFToken,
  securityHeaders,
  validateSecrets,
  generateSessionId
}; 