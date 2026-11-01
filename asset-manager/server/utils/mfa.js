const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { Op } = require('sequelize');
const emailService = require('./emailService');
const { keyedHash, safeEqual } = require('./secretBox');

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
   * Time step of a valid TOTP code, or null. One step of clock drift either way is accepted.
   */
  verifyTOTPStep(token, secret, window = 1) {
    if (!secret) return null;
    const result = speakeasy.totp.verifyDelta({
      secret,
      encoding: 'base32',
      token: String(token).replace(/\s/g, ''),
      window,
    });
    if (!result) return null;
    return Math.floor(Date.now() / 1000 / 30) + result.delta;
  }

  /**
   * Accepts a TOTP code at most once: the step must be newer than the last one used.
   * The conditional update makes concurrent requests with the same code race safely.
   */
  async consumeTOTP(user, token) {
    const step = this.verifyTOTPStep(token, user.mfaSecret);
    if (step === null) return false;
    const [count] = await user.constructor.update({ mfaLastUsedStep: step }, {
      where: {
        id: user.id,
        [Op.or]: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { [Op.lt]: step } }],
      },
    });
    if (count === 1) user.setDataValue('mfaLastUsedStep', step);
    return count === 1;
  }

  normalizeBackupCode(code) {
    return String(code).toUpperCase().replace(/\s/g, '');
  }

  /**
   * Generate backup codes (shown once; store only hashBackupCodes(codes))
   */
  generateBackupCodes(count = 8) {
    return Array.from({ length: count }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
  }

  hashBackupCodes(codes) {
    return codes.map((code) => keyedHash(this.normalizeBackupCode(code)));
  }

  /**
   * Verify a backup code against stored hashes and return the hashes left after using it
   */
  verifyBackupCode(inputCode, hashedCodes) {
    if (!Array.isArray(hashedCodes)) {
      return { valid: false, remainingCodes: null };
    }
    const inputHash = keyedHash(this.normalizeBackupCode(inputCode));
    const codeIndex = hashedCodes.findIndex((hash) => safeEqual(hash, inputHash));
    if (codeIndex === -1) {
      return { valid: false, remainingCodes: hashedCodes };
    }
    return { valid: true, remainingCodes: hashedCodes.filter((_, index) => index !== codeIndex) };
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