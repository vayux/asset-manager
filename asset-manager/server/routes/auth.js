const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { User } = require('../models');
const authMiddleware = require('../middleware/auth');
const { 
  validatePasswordStrength, 
  validateEmail, 
  validateName, 
  createAuthRateLimit,
  createLoginEmailRateLimit,
  createRateLimit,
  detectSuspiciousInput
} = require('../utils/validation');
const { 
  generateAccessToken,
  generateMfaPendingToken,
  verifyMfaPendingToken,
  securityHeaders
} = require('../utils/security');
const {
  COOKIE_NAME,
  SessionError,
  createSession,
  rotateSession,
  sessionIdFromToken,
  revokeSession,
  revokeUserSessions,
  listSessions,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/sessions');
const { issueUserToken, consumeUserToken } = require('../utils/userTokens');
const logger = require('../utils/logger');
const mfaUtils = require('../utils/mfa');
const { sendSecurityAlert, sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

// Apply security headers to all auth routes
router.use(securityHeaders);

// Apply rate limiting to auth routes
const authRateLimit = createAuthRateLimit();
router.use('/login', authRateLimit);
router.post('/login', createLoginEmailRateLimit());
router.use('/register', authRateLimit);
router.use('/refresh', createRateLimit({ max: 60, message: 'Too many token refresh attempts. Please try again later.' }));
router.use(['/forgot-password', '/reset-password', '/verify-email', '/resend-verification'], authRateLimit);

// Cookie-authenticated endpoints need a header a cross-site form cannot send (CSRF defence on top of SameSite)
const requireXhr = (req, res, next) => {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Missing X-Requested-With header', code: 'CSRF_CHECK_FAILED' });
  }
  next();
};

const MAX_EMAIL_OTP_ATTEMPTS = 5;

// Keyed by the account behind the MFA challenge so IP rotation does not help
const pendingUserKey = (req) => {
  try {
    return `mfa:${verifyMfaPendingToken(req.body?.mfaPendingToken).userId}`;
  } catch (error) {
    return `mfa-ip:${req.ip}`;
  }
};
const mfaVerifyLimit = createRateLimit({ max: 10, keyGenerator: pendingUserKey, skipSuccessfulRequests: true, message: 'Too many verification attempts. Please try again later.' });
const emailOtpSendLimit = createRateLimit({ max: 3, keyGenerator: pendingUserKey, message: 'Too many codes requested. Please try again later.' });

const issueSession = async (user, req, res) => {
  const { session, refreshToken } = await createSession(user.id, req);
  setRefreshCookie(res, refreshToken);
  logger.info({ userId: user.id, sessionId: session.id }, 'User logged in');
  try {
    await sendSecurityAlert(user, 'Successful Login', req.ip);
  } catch (emailError) {
    logger.warn({ err: emailError }, 'Failed to send login notification');
  }
  return {
    success: true,
    message: 'Login successful',
    accessToken: generateAccessToken(user.id, session.id),
    user: user.toJSON(),
  };
};

const sendVerification = async (user) => {
  const token = await issueUserToken(user.id, 'email_verification');
  const result = await sendVerificationEmail(user, token);
  if (!result.success) logger.warn({ userId: user.id }, 'Verification email not sent');
  return result.success;
};

const loadPendingUser = async (token) => {
  let decoded;
  try {
    decoded = verifyMfaPendingToken(token);
  } catch (error) {
    return null;
  }
  const user = await User.findByPk(decoded.userId);
  return user && user.isActive && user.mfaEnabled ? user : null;
};

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
    firstName = String(firstName).trim();
    lastName = String(lastName).trim();

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

    const passwordValidation = validatePasswordStrength(String(password || ''));
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet security requirements',
        errors: passwordValidation.errors.map(err => ({ field: 'password', message: err }))
      });
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

    const { session, refreshToken } = await createSession(user.id, req);
    setRefreshCookie(res, refreshToken);
    const verificationEmailSent = await sendVerification(user);
    logger.info({ userId: user.id }, 'New user registered');

    res.status(201).json({
      message: 'Account created successfully',
      accessToken: generateAccessToken(user.id, session.id),
      user: user.toJSON(),
      verificationEmailSent,
    });
  } catch (error) {
    logger.error({ err: error }, 'Registration error');
    
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
      logger.warn({ ip: req.ip }, 'Login attempt for unknown email');
      
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      // Log failed password attempt
      logger.warn({ userId: user.id, ip: req.ip }, 'Failed password attempt');
      
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (user.mfaEnabled) {
      return res.json({
        success: true,
        requiresMFA: true,
        code: 'MFA_REQUIRED',
        message: 'MFA verification required',
        mfaPendingToken: generateMfaPendingToken(user.id),
        methods: ['totp', 'backup', ...(mfaUtils.isEmailConfigured() ? ['email'] : [])],
      });
    }

    res.json(await issueSession(user, req, res));
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ message: 'Login failed. Please try again.', code: 'LOGIN_ERROR' });
  }
});

// Second login step: exchange the MFA challenge token plus a code for a session
router.post('/login/mfa', mfaVerifyLimit, [
  body('mfaPendingToken').isString().notEmpty(),
  body('method').isIn(['totp', 'backup', 'email']),
  body('code').isString().trim().isLength({ min: 6, max: 16 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }

  const { mfaPendingToken, method, code } = req.body;
  const user = await loadPendingUser(mfaPendingToken);
  if (!user) {
    return res.status(401).json({ message: 'MFA session expired. Please sign in again.', code: 'MFA_SESSION_INVALID' });
  }

  let valid = false;
  if (method === 'totp' && user.mfaSecret) {
    valid = await mfaUtils.consumeTOTP(user, code);
  } else if (method === 'backup') {
    const result = mfaUtils.verifyBackupCode(code, user.backupCodes);
    if (result.valid) {
      valid = true;
      await user.update({ backupCodes: result.remainingCodes });
    }
  } else if (method === 'email') {
    valid = mfaUtils.verifyEmailOTP(mfaUtils.hashSecret(code), user.emailOtpSecret, user.emailOtpExpiry);
    if (valid) {
      await user.update({ emailOtpSecret: null, emailOtpExpiry: null, emailOtpAttempts: 0 });
    } else if (user.emailOtpSecret) {
      const attempts = user.emailOtpAttempts + 1;
      await user.update(attempts >= MAX_EMAIL_OTP_ATTEMPTS
        ? { emailOtpSecret: null, emailOtpExpiry: null, emailOtpAttempts: 0 }
        : { emailOtpAttempts: attempts });
    }
  }

  if (!valid) {
    logger.warn({ userId: user.id, method }, 'Failed MFA attempt');
    return res.status(401).json({ message: 'Invalid verification code', code: 'INVALID_MFA' });
  }

  res.json(await issueSession(user, req, res));
});

// Email a one-time code for the pending MFA login
router.post('/login/email-otp', emailOtpSendLimit, [
  body('mfaPendingToken').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  if (!mfaUtils.isEmailConfigured()) {
    return res.status(503).json({ message: 'Email service not configured' });
  }

  const user = await loadPendingUser(req.body.mfaPendingToken);
  if (!user) {
    return res.status(401).json({ message: 'MFA session expired. Please sign in again.', code: 'MFA_SESSION_INVALID' });
  }

  const { otp, expiry } = mfaUtils.generateEmailOTP();
  // Persist before sending so a code that reaches the inbox is always verifiable
  await user.update({ emailOtpSecret: mfaUtils.hashSecret(otp), emailOtpExpiry: expiry, emailOtpAttempts: 0 });
  await mfaUtils.sendEmailOTP(user, otp);

  res.json({ success: true, message: 'Verification code sent to your email' });
});

// Exchange the refresh cookie for a new access token; the refresh token rotates on every use
router.post('/refresh', requireXhr, async (req, res) => {
  const presented = req.cookies?.[COOKIE_NAME];
  if (!presented) {
    return res.status(401).json({ message: 'Not signed in', code: 'NO_REFRESH_TOKEN' });
  }

  let rotated;
  try {
    rotated = await rotateSession(presented);
  } catch (error) {
    if (!(error instanceof SessionError)) throw error;
    if (error.code !== 'REFRESH_RACE') clearRefreshCookie(res);
    if (error.code === 'REFRESH_TOKEN_REUSED') logger.warn({ sessionId: sessionIdFromToken(presented) }, 'Refresh token reuse; session revoked');
    return res.status(error.status).json({ message: error.message, code: error.code });
  }

  const user = await User.findByPk(rotated.session.userId);
  if (!user || !user.isActive) {
    await revokeSession(rotated.session.id);
    clearRefreshCookie(res);
    return res.status(401).json({ message: 'User not found or inactive', code: 'USER_NOT_FOUND' });
  }

  setRefreshCookie(res, rotated.refreshToken);
  res.json({
    message: 'Tokens refreshed successfully',
    accessToken: generateAccessToken(user.id, rotated.session.id),
    user: user.toJSON(),
  });
});

// End this device's session
router.post('/logout', requireXhr, async (req, res) => {
  const sessionId = sessionIdFromToken(req.cookies?.[COOKIE_NAME]);
  if (sessionId) await revokeSession(sessionId);
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

// Sign out every other device
router.post('/logout-all', authMiddleware, async (req, res) => {
  const [count] = await revokeUserSessions(req.user.id, { except: req.sessionId });
  res.json({ success: true, revoked: count });
});

router.get('/sessions', authMiddleware, async (req, res) => {
  const sessions = await listSessions(req.user.id);
  res.json({ sessions: sessions.map((s) => ({ ...s.toJSON(), current: s.id === req.sessionId })) });
});

router.delete('/sessions/:id', authMiddleware, [param('id').isUUID()], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Invalid session id' });
  const [count] = await revokeSession(req.params.id, req.user.id);
  if (!count) return res.status(404).json({ message: 'Session not found' });
  res.json({ success: true });
});

router.post('/verify-email', [body('token').isString().notEmpty()], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Verification token is required' });
  const userId = await consumeUserToken(req.body.token, 'email_verification');
  if (!userId) return res.status(400).json({ message: 'This link is invalid or has expired', code: 'INVALID_TOKEN' });
  await User.update({ emailVerifiedAt: new Date() }, { where: { id: userId } });
  res.json({ success: true, message: 'Email confirmed' });
});

router.post('/resend-verification', authMiddleware, async (req, res) => {
  if (req.user.emailVerifiedAt) return res.json({ success: true, message: 'Email already confirmed' });
  if (!mfaUtils.isEmailConfigured()) return res.status(503).json({ message: 'Email service not configured' });
  await sendVerification(req.user);
  res.json({ success: true, message: 'Verification email sent' });
});

// Always answers the same way so the endpoint cannot be used to discover accounts
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Valid email is required' });
  const user = await User.findOne({ where: { email: req.body.email } });
  if (user && user.isActive) {
    const token = await issueUserToken(user.id, 'password_reset');
    const result = await sendPasswordResetEmail(user, token);
    if (!result.success) logger.warn({ userId: user.id }, 'Password reset email not sent');
  }
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

router.post('/reset-password', [
  body('token').isString().notEmpty(),
  body('password').isString().notEmpty(),
], async (req, res) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ message: 'Token and new password are required' });
  const passwordValidation = validatePasswordStrength(req.body.password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      message: 'Password does not meet security requirements',
      errors: passwordValidation.errors.map(err => ({ field: 'password', message: err }))
    });
  }
  const userId = await consumeUserToken(req.body.token, 'password_reset');
  const user = userId && await User.findByPk(userId);
  if (!user) return res.status(400).json({ message: 'This link is invalid or has expired', code: 'INVALID_TOKEN' });

  // A reset link proves control of the inbox, so it also confirms the address
  await user.update({ password: req.body.password, emailVerifiedAt: user.emailVerifiedAt || new Date() });
  await revokeUserSessions(user.id);
  clearRefreshCookie(res);
  try {
    await sendSecurityAlert(user, 'Password Reset', req.ip);
  } catch (emailError) {
    logger.warn({ err: emailError }, 'Failed to send password reset notification');
  }
  res.json({ success: true, message: 'Password updated. Please sign in.' });
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      user: req.user.toJSON(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Profile fetch error');
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

    for (const [field, label] of [['firstName', 'First name'], ['lastName', 'Last name']]) {
      if (req.body[field] === undefined) continue;
      const check = validateName(String(req.body[field]), label);
      const problems = detectSuspiciousInput(String(req.body[field])) ? ['Invalid input detected'] : check.errors;
      if (problems.length) {
        return res.status(400).json({
          message: `${label} validation failed`,
          errors: problems.map(message => ({ field, message }))
        });
      }
    }

    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
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
    logger.error({ err: error }, 'Profile update error');
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

    await req.user.update({ password: newPassword });
    // Keep this device signed in, end every other session
    await revokeUserSessions(req.user.id, { except: req.sessionId });
    logger.info({ userId: req.user.id }, 'Password changed');

    // Send security alert email
    try {
      await sendSecurityAlert(
        req.user, 
        'Password Changed', 
        req.ip || req.connection.remoteAddress
      );
    } catch (emailError) {
      logger.error({ err: emailError }, 'Failed to send password change notification');
      // Don't fail the password change if email fails
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error({ err: error }, 'Change password error');
    res.status(500).json({ 
      message: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
});

module.exports = router; 