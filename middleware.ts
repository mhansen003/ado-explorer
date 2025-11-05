/**
 * Authentication Middleware
 * Protects all routes except login and auth APIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from './lib/auth/jwt';
import { AUTH_CONFIG } from './lib/auth/config';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
];

// Route prefixes that should bypass authentication
const PUBLIC_PREFIXES = [
  '/_next',       // Next.js internals
  '/favicon',     // Favicons
  '/icon',        // Icons
  '/api/auth',    // All auth endpoints
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow public prefixes
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Check for authentication token
  const token = request.cookies.get(AUTH_CONFIG.COOKIE_NAME)?.value;

  if (!token) {
    console.log('[Middleware] No token found, redirecting to login:', pathname);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  const session = verifyAuthToken(token);

  if (!session) {
    console.log('[Middleware] Invalid token, redirecting to login:', pathname);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    // Clear invalid cookie
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(AUTH_CONFIG.COOKIE_NAME, '', { maxAge: 0 });
    return response;
  }

  // Valid session - allow access
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// Use Node.js runtime for JWT compatibility
export const runtime = 'nodejs';
