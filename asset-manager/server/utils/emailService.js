const nodemailer = require('nodemailer');

// Email transporter configuration
let transporter = null;

const initializeEmailService = () => {
  if (!process.env.EMAIL_HOST) {
    console.warn('Email service not configured - skipping email notifications');
    return;
  }

  try {
    transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize email service:', error);
  }
};

// Initialize on module load
initializeEmailService();

// Email templates
const emailTemplates = {
  securityAlert: (data) => ({
    subject: '🔒 Security Alert - MoneyMind',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #dc3545; margin: 0 0 20px 0;">🔒 Security Alert</h2>
          <p>Hello ${data.userName},</p>
          <p>We detected important security activity on your MoneyMind account:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Activity:</strong> ${data.activity}<br>
            <strong>Time:</strong> ${data.timestamp}<br>
            <strong>IP Address:</strong> ${data.ipAddress || 'Unknown'}<br>
            ${data.location ? `<strong>Location:</strong> ${data.location}<br>` : ''}
          </div>
          <p>If this was you, no action is needed. If you don't recognize this activity, please:</p>
          <ul>
            <li>Change your password immediately</li>
            <li>Review your account activity</li>
            <li>Contact support if you need assistance</li>
          </ul>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This is an automated security notification from MoneyMind.
          </p>
        </div>
      </div>
    `
  }),

  investmentUpdate: (data) => ({
    subject: '📈 Investment Update - MoneyMind',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #28a745; margin: 0 0 20px 0;">📈 Investment Update</h2>
          <p>Hello ${data.userName},</p>
          <p>Here's an update on your investment activity:</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Activity:</strong> ${data.activity}<br>
            <strong>Investment:</strong> ${data.investmentName}<br>
            <strong>Amount:</strong> $${data.amount}<br>
            <strong>Date:</strong> ${data.date}<br>
          </div>
          ${data.portfolioValue ? `
            <p><strong>Current Portfolio Value:</strong> $${data.portfolioValue}</p>
          ` : ''}
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            You can manage your notification preferences in your MoneyMind account settings.
          </p>
        </div>
      </div>
    `
  }),

  generalNotification: (data) => ({
    subject: `📧 ${data.subject} - MoneyMind`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #007bff; margin: 0 0 20px 0;">📧 ${data.subject}</h2>
          <p>Hello ${data.userName},</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            ${data.content}
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This notification was sent from your MoneyMind account.
          </p>
        </div>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data) => {
  if (!transporter) {
    console.log('Email service not available - skipping email notification');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const emailContent = emailTemplates[template](data);
    
    const mailOptions = {
      from: `"MoneyMind" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, message: error.message };
  }
};

// Notification functions for different activities
const sendSecurityAlert = async (user, activity, ipAddress = null, location = null) => {
  if (!user.securityAlerts) {
    return { success: false, message: 'Security alerts disabled for user' };
  }

  return await sendEmail(user.email, 'securityAlert', {
    userName: `${user.firstName} ${user.lastName}`,
    activity,
    timestamp: new Date().toLocaleString(),
    ipAddress,
    location
  });
};

const sendInvestmentUpdate = async (user, activity, investmentName, amount, portfolioValue = null) => {
  if (!user.investmentUpdates) {
    return { success: false, message: 'Investment updates disabled for user' };
  }

  return await sendEmail(user.email, 'investmentUpdate', {
    userName: `${user.firstName} ${user.lastName}`,
    activity,
    investmentName,
    amount: amount.toLocaleString(),
    date: new Date().toLocaleDateString(),
    portfolioValue: portfolioValue ? portfolioValue.toLocaleString() : null
  });
};

const sendGeneralNotification = async (user, subject, content) => {
  if (!user.emailNotifications) {
    return { success: false, message: 'Email notifications disabled for user' };
  }

  return await sendEmail(user.email, 'generalNotification', {
    userName: `${user.firstName} ${user.lastName}`,
    subject,
    content
  });
};

module.exports = {
  sendSecurityAlert,
  sendInvestmentUpdate,
  sendGeneralNotification,
  sendEmail,
  initializeEmailService
}; 