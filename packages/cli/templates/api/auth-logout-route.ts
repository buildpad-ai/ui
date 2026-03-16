/**
 * Auth Logout API Route (Proxy)
 *
 * Proxies logout requests through the Next.js server.
 * Clears the Supabase session cookie server-side.
 * When the user was authenticated via an external OAuth provider,
 * also returns / redirects to the IdP end-session URL (Single Logout / SLO).
 *
 * @buildpad/origin: api-routes/auth-logout
 * @buildpad/version: 1.1.0
 *
 * ## POST /api/auth/logout
 * JSON response — backward compatible. Includes `idpLogoutUrl` when the user
 * was signed in via an external OAuth provider. Callers SHOULD redirect the
 * browser to `idpLogoutUrl` when it is present to complete IdP SLO.
 *
 * ## GET /api/auth/logout
 * Browser-redirect mode. Signs out and immediately redirects the browser to
 * the IdP end-session URL (falling back to `/login`). Use this as the `href`
 * of a logout link when you want automatic SLO without custom client code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getProviderConfig, buildLogoutUrl } from '@/lib/oauth/config';

const PROVIDER_COOKIE_NAME = 'oauth_provider';

/**
 * Shared helper: sign out of Supabase, clear the provider cookie, and
 * return the IdP end-session URL (if applicable).
 */
async function performLogout(
  origin: string
): Promise<{ idpLogoutUrl: string | null; error: string | null }> {
  const supabase = await createClient();
  const cookieStore = await cookies();

  // Identify the provider before clearing cookies
  const provider = cookieStore.get(PROVIDER_COOKIE_NAME)?.value ?? null;

  // Sign out of Supabase (clears session cookies)
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Logout error:', error);
    return { idpLogoutUrl: null, error: error.message };
  }

  // Clear the provider tracking cookie
  cookieStore.delete(PROVIDER_COOKIE_NAME);

  // Build IdP end-session URL when the user came from an external provider
  let idpLogoutUrl: string | null = null;
  if (provider) {
    try {
      const config = getProviderConfig(provider);
      const postLogoutUri = `${origin}/login`;
      idpLogoutUrl = buildLogoutUrl(config, postLogoutUri);
      if (idpLogoutUrl) {
        console.log(`OAuth SLO: Sending user to ${provider} end-session endpoint`);
      }
    } catch (err) {
      // Provider config not found or misconfigured — non-fatal, just skip SLO
      console.warn(`OAuth SLO: Could not build logout URL for provider '${provider}':`, err);
    }
  }

  return { idpLogoutUrl, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout  (JSON — for fetch()-based callers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Signs out the current user and clears session cookies.
 * When the user authenticated via an external OAuth provider the response
 * includes `idpLogoutUrl`. Callers SHOULD redirect the browser to that URL
 * to complete Single Logout at the IdP.
 *
 * Response shape:
 * ```json
 * { "data": { "message": "Logged out successfully", "idpLogoutUrl": "https://..." | null } }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const { idpLogoutUrl, error } = await performLogout(origin);

    if (error) {
      return NextResponse.json(
        { errors: [{ message: error }] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { message: 'Logged out successfully', idpLogoutUrl },
    });
  } catch (error) {
    console.error('Unexpected logout error:', error);
    return NextResponse.json(
      { errors: [{ message: 'Failed to logout' }] },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/logout  (Redirect — for browser href / <a> logout links)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Browser-redirect logout. Signs out and redirects the browser to the IdP
 * end-session URL (or `/login` when no IdP SLO URL is available).
 *
 * Usage:
 * ```tsx
 * <a href="/api/auth/logout">Sign out</a>
 * // or
 * router.push('/api/auth/logout');
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const { idpLogoutUrl, error } = await performLogout(origin);

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Redirect to IdP end-session endpoint (SLO) or fall back to /login
    const destination = idpLogoutUrl ?? `${origin}/login`;
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error('Unexpected logout error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
