/**
 * Send OTP API Route
 * Generates and emails a one-time password for authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { generateOTP, sendOTPEmail } from '@/lib/auth/email';
import { isValidCMGEmail } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';

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

    // Validate CMG domain
    if (!isValidCMGEmail(email)) {
      console.log('[Send OTP] Invalid domain:', email);
      return NextResponse.json(
        { success: false, error: `Only @${AUTH_CONFIG.ALLOWED_DOMAIN} emails are allowed` },
        { status: 403 }
      );
    }

    // Check rate limiting
    const rateLimitKey = getRateLimitKey(email);
    const requestCount = await kv.get<number>(rateLimitKey);

    if (requestCount && requestCount >= AUTH_CONFIG.MAX_REQUESTS_PER_WINDOW) {
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
    const newCount = (requestCount || 0) + 1;
    await kv.set(rateLimitKey, newCount, {
      ex: AUTH_CONFIG.RATE_LIMIT_WINDOW_MINUTES * 60, // Convert to seconds
    });

    // Generate OTP
    const code = generateOTP();
    console.log('[Send OTP] Generated code for:', email);

    // Store OTP in Redis
    const otpData: OTPData = {
      code,
      email,
      attempts: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    };

    await kv.set(getOTPKey(email), JSON.stringify(otpData), {
      ex: AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60, // Convert to seconds
    });

    // Send email
    await sendOTPEmail(email, code);

    console.log('[Send OTP] Email sent successfully to:', email);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${email}`,
    });

  } catch (error: any) {
    console.error('[Send OTP] Error:', error);

    // Check if it's an SMTP error
    if (error.message?.includes('SMTP') || error.message?.includes('send')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send verification email. Please check your email configuration.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send verification code',
      },
      { status: 500 }
    );
  }
}
