const { User, Session } = require('../models');
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
    
    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        message: 'Invalid token type.',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    const [user, session] = await Promise.all([
      User.findByPk(decoded.userId),
      decoded.sid ? Session.findByPk(decoded.sid) : null,
    ]);

    if (!session || session.userId !== decoded.userId || session.revokedAt || session.expiresAt <= new Date()) {
      return res.status(401).json({
        message: 'Session has ended. Please login again.',
        code: 'SESSION_REVOKED'
      });
    }
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        message: 'User not found or inactive.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Add user info to request
    req.user = user;
    req.sessionId = session.id;
    req.tokenInfo = {
      userId: decoded.userId,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };
    
    next();
  } catch (error) {
    
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