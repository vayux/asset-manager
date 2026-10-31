const express = require('express');
const router = express.Router();
const { User } = require('../models');
const auth = require('../middleware/auth');
const mfaUtils = require('../utils/mfa');
const { createOtpRateLimit } = require('../utils/validation');

const otpSendLimit = createOtpRateLimit(3);
const otpVerifyLimit = createOtpRateLimit(5);

// Get MFA status
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: {
        mfaEnabled: user.mfaEnabled,
        hasBackupCodes: !!(user.backupCodes && user.backupCodes.length > 0),
        backupCodesRemaining: user.backupCodes ? user.backupCodes.length : 0,
        emailConfigured: mfaUtils.isEmailConfigured()
      }
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get MFA status' 
    });
  }
});

// Setup TOTP - Generate secret and QR code
router.post('/setup/totp', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.mfaEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'MFA is already enabled' 
      });
    }

    // Generate new secret
    const { secret, otpauthUrl } = mfaUtils.generateTOTPSecret(user.email);
    const qrCode = await mfaUtils.generateQRCode(otpauthUrl);

    // Store secret temporarily (not enabled yet)
    await user.update({ mfaSecret: secret });

    res.json({
      success: true,
      data: {
        secret,
        qrCode,
        manualEntryKey: secret
      }
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to setup TOTP' 
    });
  }
});

// Verify TOTP and enable MFA
router.post('/setup/verify', auth, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'TOTP token is required' 
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user || !user.mfaSecret) {
      return res.status(400).json({ 
        success: false, 
        message: 'No MFA setup in progress' 
      });
    }

    // Verify token
    const isValid = mfaUtils.verifyTOTP(token, user.mfaSecret);
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid TOTP token' 
      });
    }

    // Generate backup codes
    const backupCodes = mfaUtils.generateBackupCodes();

    // Enable MFA
    await user.update({
      mfaEnabled: true,
      backupCodes
    });

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      data: {
        backupCodes
      }
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify MFA setup' 
    });
  }
});

// Disable MFA
router.post('/disable', auth, async (req, res) => {
  try {
    const { password, token } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to disable MFA' 
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Verify password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    // If MFA is enabled, require token or backup code
    if (user.mfaEnabled) {
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'TOTP token or backup code required' 
        });
      }

      // Try TOTP first
      let isValid = false;
      if (user.mfaSecret) {
        isValid = mfaUtils.verifyTOTP(token, user.mfaSecret);
      }

      // Try backup code if TOTP failed
      if (!isValid && user.backupCodes) {
        const backupResult = mfaUtils.verifyBackupCode(token, user.backupCodes);
        if (backupResult.valid) {
          isValid = true;
          // Update remaining backup codes
          await user.update({ backupCodes: backupResult.remainingCodes });
        }
      }

      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid TOTP token or backup code' 
        });
      }
    }

    // Disable MFA
    await user.update({
      mfaEnabled: false,
      mfaSecret: null,
      backupCodes: null,
      emailOtpSecret: null,
      emailOtpExpiry: null
    });

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to disable MFA' 
    });
  }
});

// Generate new backup codes
router.post('/backup-codes/regenerate', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required' 
      });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.mfaEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'MFA is not enabled' 
      });
    }

    // Verify password
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }

    // Generate new backup codes
    const backupCodes = mfaUtils.generateBackupCodes();
    await user.update({ backupCodes });

    res.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes
      }
    });
  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to regenerate backup codes' 
    });
  }
});

// Send email OTP (for login)
router.post('/email-otp/send', otpSendLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    if (!mfaUtils.isEmailConfigured()) {
      return res.status(503).json({ 
        success: false, 
        message: 'Email service not configured' 
      });
    }

    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If the email exists, an OTP has been sent'
      });
    }

    // Generate and send OTP
    const { otp, expiry } = mfaUtils.generateEmailOTP();
    await mfaUtils.sendEmailOTP(email, otp, user.firstName);

    // Store OTP hash
    const otpHash = mfaUtils.hashSecret(otp);
    await user.update({
      emailOtpSecret: otpHash,
      emailOtpExpiry: expiry
    });

    res.json({
      success: true,
      message: 'OTP sent to your email'
    });
  } catch (error) {
    console.error('Email OTP send error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email OTP' 
    });
  }
});

// Verify email OTP (for login)
router.post('/email-otp/verify', otpVerifyLimit, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email or OTP' 
      });
    }

    // Verify OTP
    const otpHash = mfaUtils.hashSecret(otp);
    const isValid = mfaUtils.verifyEmailOTP(
      otpHash, 
      user.emailOtpSecret, 
      user.emailOtpExpiry
    );

    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP' 
      });
    }

    // Clear used OTP
    await user.update({
      emailOtpSecret: null,
      emailOtpExpiry: null
    });

    res.json({
      success: true,
      message: 'Email OTP verified successfully'
    });
  } catch (error) {
    console.error('Email OTP verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify email OTP' 
    });
  }
});

module.exports = router; 