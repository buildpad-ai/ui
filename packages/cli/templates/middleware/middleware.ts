/**
 * Next.js Middleware
 * 
 * Root middleware file that handles auth session refresh.
 * This file is copied to your project by the Buildpad CLI.
 * 
 * @buildpad/origin: middleware
 * @buildpad/version: 1.0.0
 */

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  // Every response here depends on session state, so it must never be
  // stored by a shared cache (e.g. CloudFront) — otherwise one user's
  // authenticated page can be served to the next visitor.
  response.headers.set('Cache-Control', 'private, no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
