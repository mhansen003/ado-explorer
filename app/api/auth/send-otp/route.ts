/**
 * Send OTP API Route
 * Generates and emails a one-time password for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { generateOTP, sendOTPEmail } from '@/lib/auth/email';
import { isValidCMGEmail } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';

// Lazy load Redis client
const getRedis = async () => {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL not configured');
  }

  try {
    const client = createClient({
      url: process.env.REDIS_URL,
    });

    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

interface OTPData {
  code: string;
  email: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
}

/**
 * Get Redis key for OTP storage
 */
function getOTPKey(email: string): string {
  return `${AUTH_CONFIG.REDIS_PREFIX.OTP}${email.toLowerCase()}`;
}

/**
 * Get Redis key for rate limiting
 */
function getRateLimitKey(email: string): string {
  return `${AUTH_CONFIG.REDIS_PREFIX.RATE_LIMIT}${email.toLowerCase()}`;
}

export async function POST(request: NextRequest) {
  let redis = null;

  try {
    const body = await request.json();
    const { email } = body;

    console.log('[Send OTP] Request for:', email);

    // Validate email format
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    // Validate CMG domain
    if (!isValidCMGEmail(emailLower)) {
      console.log('[Send OTP] Invalid domain:', email);
      return NextResponse.json(
        { success: false, error: `Only @${AUTH_CONFIG.ALLOWED_DOMAIN} emails are allowed` },
        { status: 403 }
      );
    }

    redis = await getRedis();

    // Check rate limiting
    const rateLimitKey = getRateLimitKey(emailLower);
    const requestCount = await redis.get(rateLimitKey);

    if (requestCount && parseInt(requestCount) >= AUTH_CONFIG.MAX_REQUESTS_PER_WINDOW) {
      console.log('[Send OTP] Rate limit exceeded:', email);
      return NextResponse.json(
        {
          success: false,
          error: `Too many requests. Please try again in ${AUTH_CONFIG.RATE_LIMIT_WINDOW_MINUTES} minutes.`,
        },
        { status: 429 }
      );
    }

    // Increment rate limit counter
    const newCount = requestCount ? parseInt(requestCount) + 1 : 1;
    await redis.set(
      rateLimitKey,
      newCount.toString(),
      { EX: AUTH_CONFIG.RATE_LIMIT_WINDOW_MINUTES * 60 }
    );

    // Generate OTP
    const code = generateOTP();
    console.log('[Send OTP] Generated code for:', email);

    // Store OTP in Redis
    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpData: OTPData = {
      code,
      email: emailLower,
      attempts: 0,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await redis.set(
      getOTPKey(emailLower),
      JSON.stringify(otpData),
      { EX: AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 }
    );

    // Send email
    try {
      await sendOTPEmail(emailLower, code);
      console.log('[Send OTP] Email sent successfully to:', email);
    } catch (emailError) {
      console.error('[Send OTP] Failed to send email:', emailError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send verification email. Please check your SMTP configuration.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${emailLower}`,
    });

  } catch (error: any) {
    console.error('[Send OTP] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        console.error('[Send OTP] Error closing Redis connection:', err);
      }
    }
  }
}
