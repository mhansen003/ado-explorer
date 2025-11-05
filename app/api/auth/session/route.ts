/**
 * Session Check API Route
 * Returns current authentication status
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth/jwt';
import { AUTH_CONFIG } from '@/lib/auth/config';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const session = verifyAuthToken(token);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        issuedAt: session.issuedAt,
        expiresAt: session.expiresAt,
      },
    });

  } catch (error) {
    console.error('[Session] Error:', error);
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}
