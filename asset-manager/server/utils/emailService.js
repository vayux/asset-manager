const nodemailer = require('nodemailer');

let transporter = null;
let fromAddress = null;

// One mailer for alerts and OTPs. EMAIL_* (any SMTP server) takes precedence; GMAIL_* is still accepted.
const initializeEmailService = () => {
  transporter = null;
  if (process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    fromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER;
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn('Email service not configured - skipping email notifications');
  }
};

initializeEmailService();

const isEmailConfigured = () => transporter !== null;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const layout = (heading, color, body, footer) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
      <h2 style="color: ${color}; margin: 0 0 20px 0;">${heading}</h2>
      ${body}
      <p style="margin-top: 30px; font-size: 12px; color: #666;">${footer}</p>
    </div>
  </div>
`;

const box = (content) => `<div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">${content}</div>`;

const emailTemplates = {
  securityAlert: (data) => ({
    subject: 'Security Alert - MoneyMind',
    html: layout('Security Alert', '#dc3545', `
      <p>Hello ${escapeHtml(data.userName)},</p>
      <p>We detected important security activity on your MoneyMind account:</p>
      ${box(`
        <strong>Activity:</strong> ${escapeHtml(data.activity)}<br>
        <strong>Time:</strong> ${escapeHtml(data.timestamp)}<br>
        <strong>IP Address:</strong> ${escapeHtml(data.ipAddress || 'Unknown')}<br>
        ${data.location ? `<strong>Location:</strong> ${escapeHtml(data.location)}<br>` : ''}
      `)}
      <p>If this was you, no action is needed. If you don't recognize this activity, change your password immediately and review your account activity.</p>
    `, 'This is an automated security notification from MoneyMind.'),
  }),

  investmentUpdate: (data) => ({
    subject: 'Investment Update - MoneyMind',
    html: layout('Investment Update', '#28a745', `
      <p>Hello ${escapeHtml(data.userName)},</p>
      <p>Here's an update on your investment activity:</p>
      ${box(`
        <strong>Activity:</strong> ${escapeHtml(data.activity)}<br>
        <strong>Investment:</strong> ${escapeHtml(data.investmentName)}<br>
        <strong>Amount:</strong> ${formatINR(data.amount)}<br>
        <strong>Date:</strong> ${escapeHtml(data.date)}<br>
      `)}
      ${data.portfolioValue != null ? `<p><strong>Current Portfolio Value:</strong> ${formatINR(data.portfolioValue)}</p>` : ''}
    `, 'You can manage your notification preferences in your MoneyMind account settings.'),
  }),

  generalNotification: (data) => ({
    subject: `${data.subject} - MoneyMind`,
    html: layout(escapeHtml(data.subject), '#007bff', `
      <p>Hello ${escapeHtml(data.userName)},</p>
      ${box(escapeHtml(data.content).replace(/\n/g, '<br>'))}
    `, 'This notification was sent from your MoneyMind account.'),
  }),

  loginOtp: (data) => ({
    subject: 'MoneyMind - Login Verification Code',
    html: layout('Login Verification', '#333', `
      <p>Hello ${escapeHtml(data.firstName)},</p>
      <p>Your verification code is:</p>
      <div style="background-color: #fff; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${escapeHtml(data.otp)}</h1>
      </div>
      <p>This code will expire in 10 minutes. If you didn't request it, change your password.</p>
    `, 'This is an automated message from MoneyMind. Please do not reply to this email.'),
  }),
};

const sendEmail = async (to, template, data) => {
  if (!transporter) {
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const { subject, html } = emailTemplates[template](data);
    const result = await transporter.sendMail({ from: `"MoneyMind" <${fromAddress}>`, to, subject, html });
    return { success: true, messageId: result?.messageId };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { success: false, message: error.message };
  }
};

const fullName = (user) => `${user.firstName} ${user.lastName}`;

const sendSecurityAlert = async (user, activity, ipAddress = null, location = null) => {
  if (!user.securityAlerts) {
    return { success: false, message: 'Security alerts disabled for user' };
  }
  return sendEmail(user.email, 'securityAlert', {
    userName: fullName(user),
    activity,
    timestamp: new Date().toLocaleString('en-IN', { timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata' }),
    ipAddress,
    location,
  });
};

const sendInvestmentUpdate = async (user, activity, investmentName, amount, portfolioValue = null) => {
  if (!user.investmentUpdates) {
    return { success: false, message: 'Investment updates disabled for user' };
  }
  return sendEmail(user.email, 'investmentUpdate', {
    userName: fullName(user),
    activity,
    investmentName,
    amount,
    date: new Date().toLocaleDateString('en-IN'),
    portfolioValue,
  });
};

const sendGeneralNotification = async (user, subject, content) => {
  if (!user.emailNotifications) {
    return { success: false, message: 'Email notifications disabled for user' };
  }
  return sendEmail(user.email, 'generalNotification', { userName: fullName(user), subject, content });
};

const sendLoginOtp = async (user, otp) => {
  const result = await sendEmail(user.email, 'loginOtp', { firstName: user.firstName, otp });
  if (!result.success) {
    throw new Error('Failed to send verification email');
  }
  return result;
};

// Lets tests swap in a fake transport
const setTransporterForTesting = (fake) => {
  transporter = fake;
  fromAddress = fake ? 'test@example.com' : null;
};

module.exports = {
  sendSecurityAlert,
  sendInvestmentUpdate,
  sendGeneralNotification,
  sendLoginOtp,
  sendEmail,
  initializeEmailService,
  isEmailConfigured,
  escapeHtml,
  formatINR,
  setTransporterForTesting,
};
