/**
 * Email and OTP Management
 * Handles OTP generation and email delivery via SMTP
 */

import nodemailer from 'nodemailer';
import { AUTH_CONFIG, EMAIL_CONFIG } from './config';

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and configure email transporter
 */
export function createEmailTransporter() {
  if (!EMAIL_CONFIG.SMTP_USER || !EMAIL_CONFIG.SMTP_PASS) {
    throw new Error('SMTP credentials not configured');
  }

  return nodemailer.createTransport({
    host: EMAIL_CONFIG.SMTP_HOST,
    port: EMAIL_CONFIG.SMTP_PORT,
    secure: false, // Use STARTTLS
    auth: {
      user: EMAIL_CONFIG.SMTP_USER,
      pass: EMAIL_CONFIG.SMTP_PASS,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

/**
 * Send OTP verification email with ADO Explorer branding
 */
export async function sendOTPEmail(email: string, code: string): Promise<void> {
  const transporter = createEmailTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0f1419;
      color: #d1d5db;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px 12px 0 0;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #d1fae5;
      font-size: 14px;
    }
    .content {
      background-color: #1a1f2e;
      border: 1px solid #2d3748;
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 40px 32px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 24px;
      color: #f3f4f6;
    }
    .code-box {
      background: linear-gradient(135deg, #1e3a28 0%, #1a2e26 100%);
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      margin: 32px 0;
    }
    .code {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #10b981;
      font-family: 'Courier New', monospace;
      margin-bottom: 12px;
    }
    .expiry {
      color: #9ca3af;
      font-size: 14px;
    }
    .instructions {
      font-size: 15px;
      line-height: 1.6;
      margin: 24px 0;
      color: #d1d5db;
    }
    .warning {
      background-color: #7c2d12;
      border-left: 4px solid #ea580c;
      padding: 16px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .warning-title {
      font-weight: 600;
      color: #fed7aa;
      margin-bottom: 8px;
    }
    .warning-text {
      font-size: 14px;
      color: #fed7aa;
      line-height: 1.5;
    }
    .footer {
      text-align: center;
      padding: 24px;
      color: #6b7280;
      font-size: 13px;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 ADO Explorer</h1>
      <p>Secure Access Verification</p>
    </div>
    <div class="content">
      <div class="greeting">
        Hello,
      </div>
      <div class="instructions">
        You requested access to <strong>ADO Explorer</strong>. Use the verification code below to complete your login:
      </div>
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="expiry">Valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes</div>
      </div>
      <div class="instructions">
        Enter this code in the login page to access your account. If you didn't request this code, you can safely ignore this email.
      </div>
      <div class="warning">
        <div class="warning-title">⚠️ Security Notice</div>
        <div class="warning-text">
          Never share this code with anyone. ADO Explorer staff will never ask for your verification code.
        </div>
      </div>
    </div>
    <div class="footer">
      This email was sent to <strong>${email}</strong><br>
      ADO Explorer - Azure DevOps Work Item Management<br>
      © ${new Date().getFullYear()} CMG Financial. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
ADO Explorer - Access Verification

Your verification code: ${code}

This code is valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes.

Enter this code in the login page to access your account.

If you didn't request this code, you can safely ignore this email.

SECURITY NOTICE:
Never share this code with anyone. ADO Explorer staff will never ask for your verification code.

---
This email was sent to ${email}
ADO Explorer - Azure DevOps Work Item Management
© ${new Date().getFullYear()} CMG Financial. All rights reserved.
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.SMTP_USER}>`,
      to: email,
      subject: 'Your ADO Explorer Access Code',
      html: htmlContent,
      text: textContent,
    });

    console.log(`[Auth Email] OTP sent to ${email}`);
  } catch (error) {
    console.error('[Auth Email] Failed to send OTP:', error);
    throw new Error('Failed to send verification email');
  }
}
