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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #0D0D0D;
      color: #ffffff;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: linear-gradient(to bottom right, #1a1a1a, #0d0d0d);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #0D0D0D;
      font-size: 24px;
      font-weight: bold;
    }
    .content {
      padding: 40px 30px;
    }
    .code-box {
      background: rgba(16, 185, 129, 0.1);
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .code {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #10b981;
      font-family: 'Courier New', monospace;
    }
    .warning {
      background: rgba(239, 68, 68, 0.1);
      border-left: 4px solid #ef4444;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background: rgba(255, 255, 255, 0.05);
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    a {
      color: #10b981;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 ADO Explorer</h1>
    </div>
    <div class="content">
      <h2 style="color: #10b981; margin-top: 0;">Your Access Code</h2>
      <p>Hello! Someone requested access to ADO Explorer using this email address.</p>

      <div class="code-box">
        <div style="color: #999; font-size: 12px; margin-bottom: 10px;">VERIFICATION CODE</div>
        <div class="code">${code}</div>
        <div style="color: #999; font-size: 12px; margin-top: 10px;">Valid for ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes</div>
      </div>

      <p>Enter this code on the login page to access your dashboard.</p>

      <div class="warning">
        <strong>⚠️ Security Notice:</strong><br>
        • This code expires in ${AUTH_CONFIG.OTP_EXPIRY_MINUTES} minutes<br>
        • You have ${AUTH_CONFIG.MAX_ATTEMPTS} attempts to enter it correctly<br>
        • If you didn't request this code, please ignore this email
      </div>

      <p style="margin-top: 30px; color: #999; font-size: 14px;">
        Questions? Contact your IT administrator.
      </p>
    </div>
    <div class="footer">
      <p>CMG Financial | ADO Explorer - Azure DevOps Work Item Management</p>
      <p>This is an automated message. Please do not reply to this email.</p>
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
