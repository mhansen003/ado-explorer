/**
 * Verify OTP API Route
 * Validates one-time password and creates authenticated session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { createAuthToken } from '@/lib/auth/jwt';
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

export async function POST(request: NextRequest) {
  let redis = null;

  try {
    const body = await request.json();
    const { email, code } = body;

    console.log('[Verify OTP] Request for:', email);

    // Validate inputs
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email and code are required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();

    redis = await getRedis();

    // Get OTP data from Redis
    const otpKey = getOTPKey(emailLower);
    const otpDataStr = await redis.get(otpKey);

    if (!otpDataStr) {
      console.log('[Verify OTP] Code not found or expired:', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Verification code has expired or not found. Please request a new code.',
        },
        { status: 404 }
      );
    }

    const otpData: OTPData = JSON.parse(otpDataStr);

    // Check if code has expired
    if (new Date(otpData.expiresAt) < new Date()) {
      await redis.del(otpKey);
      console.log('[Verify OTP] Code expired:', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Verification code has expired. Please request a new code.',
        },
        { status: 410 }
      );
    }

    // Check maximum attempts
    if (otpData.attempts >= AUTH_CONFIG.MAX_ATTEMPTS) {
      await redis.del(otpKey);
      console.log('[Verify OTP] Max attempts exceeded:', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum verification attempts exceeded. Please request a new code.',
        },
        { status: 403 }
      );
    }

    // Verify code
    if (otpData.code !== code.trim()) {
      // Increment attempts
      otpData.attempts += 1;
      await redis.set(
        otpKey,
        JSON.stringify(otpData),
        { EX: AUTH_CONFIG.OTP_EXPIRY_MINUTES * 60 }
      );

      const attemptsRemaining = AUTH_CONFIG.MAX_ATTEMPTS - otpData.attempts;
      console.log('[Verify OTP] Invalid code:', email, `Attempts remaining: ${attemptsRemaining}`);

      return NextResponse.json(
        {
          success: false,
          error: `Invalid verification code. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining.`,
        },
        { status: 401 }
      );
    }

    // Success! Delete OTP and create session
    await redis.del(otpKey);
    console.log('[Verify OTP] Verification successful:', email);

    // Create JWT token
    const token = createAuthToken(emailLower);

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
      email: emailLower,
    });

    // Set httpOnly cookie
    response.cookies.set({
      name: AUTH_CONFIG.COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_CONFIG.SESSION_EXPIRY_HOURS * 60 * 60, // Convert to seconds
    });

    return response;

  } catch (error: any) {
    console.error('[Verify OTP] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify code',
      },
      { status: 500 }
    );
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        console.error('[Verify OTP] Error closing Redis connection:', err);
      }
    }
  }
}
