const validator = require('validator');
const rateLimit = require('express-rate-limit');

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/(?=.*[@$!%*?&])/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more secure password');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Email validation with additional security checks
const validateEmail = (email) => {
  const errors = [];

  if (!validator.isEmail(email)) {
    errors.push('Invalid email format');
    return { isValid: false, errors };
  }

  // Check for disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email'
  ];
  
  const domain = email.split('@')[1];
  if (disposableDomains.includes(domain.toLowerCase())) {
    errors.push('Disposable email addresses are not allowed');
  }

  // Length check
  if (email.length > 254) {
    errors.push('Email address is too long');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Name validation
const validateName = (name, fieldName) => {
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    errors.push(`${fieldName} must be at least 2 characters long`);
  }

  if (trimmedName.length > 50) {
    errors.push(`${fieldName} must be less than 50 characters long`);
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s\-']+$/.test(trimmedName)) {
    errors.push(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
  }

  // Check for suspicious patterns
  if (/(.)\1{3,}/.test(trimmedName)) {
    errors.push(`${fieldName} contains suspicious repeated characters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Rate limiting configurations
const createAuthRateLimit = () => {
  return rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' 
      ? (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5)  // Strict in production
      : 50, // More lenient in development
    message: {
      error: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests
    skipSuccessfulRequests: true,
    // Custom key generator to include user agent for better tracking
    keyGenerator: (req) => {
      return req.ip + ':' + (req.get('User-Agent') || '').substring(0, 50);
    }
  });
};

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return validator.escape(input.trim());
};

// Check for suspicious patterns in input
const detectSuspiciousInput = (input) => {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:\s*text\/html/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
};

module.exports = {
  validatePasswordStrength,
  validateEmail,
  validateName,
  createAuthRateLimit,
  sanitizeInput,
  detectSuspiciousInput
}; 