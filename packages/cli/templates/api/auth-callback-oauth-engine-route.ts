/**
 * Auth Callback Route (Engine project: XAppHub sign-in)
 *
 * GET /api/auth/callback
 *
 * Finishes XAppHub sign-in on an Engine project:
 * 1. Reads the flow cookie the provider route set, and checks `state`
 * 2. Exchanges the code at XAppHub's token endpoint, server-side, with the
 *    client secret (never sent to the browser or to the Engine)
 * 3. Signs in to the project's Engine with the ID token:
 *    `supabase.auth.signInWithIdToken({ provider: 'my-apps', token, nonce })`,
 *    `nonce` being the RAW nonce, on a client that sends `X-Tenant-Id`
 * 4. Sends an account that holds no role yet to /auth/pending-access, with
 *    its session ended, instead of into pages that would refuse it
 * 5. Otherwise sets the Supabase session cookies and redirects to `returnTo`
 *
 * The flow cookie is cleared on every answer. No token is ever logged.
 *
 * An Engine project has no service-role key, no administration API, no magic
 * link and no code exchange of its own; the app writes no role. An
 * administrator gives a new account its role in the Studio.
 *
 * Installed by the `external-oauth-engine` lib module.
 *
 * @buildpad/origin: external-oauth-engine/auth-callback
 * @buildpad/version: 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGenericOAuthConfig } from '@/lib/oauth/config';
import {
  ENGINE_FLOW_COOKIE,
  MY_APPS_PROVIDER,
  createEngineSignInClient,
  decodeFlowState,
  flowCookieOptions,
  projectAccessOf,
  readEngineEnv,
  sameValue,
  signInErrorOf,
  type CookieToSet,
  type EngineSignInError,
} from '@/lib/oauth/engine';
import { publicOrigin, safeRelativePath } from '@/lib/origin';

const PENDING_ACCESS_PATH = '/auth/pending-access';

interface TokenResponse {
  id_token?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  // Redirect targets and the OAuth `redirect_uri` must be built from the
  // app's real public origin, never from `request.url` — see lib/origin.ts.
  const origin = publicOrigin(request);
  const searchParams = request.nextUrl.searchParams;

  /** Every answer clears the flow cookie: it is single-use. */
  const redirect = (path: string, cookies: CookieToSet[] = []) => {
    const response = NextResponse.redirect(new URL(path, origin));
    // Expired with the attributes it was set with: a `__Host-` cookie is only
    // replaced by a Set-Cookie that is also Secure with Path=/.
    response.cookies.set(ENGINE_FLOW_COOKIE, '', { ...flowCookieOptions, maxAge: 0 });
    for (const { name, value, options } of cookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  };
  const fail = (code: EngineSignInError) => redirect(`/login?error=${code}`);

  const providerError = searchParams.get('error');
  if (providerError) {
    // The provider's error code is not a secret; its description is not logged.
    console.warn('XAppHub sign-in: the provider answered', providerError);
    return fail(providerError === 'access_denied' ? 'sign_in_cancelled' : 'sign_in_failed');
  }

  const flow = decodeFlowState(request.cookies.get(ENGINE_FLOW_COOKIE)?.value);
  if (!flow) return fail('sign_in_expired');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state || !sameValue(state, flow.state)) {
    console.warn('XAppHub sign-in: missing code, or state mismatch');
    return fail('sign_in_failed');
  }

  const { env } = readEngineEnv();
  if (!env || !process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET || !process.env.OAUTH_TOKEN_URL) {
    console.error('XAppHub sign-in: the OAUTH_* or Engine environment is incomplete');
    return fail('configuration_error');
  }

  try {
    // ─── Code exchange with XAppHub (server-side) ────────────────────────
    const config = getGenericOAuthConfig();
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${origin}/api/auth/callback`,
        code_verifier: flow.codeVerifier,
      }),
      cache: 'no-store',
    });
    const tokens = (await tokenResponse.json().catch(() => ({}))) as TokenResponse;
    if (!tokenResponse.ok || tokens.error || !tokens.id_token) {
      console.warn('XAppHub sign-in: code exchange failed', tokenResponse.status, tokens.error ?? '');
      return fail('sign_in_failed');
    }

    // ─── Sign in to the Engine with the ID token ─────────────────────────
    const sessionCookies: CookieToSet[] = [];
    const supabase = createEngineSignInClient(env, () => request.cookies.getAll(), sessionCookies);
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: MY_APPS_PROVIDER,
      token: tokens.id_token,
      nonce: flow.nonce,
    });
    if (error || !data.session) {
      console.warn('XAppHub sign-in: the Engine refused', error?.status ?? '', error?.code ?? '');
      return fail(error ? signInErrorOf(error) : 'sign_in_failed');
    }

    // ─── An account with no role yet ─────────────────────────────────────
    // A first sign-in creates an account that holds no role: it may sign in
    // but reads nothing until an administrator gives it a role. End that
    // session and say so, rather than letting every page refuse it.
    if ((await projectAccessOf(env, data.session.access_token)) === 'pending') {
      await supabase.auth.signOut();
      return redirect(PENDING_ACCESS_PATH);
    }

    // ─── Session cookies, in the format lib/supabase/* reads ─────────────
    return redirect(safeRelativePath(flow.returnTo), sessionCookies);
  } catch (error) {
    console.error('XAppHub sign-in failed:', error instanceof Error ? error.message : 'unknown error');
    return fail('sign_in_failed');
  }
}
