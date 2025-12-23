const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { 
  validatePasswordStrength, 
  validateEmail, 
  validateName, 
  createAuthRateLimit,
  sanitizeInput,
  detectSuspiciousInput
} = require('../utils/validation');
const { 
  generateTokens, 
  verifyRefreshToken,
  securityHeaders,
  validateJWTSecret
} = require('../utils/security');
const mfaUtils = require('../utils/mfa');
const { sendSecurityAlert } = require('../utils/emailService');

const router = express.Router();

// Fallback token generation for backward compatibility
const generateLegacyToken = (userId) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Apply security headers to all auth routes
router.use(securityHeaders);

// Validate JWT configuration on startup (with fallback for development)
try {
  validateJWTSecret();
} catch (error) {
  console.warn('JWT Configuration Warning:', error.message);
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT Configuration is required in production');
    process.exit(1);
  } else {
    console.log('Using fallback JWT configuration for development');
  }
}

// Apply rate limiting to auth routes
const authRateLimit = createAuthRateLimit();
router.use('/login', authRateLimit);
router.use('/register', authRateLimit);

// Register route
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
], async (req, res) => {
  try {
    // Basic validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    let { email, password, firstName, lastName } = req.body;

    // Sanitize inputs
    email = sanitizeInput(email);
    firstName = sanitizeInput(firstName);
    lastName = sanitizeInput(lastName);

    // Check for suspicious input
    if (detectSuspiciousInput(firstName) || detectSuspiciousInput(lastName)) {
      return res.status(400).json({ 
        message: 'Invalid input detected',
        code: 'SUSPICIOUS_INPUT'
      });
    }

    // Enhanced validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        message: 'Email validation failed',
        errors: emailValidation.errors.map(err => ({ field: 'email', message: err }))
      });
    }

    // Only enforce strong password validation for new registrations
    // Existing users can continue using their current passwords
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      // For now, just warn about weak passwords but don't block registration
      // This allows for gradual migration to stronger passwords
      console.warn(`Weak password detected during registration for email: ${email}`);
      
      // In production, you might want to enforce this:
      if (process.env.ENFORCE_STRONG_PASSWORDS === 'true') {
        return res.status(400).json({ 
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors.map(err => ({ field: 'password', message: err }))
        });
      }
    }

    const firstNameValidation = validateName(firstName, 'First name');
    if (!firstNameValidation.isValid) {
      return res.status(400).json({ 
        message: 'First name validation failed',
        errors: firstNameValidation.errors.map(err => ({ field: 'firstName', message: err }))
      });
    }

    const lastNameValidation = validateName(lastName, 'Last name');
    if (!lastNameValidation.isValid) {
      return res.status(400).json({ 
        message: 'Last name validation failed',
        errors: lastNameValidation.errors.map(err => ({ field: 'lastName', message: err }))
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ 
        message: 'An account with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    // Generate tokens (with fallback for missing refresh secret)
    let responseData;
    try {
      const tokens = generateTokens(user.id);
      responseData = {
        message: 'Account created successfully',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toJSON(),
      };
    } catch (error) {
      // Fallback to legacy token if new token generation fails
      const token = generateLegacyToken(user.id);
      responseData = {
        message: 'Account created successfully',
        token,
        user: user.toJSON(),
      };
    }

    // Log successful registration (without sensitive data)
    console.log(`New user registered: ${user.id} (${email})`);

    res.status(201).json(responseData);
  } catch (error) {
    console.error('Registration error:', error);
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ 
        message: 'Registration failed. Please try again.',
        code: 'REGISTRATION_ERROR'
      });
    } else {
      res.status(500).json({ 
        message: 'Registration failed',
        error: error.message
      });
    }
  }
});

// Login route
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    let { email, password } = req.body;

    // Sanitize email input
    email = sanitizeInput(email);

    // Additional email validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    
    // Generic error message to prevent user enumeration
    if (!user || !user.isActive) {
      // Log the attempt for security monitoring
      console.warn(`Login attempt with invalid email: ${email} from IP: ${req.ip}`);
      
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      // Log failed password attempt
      console.warn(`Failed password attempt for user: ${user.id} from IP: ${req.ip}`);
      
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      const { mfaToken, backupCode } = req.body;
      
      if (!mfaToken && !backupCode) {
        return res.status(200).json({
          message: 'MFA verification required',
          requiresMFA: true,
          userId: user.id, // Temporary identifier for MFA verification
          code: 'MFA_REQUIRED'
        });
      }

      let mfaValid = false;

      // Try TOTP token first
      if (mfaToken && user.mfaSecret) {
        console.log(`Attempting TOTP verification for user: ${user.id}`);
        mfaValid = mfaUtils.verifyTOTP(mfaToken, user.mfaSecret);
        console.log(`TOTP verification result: ${mfaValid}`);
      }

      // Try backup code if TOTP failed
      if (!mfaValid && backupCode && user.backupCodes) {
        console.log(`Attempting backup code verification for user: ${user.id}`);
        const backupResult = mfaUtils.verifyBackupCode(backupCode, user.backupCodes);
        if (backupResult.valid) {
          mfaValid = true;
          // Update remaining backup codes
          await user.update({ backupCodes: backupResult.remainingCodes });
          console.log(`Backup code verification successful for user: ${user.id}`);
        }
      }

      if (!mfaValid) {
        console.warn(`Failed MFA attempt for user: ${user.id} from IP: ${req.ip}. Token: ${mfaToken ? 'provided' : 'not provided'}, Backup: ${backupCode ? 'provided' : 'not provided'}`);
        return res.status(401).json({ 
          message: 'Invalid MFA token or backup code',
          code: 'INVALID_MFA'
        });
      }
    }

    // Generate tokens (with fallback for missing refresh secret)
    let responseData;
    try {
      const tokens = generateTokens(user.id);
      responseData = {
        success: true,
        message: 'Login successful',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: user.toJSON(),
      };
    } catch (error) {
      // Fallback to legacy token if new token generation fails
      const token = generateLegacyToken(user.id);
      responseData = {
        success: true,
        message: 'Login successful',
        token,
        user: user.toJSON(),
      };
    }

    // Log successful login (without sensitive data)
    console.log(`User logged in: ${user.id} (${email}) from IP: ${req.ip}`);

    // Send security alert email for login (optional - only if enabled)
    try {
      await sendSecurityAlert(
        user, 
        'Successful Login', 
        req.ip || req.connection.remoteAddress
      );
    } catch (emailError) {
      console.error('Failed to send login notification:', emailError);
      // Don't fail the login if email fails
    }

    res.json(responseData);
  } catch (error) {
    console.error('Login error:', error);
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ 
        message: 'Login failed. Please try again.',
        code: 'LOGIN_ERROR'
      });
    } else {
      res.status(500).json({ 
        message: 'Login failed',
        error: error.message
      });
    }
  }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ 
        message: 'Refresh token is required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    
    // Verify token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        message: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Verify user still exists and is active
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        message: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user.id);

    res.json({
      message: 'Tokens refreshed successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({ 
        message: 'Refresh token expired. Please login again.',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    if (error.message.includes('Invalid')) {
      return res.status(401).json({ 
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    res.status(500).json({ 
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: req.user.toJSON(),
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authMiddleware, [
  body('firstName').optional().notEmpty().trim(),
  body('lastName').optional().notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation errors', 
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email } = req.body;
    const updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email && email !== req.user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'Email already taken' });
      }
      updateData.email = email;
    }

    await req.user.update(updateData);

    res.json({
      message: 'Profile updated successfully',
      user: req.user.toJSON(),
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Change password route
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isValidPassword = await req.user.validatePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        message: 'New password does not meet security requirements',
        errors: passwordValidation.errors.map(err => ({ field: 'newPassword', message: err }))
      });
    }

    // Check if new password is different from current
    const isSamePassword = await req.user.validatePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: 'New password must be different from current password',
        code: 'SAME_PASSWORD'
      });
    }

    // Update password
    await req.user.update({ password: newPassword });

    // Log password change for security
    console.log(`Password changed for user: ${req.user.id} from IP: ${req.ip}`);

    // Send security alert email
    try {
      await sendSecurityAlert(
        req.user, 
        'Password Changed', 
        req.ip || req.connection.remoteAddress
      );
    } catch (emailError) {
      console.error('Failed to send password change notification:', emailError);
      // Don't fail the password change if email fails
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      message: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
});

module.exports = router; 