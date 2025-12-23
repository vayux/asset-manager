const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { verifyAccessToken } = require('../utils/security');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No valid token provided.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT secret is properly configured
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback_secret') {
      console.error('JWT_SECRET not properly configured');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const decoded = verifyAccessToken(token);
    
    // Verify token type (backward compatibility - old tokens may not have type field)
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ 
        message: 'Invalid token type.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    const user = await User.findByPk(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        message: 'User not found or inactive.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Add user info to request
    req.user = user;
    req.tokenInfo = {
      userId: decoded.userId,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        message: 'Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.message.includes('Invalid')) {
      return res.status(401).json({ 
        message: 'Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(500).json({ 
      message: 'Authentication failed.',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = authMiddleware; 