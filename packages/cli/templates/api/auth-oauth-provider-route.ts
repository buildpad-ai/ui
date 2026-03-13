/**
 * OAuth Initiation Route
 *
 * GET /api/auth/oauth/[provider]
 *
 * Initiates the OAuth PKCE flow:
 * 1. Validates the provider name
 * 2. Checks environment configuration
 * 3. Generates PKCE code verifier + challenge
 * 4. Encrypts OAuth state into a secure HttpOnly cookie
 * 5. Redirects the browser to the provider's authorization endpoint
 *
 * Supported providers: generic, azure, google, okta, auth0
 * Query params:
 *   - returnTo: URL to redirect after successful auth (default: '/')
 *
 * @buildpad/origin: api-routes/auth-oauth-provider
 * @buildpad/version: 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getProviderConfig,
  validateProviderEnv,
  type SupportedProvider,
} from '@/lib/oauth/config';
import {
  createOAuthState,
  encryptState,
  generateCodeChallenge,
} from '@/lib/oauth/pkce';

const SUPPORTED_PROVIDERS: SupportedProvider[] = [
  'generic',
  'azure',
  'google',
  'okta',
  'auth0',
];

const STATE_COOKIE_NAME = 'oauth_state';
const STATE_COOKIE_MAX_AGE = 600; // 10 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // ─── Validate provider ─────────────────────────────────────────────────
  if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
    return NextResponse.json(
      {
        error: 'unsupported_provider',
        message: `Provider '${provider}' is not supported. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // ─── Validate environment variables ────────────────────────────────────
  const envValidation = validateProviderEnv(provider);
  if (!envValidation.valid) {
    console.error(`OAuth configuration error for ${provider}:`, envValidation.missing);
    return NextResponse.json(
      {
        error: 'configuration_error',
        message: `OAuth provider '${provider}' is not properly configured. Missing: ${envValidation.missing.join(', ')}`,
      },
      { status: 500 }
    );
  }

  try {
    const config = getProviderConfig(provider);
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/callback`;
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';

    // ─── Generate PKCE and encrypted state ───────────────────────────────
    const oauthState = createOAuthState(provider, returnTo);
    const codeChallenge = generateCodeChallenge(oauthState.codeVerifier);
    const encryptedState = encryptState(oauthState);

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, encryptedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE,
      path: '/',
    });

    // ─── Build authorization URL ──────────────────────────────────────────
    const authUrl = new URL(config.authorizationUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', oauthState.state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Provider-specific extra params (e.g., prompt=select_account for Azure)
    if (config.authParams) {
      for (const [key, value] of Object.entries(config.authParams)) {
        authUrl.searchParams.set(key, value);
      }
    }

    console.log(`OAuth: Redirecting to ${provider} authorization endpoint`);

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('OAuth initiation error:', error);
    return NextResponse.json(
      {
        error: 'oauth_error',
        message: error instanceof Error ? error.message : 'Failed to initiate OAuth flow',
      },
      { status: 500 }
    );
  }
}
