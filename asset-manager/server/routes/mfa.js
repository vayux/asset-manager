const express = require('express');
const router = express.Router();
const { User } = require('../models');
const auth = require('../middleware/auth');
const mfaUtils = require('../utils/mfa');
const { createRateLimit } = require('../utils/validation');

// Every MFA route verifies a password or TOTP code, so throttle failures per client
router.use(createRateLimit({ max: 20, skipSuccessfulRequests: true, message: 'Too many MFA attempts. Please try again later.' }));

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

module.exports = router; 