/**
 * Auth Token API Route
 *
 * Returns the access token of the signed-in user's server session. The
 * middleware has just refreshed that session from its cookie, so the token is
 * valid even when the browser's own copy has expired or is missing (a tab left
 * idle past the token's lifetime). DaaSProviderWrapper asks this route through
 * `lib/daas-token` whenever the browser token cannot be used, so direct DaaS
 * calls keep working without a page reload.
 *
 * The token goes only to the signed-in user's own browser, which already holds
 * it in the session cookie: this route exposes nothing new.
 *
 * @buildpad/origin: api-routes/auth-token
 * @buildpad/version: 1.0.0
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store, must-revalidate' };

/**
 * GET /api/auth/token
 *
 * `{ access_token, expires_at }` for a signed-in user, 401 otherwise.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    // getUser() checks the session with the auth server; getSession() then
    // returns the (already refreshed) token of that verified session.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401, headers: NO_STORE }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      { access_token: session.access_token, expires_at: session.expires_at ?? null },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { errors: [{ message: 'Could not read the session' }] },
      { status: 500, headers: NO_STORE }
    );
  }
}
