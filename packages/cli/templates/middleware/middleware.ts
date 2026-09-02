/**
 * Next.js Middleware
 *
 * Root middleware file that (1) redirects locale-less page requests to the
 * negotiated locale and (2) refreshes the auth session.
 * This file is copied to your project by the Buildpad CLI.
 *
 * The locale redirect runs BEFORE `updateSession`, so it never discards a
 * refreshed session cookie; the prefixed request that follows goes through
 * the full session refresh. `/api/*` is never prefixed.
 *
 * Next.js 16 also accepts this file as `proxy.ts` (`export default async
 * function proxy`) — the body is identical. Keep exactly one of the two.
 *
 * @buildpad/origin: middleware
 * @buildpad/version: 2.0.0
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { publicOrigin } from '@/lib/origin';
import { getLocaleFromPathname } from '@/lib/i18n/config';
import { negotiateLocale } from '@/lib/i18n/negotiate';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Page request without a locale prefix → redirect to the negotiated locale.
  if (!pathname.startsWith('/api') && !getLocaleFromPathname(pathname)) {
    const locale = negotiateLocale(request);
    // Built from the resolved public origin, not `request.nextUrl`: behind a
    // proxy the latter names the server process, and redirects emit an
    // absolute Location header. See lib/origin.ts.
    const url = new URL(`/${locale}${pathname === '/' ? '' : pathname}`, publicOrigin(request));
    url.search = search;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Cache-Control', 'private, no-store, must-revalidate');
    redirect.headers.set('Vary', 'Accept-Language, Cookie');
    return redirect;
  }

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
     * - public folder assets (images, fonts, text/xml files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)',
  ],
};
