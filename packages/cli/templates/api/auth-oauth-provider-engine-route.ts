/**
 * OAuth Initiation Route (Engine project: My Apps sign-in)
 *
 * GET /api/auth/oauth/my-apps
 *
 * Starts the authorization-code flow with My Apps for an Engine project:
 * 1. Accepts only the `my-apps` provider (the Engine trusts no other issuer)
 * 2. Checks the OAUTH_* and Engine environment
 * 3. Makes a random `state`, a raw nonce and a PKCE verifier, and keeps them
 *    in one httpOnly cookie for the callback
 * 4. Redirects to My Apps' authorize endpoint with `nonce` = SHA-256 hex of
 *    the raw nonce (the callback passes the raw nonce to the Engine)
 *
 * Query params:
 *   - returnTo: path to open after sign-in (default: '/')
 *
 * Installed by the `external-oauth-engine` lib module, which `buildpad add
 * external-oauth` selects when `.buildpad/project.json` says the backend is
 * the Engine.
 *
 * @buildpad/origin: external-oauth-engine/auth-oauth-provider
 * @buildpad/version: 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGenericOAuthConfig } from '@/lib/oauth/config';
import {
  ENGINE_FLOW_COOKIE,
  MY_APPS_PROVIDER,
  codeChallengeOf,
  createEngineFlowState,
  encodeFlowState,
  flowCookieOptions,
  hashNonce,
  readEngineEnv,
} from '@/lib/oauth/engine';
import { publicOrigin, safeRelativePath } from '@/lib/origin';

/** The variables the Platform stores for a connected My Apps connector. */
const REQUIRED_OAUTH_ENV = [
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_AUTHORIZATION_URL',
  'OAUTH_TOKEN_URL',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== MY_APPS_PROVIDER) {
    return NextResponse.json(
      {
        error: 'unsupported_provider',
        message: `On an Engine project only My Apps sign-in is available (/api/auth/oauth/${MY_APPS_PROVIDER}).`,
      },
      { status: 400 }
    );
  }

  const missing: string[] = REQUIRED_OAUTH_ENV.filter((name) => !process.env[name]);
  missing.push(...readEngineEnv().missing);
  if (missing.length > 0) {
    // Names only: never log a value.
    console.error('My Apps sign-in is not configured. Missing:', missing.join(', '));
    return NextResponse.json(
      {
        error: 'configuration_error',
        message: `My Apps sign-in is not configured. Missing: ${missing.join(', ')}`,
      },
      { status: 500 }
    );
  }

  try {
    const config = getGenericOAuthConfig();
    // Must be the app's real public origin: this exact string is sent to My
    // Apps as `redirect_uri`, matched against the registered URI, and sent
    // again by the callback during the code exchange.
    const origin = publicOrigin(request);
    const redirectUri = `${origin}/api/auth/callback`;
    const returnTo = safeRelativePath(request.nextUrl.searchParams.get('returnTo'));

    const flow = createEngineFlowState(returnTo);

    const authUrl = new URL(config.authorizationUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', flow.state);
    authUrl.searchParams.set('nonce', hashNonce(flow.nonce));
    authUrl.searchParams.set('code_challenge', codeChallengeOf(flow.codeVerifier));
    authUrl.searchParams.set('code_challenge_method', 'S256');
    if (config.authParams) {
      for (const [key, value] of Object.entries(config.authParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(ENGINE_FLOW_COOKIE, encodeFlowState(flow), flowCookieOptions);
    return response;
  } catch (error) {
    console.error('My Apps sign-in could not start:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json(
      { error: 'oauth_error', message: 'My Apps sign-in could not start' },
      { status: 500 }
    );
  }
}
