const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const emailService = require('./emailService');

class MFAUtils {
  isEmailConfigured() {
    return emailService.isEmailConfigured();
  }

  /**
   * Generate a new TOTP secret for a user
   */
  generateTOTPSecret(userEmail, serviceName = 'MoneyMind') {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: serviceName,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  /**
   * Generate QR code for TOTP setup
   */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataURL;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify TOTP token
   */
  verifyTOTP(token, secret, window = 2) {
    try {
      // Clean the token input (remove spaces, etc.)
      const cleanToken = token.toString().replace(/\s/g, '');
      
      return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: cleanToken,
        window: window, // Allow 2 steps before/after for clock drift
      });
    } catch (error) {
      console.error('TOTP verification error:', error);
      return false;
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(inputCode, backupCodes) {
    if (!backupCodes || !Array.isArray(backupCodes)) {
      return { valid: false, remainingCodes: null };
    }

    const normalizedInput = inputCode.toUpperCase().replace(/\s/g, '');
    const codeIndex = backupCodes.indexOf(normalizedInput);

    if (codeIndex === -1) {
      return { valid: false, remainingCodes: backupCodes };
    }

    // Remove used code
    const remainingCodes = backupCodes.filter((_, index) => index !== codeIndex);
    return { valid: true, remainingCodes };
  }

  /**
   * Generate email OTP
   */
  generateEmailOTP() {
    const otp = crypto.randomInt(100000, 1000000).toString(); // 6-digit OTP
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { otp, expiry };
  }

  async sendEmailOTP(user, otp) {
    return emailService.sendLoginOtp(user, otp);
  }

  /**
   * Verify email OTP
   */
  verifyEmailOTP(inputOtp, storedOtp, expiry) {
    if (!storedOtp || !expiry) {
      return false;
    }

    if (new Date() > new Date(expiry)) {
      return false; // Expired
    }

    const input = Buffer.from(String(inputOtp), 'utf8');
    const stored = Buffer.from(String(storedOtp), 'utf8');
    return input.length === stored.length && crypto.timingSafeEqual(input, stored);
  }

  /**
   * Hash sensitive data for storage
   */
  hashSecret(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

module.exports = new MFAUtils(); 