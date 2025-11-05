/**
 * Authentication Configuration
 * Centralized constants for MFA and session management
 */

export const AUTH_CONFIG = {
  // OTP Settings
  OTP_LENGTH: 6,                        // 6-digit verification code
  OTP_EXPIRY_MINUTES: 5,                // Code valid for 5 minutes
  MAX_ATTEMPTS: 5,                      // Max OTP verification attempts

  // Rate Limiting
  RATE_LIMIT_WINDOW_MINUTES: 15,       // Rate limit window
  MAX_REQUESTS_PER_WINDOW: 20,         // Max OTP sends per window

  // Session Management
  SESSION_EXPIRY_HOURS: 120,           // JWT expiry (5 days)

  // Email Domain Restriction
  ALLOWED_DOMAIN: 'cmgfi.com',         // Only @cmgfi.com emails

  // Cookie Configuration
  COOKIE_NAME: 'ado_auth_token',       // Cookie name for JWT storage

  // Redis Keys
  REDIS_PREFIX: {
    OTP: 'ado:otp:',                    // OTP storage key prefix
    RATE_LIMIT: 'ado:ratelimit:',       // Rate limiting key prefix
  },
} as const;

/**
 * Email configuration from environment
 */
export const EMAIL_CONFIG = {
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587'),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  FROM_NAME: 'ADO Explorer',
};

/**
 * Validate required environment variables
 */
export function validateAuthEnv(): { valid: boolean; missing: string[] } {
  const required = ['JWT_SECRET', 'REDIS_URL', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}
