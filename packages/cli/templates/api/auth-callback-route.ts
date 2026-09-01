/**
 * Auth Callback Route
 *
 * GET /api/auth/callback
 *
 * Handles OAuth callback and email confirmation redirects.
 * Exchanges the auth code for a session server-side.
 *
 * Note: For external OAuth providers (Azure AD, Google, Okta, Auth0, custom OIDC),
 * install the `external-oauth` lib module which replaces this file with an
 * enhanced version supporting PKCE, JIT user provisioning, and multi-source claims.
 *
 * @buildpad/origin: api-routes/auth-callback
 * @buildpad/version: 1.1.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { publicOrigin, safeRelativePath } from '@/lib/origin';

/**
 * GET /api/auth/callback
 *
 * Handles the Supabase OAuth/magic link redirect callback.
 * Exchanges the code for a session and redirects to the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  // `next` is attacker-supplied: constrain it to a path on this app.
  const next = safeRelativePath(searchParams.get('next'));
  // Behind a proxy `request.nextUrl.origin` names the server process, not the
  // address the browser used — see lib/origin.ts.
  const origin = publicOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Auth code exchange failed -- redirect to login with error
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin));
}
