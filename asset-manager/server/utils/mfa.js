const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

class MFAUtils {
  /**
   * Check if email configuration is available
   */
  isEmailConfigured() {
    return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }

  constructor() {
    // Gmail SMTP configuration - only create if email is configured
    this.emailTransporter = null;
    if (this.isEmailConfigured()) {
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, // App password, not regular password
        },
      });
    }
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
    const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return { otp, expiry };
  }

  /**
   * Send email OTP
   */
  async sendEmailOTP(email, otp, firstName = '') {
    if (!this.emailTransporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'MoneyMind - Login Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Login Verification</h2>
          <p>Hello ${firstName},</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            This is an automated message from MoneyMind. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    try {
      await this.emailTransporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Failed to send email OTP:', error);
      throw new Error('Failed to send verification email');
    }
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

    return inputOtp === storedOtp;
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