const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Generate secure JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { 
      userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: 'asset-manager',
      audience: 'asset-manager-client'
    }
  );

  const refreshToken = jwt.sign(
    { 
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: 'asset-manager',
      audience: 'asset-manager-client'
    }
  );

  return { accessToken, refreshToken };
};

// Verify access token (with backward compatibility)
const verifyAccessToken = (token) => {
  try {
    // First try with new validation (issuer/audience)
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'asset-manager',
      audience: 'asset-manager-client'
    });
  } catch (error) {
    // Fallback to old validation for existing tokens
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (fallbackError) {
      throw new Error('Invalid or expired access token');
    }
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'asset-manager',
      audience: 'asset-manager-client'
    });
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
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

// Check if JWT secret is secure
const validateJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!secret || secret === 'fallback_secret' || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long and not use default values');
  }
  
  if (!refreshSecret || refreshSecret === 'fallback_secret' || refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long and not use default values');
  }
  
  if (secret === refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
};

// Generate a secure session ID
const generateSessionId = () => {
  return crypto.randomUUID();
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashData,
  generateCSRFToken,
  validateCSRFToken,
  securityHeaders,
  validateJWTSecret,
  generateSessionId
}; 