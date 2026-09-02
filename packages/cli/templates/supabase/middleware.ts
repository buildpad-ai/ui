/**
 * Supabase Auth Middleware
 *
 * Refreshes auth tokens and protects routes.
 * This file is copied to your project by the Buildpad CLI.
 *
 * Routes are compared WITHOUT their locale prefix (`/id/login` → `/login`),
 * and unauthenticated users are sent to the login page of the locale they
 * were on.
 *
 * @buildpad/origin: supabase/middleware
 * @buildpad/version: 2.0.0
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicOrigin } from '@/lib/origin';
import { defaultLocale, getLocaleFromPathname, stripLocale } from '@/lib/i18n/config';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Allow request to proceed but log warning
    console.warn('Supabase not configured - auth middleware skipped');
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const locale = getLocaleFromPathname(pathname) ?? defaultLocale;
  // Compare routes without the locale prefix: "/id/login" gates like "/login".
  const path = stripLocale(pathname);

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/signup', '/auth', '/api/auth'];
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
  const isApiRoute = path.startsWith('/api');

  // Redirect unauthenticated users to login (except for public and API routes)
  if (!user && !isPublicRoute && !isApiRoute) {
    // Built from the resolved public origin, not `request.nextUrl`: behind a
    // proxy the latter names the server process, and middleware
    // redirects emit an absolute Location header. See lib/origin.ts.
    const url = new URL(`/${locale}/login`, publicOrigin(request));
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
