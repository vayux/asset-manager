const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { User } = require('../models');
const router = express.Router();

// Get user settings
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['emailNotifications', 'securityAlerts', 'investmentUpdates']
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        emailNotifications: user.emailNotifications ?? true,
        securityAlerts: user.securityAlerts ?? true,
        investmentUpdates: user.investmentUpdates ?? false
      }
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ 
      message: 'Failed to get notification settings',
      code: 'GET_SETTINGS_ERROR'
    });
  }
});

// Update notification settings
router.put('/notifications', authMiddleware, [
  body('emailNotifications').optional().isBoolean(),
  body('securityAlerts').optional().isBoolean(),
  body('investmentUpdates').optional().isBoolean(),
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

    const { emailNotifications, securityAlerts, investmentUpdates } = req.body;
    const updateData = {};

    // Only update provided fields
    if (typeof emailNotifications === 'boolean') {
      updateData.emailNotifications = emailNotifications;
    }
    if (typeof securityAlerts === 'boolean') {
      updateData.securityAlerts = securityAlerts;
    }
    if (typeof investmentUpdates === 'boolean') {
      updateData.investmentUpdates = investmentUpdates;
    }

    // Update user settings
    await req.user.update(updateData);

    // Log settings change
    console.log(`Notification settings updated for user: ${req.user.id}`, updateData);

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        emailNotifications: req.user.emailNotifications,
        securityAlerts: req.user.securityAlerts,
        investmentUpdates: req.user.investmentUpdates
      }
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({ 
      message: 'Failed to update notification settings',
      code: 'UPDATE_SETTINGS_ERROR'
    });
  }
});

module.exports = router; 