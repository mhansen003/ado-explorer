/**
 * User Settings API Route
 * Save and load user filter preferences in Redis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';
import { verifyAuthToken } from '@/lib/auth/jwt';
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

/**
 * Get Redis key for user settings
 */
function getUserSettingsKey(email: string): string {
  return `ado:settings:${email.toLowerCase()}`;
}

/**
 * GET - Load user settings
 */
export async function GET(request: NextRequest) {
  let redis = null;

  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = verifyAuthToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    redis = await getRedis();

    // Get user settings
    const settingsKey = getUserSettingsKey(session.email);
    const settingsStr = await redis.get(settingsKey);

    if (!settingsStr) {
      // Return default settings
      return NextResponse.json({
        success: true,
        settings: {},
      });
    }

    const settings = JSON.parse(settingsStr);

    return NextResponse.json({
      success: true,
      settings,
    });

  } catch (error: any) {
    console.error('[User Settings] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load settings',
      },
      { status: 500 }
    );
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        console.error('[User Settings] Error closing Redis:', err);
      }
    }
  }
}

/**
 * POST - Save user settings
 */
export async function POST(request: NextRequest) {
  let redis = null;

  try {
    // Verify authentication
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const session = verifyAuthToken(token);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings data' },
        { status: 400 }
      );
    }

    redis = await getRedis();

    // Save user settings (expires in 90 days)
    const settingsKey = getUserSettingsKey(session.email);
    await redis.set(
      settingsKey,
      JSON.stringify(settings),
      { EX: 90 * 24 * 60 * 60 } // 90 days
    );

    console.log('[User Settings] Settings saved for:', session.email);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });

  } catch (error: any) {
    console.error('[User Settings] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save settings',
      },
      { status: 500 }
    );
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch (err) {
        console.error('[User Settings] Error closing Redis:', err);
      }
    }
  }
}
