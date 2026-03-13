/**
 * Auth Callback Route (External OAuth — Enhanced)
 *
 * GET /api/auth/callback
 *
 * Dual-mode callback handler. Installed by the `external-oauth` lib module,
 * which upgrades the basic Supabase-only callback to support external IDPs.
 *
 * Mode 1 — External OAuth (oauth_state cookie present):
 *   1. Decrypt + validate state (CSRF protection + expiry check)
 *   2. Exchange authorization code for tokens (PKCE)
 *   3. Merge claims from ALL sources: access_token (as JWT) + id_token + userinfo endpoint
 *   4. normalizeUserClaims() — resolves email across provider-specific claim names
 *   5. findOrCreateUser() — JIT provisioning via Supabase Admin API
 *   6. supabase.auth.setSession() — sets cookies in the SSR-compatible format
 *
 * Mode 2 — Supabase native (no oauth_state cookie):
 *   Falls back to supabase.auth.exchangeCodeForSession() for magic links / native OAuth.
 *
 * @buildpad/origin: external-oauth/auth-callback
 * @buildpad/version: 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  decryptState,
  isStateExpired,
  type OAuthStateData,
} from '@/lib/oauth/pkce';
import { getProviderConfig } from '@/lib/oauth/config';
import {
  validateIdToken,
  normalizeUserClaims,
  decodeTokenUnsafe,
  type IdTokenClaims,
} from '@/lib/oauth/validate';
import { findOrCreateUser } from '@/lib/supabase/admin';

const STATE_COOKIE_NAME = 'oauth_state';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // ─── Handle errors returned from the provider ──────────────────────────
  if (error) {
    console.error('OAuth error from provider:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  // ─── Detect external OAuth vs Supabase native flow ─────────────────────
  const cookieStore = await cookies();
  const encryptedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  if (!encryptedState) {
    // No external OAuth state cookie → Supabase native magic link / OAuth flow
    console.log('No oauth_state cookie — falling back to Supabase native callback');
    return handleSupabaseCallback(request, code);
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_code_or_state', request.url));
  }

  // ─── Decrypt + validate state (CSRF + expiry) ──────────────────────────
  let oauthState: OAuthStateData;
  try {
    oauthState = decryptState<OAuthStateData>(encryptedState);
  } catch {
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  if (oauthState.state !== state) {
    console.error('State mismatch — possible CSRF attack');
    return NextResponse.redirect(new URL('/login?error=state_mismatch', request.url));
  }

  if (isStateExpired(oauthState)) {
    return NextResponse.redirect(new URL('/login?error=state_expired', request.url));
  }

  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    const config = getProviderConfig(oauthState.provider);
    const redirectUri = `${request.nextUrl.origin}/api/auth/callback`;

    // ─── Token exchange ───────────────────────────────────────────────────
    console.log(`OAuth: Exchanging code for tokens (${oauthState.provider})`);

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
        redirect_uri: redirectUri,
        code_verifier: oauthState.codeVerifier,
      }),
    });

    const tokens: TokenResponse = await tokenResponse.json();

    if (tokens.error || !tokenResponse.ok) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(
            tokens.error_description || tokens.error || 'token_exchange_failed'
          )}`,
          request.url
        )
      );
    }

    console.log('OAuth: Tokens received:', {
      has_id_token: !!tokens.id_token,
      has_access_token: !!tokens.access_token,
      has_refresh_token: !!tokens.refresh_token,
      scope: tokens.scope,
    });

    // ─── Merge claims from ALL token sources ──────────────────────────────
    // IMPORTANT: Different providers put user claims in different places.
    // We merge all sources so normalizeUserClaims() can find email/name
    // regardless of provider behaviour. Later sources override earlier.
    let allClaims: Record<string, unknown> = {};

    // 1. access_token as JWT (some providers embed claims here — e.g. custom OIDC)
    if (tokens.access_token) {
      const accessTokenClaims = decodeTokenUnsafe(tokens.access_token);
      if (accessTokenClaims) {
        console.log('OAuth: access_token claims:', JSON.stringify(accessTokenClaims, null, 2));
        allClaims = { ...allClaims, ...accessTokenClaims };
      }
    }

    // 2. id_token — cryptographically signed, most reliable (Azure, Google, Auth0)
    if (tokens.id_token) {
      const validation = await validateIdToken(tokens.id_token, config);
      if (validation.valid && validation.claims) {
        console.log('OAuth: id_token claims:', JSON.stringify(validation.claims, null, 2));
        allClaims = { ...allClaims, ...validation.claims };
      } else {
        console.warn('OAuth: id_token validation failed:', validation.error);
      }
    }

    // 3. userinfo endpoint — catches anything missed above
    if (config.userInfoUrl && tokens.access_token) {
      try {
        const userInfoResponse = await fetch(config.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: 'application/json',
          },
        });
        if (userInfoResponse.ok) {
          const userInfoData = await userInfoResponse.json();
          console.log('OAuth: userinfo claims:', JSON.stringify(userInfoData, null, 2));
          allClaims = { ...allClaims, ...userInfoData };
        } else {
          console.warn('OAuth: userinfo endpoint', userInfoResponse.status, userInfoResponse.statusText);
        }
      } catch (e) {
        console.warn('OAuth: Failed to fetch userinfo:', e);
      }
    }

    console.log('OAuth: Merged claims:', JSON.stringify(allClaims, null, 2));

    if (!allClaims.sub) {
      console.error('No subject (sub) claim found in any token');
      return NextResponse.redirect(new URL('/login?error=no_subject_claim', request.url));
    }

    const userInfo = normalizeUserClaims(allClaims as IdTokenClaims);

    if (!userInfo.email) {
      console.error(
        'No email found in any token claims. Available claims:',
        Object.keys(allClaims).join(', ')
      );
      return NextResponse.redirect(new URL('/login?error=no_email_claim', request.url));
    }

    console.log(`OAuth: User authenticated — ${userInfo.email} (${oauthState.provider})`);

    // ─── JIT user provisioning ────────────────────────────────────────────
    const { user, session, isNewUser } = await findOrCreateUser({
      email: userInfo.email,
      emailVerified: userInfo.emailVerified,
      provider: oauthState.provider,
      providerId: userInfo.providerId,
      metadata: {
        fullName: userInfo.name,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
        avatarUrl: userInfo.picture,
      },
    });

    console.log(`OAuth: ${isNewUser ? 'Created new' : 'Found existing'} user — ${user.id}`);

    // ─── Set session (Supabase SSR format) ────────────────────────────────
    // CRITICAL: use supabase.auth.setSession() from @supabase/ssr createServerClient.
    // Do NOT set sb-access-token / sb-refresh-token cookies manually —
    // the SSR middleware expects a specific format that only setSession() provides.
    const redirectUrl = new URL(oauthState.returnTo || '/', request.url);
    let response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    if (setSessionError) {
      console.error('Failed to set session:', setSessionError);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(setSessionError.message)}`,
          request.url
        )
      );
    }

    console.log('OAuth: Session set — redirecting to', redirectUrl.pathname);

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          error instanceof Error ? error.message : 'callback_error'
        )}`,
        request.url
      )
    );
  }
}

/**
 * Fallback handler for Supabase native OAuth / magic link callbacks.
 * Invoked when no `oauth_state` cookie is present.
 */
async function handleSupabaseCallback(
  request: NextRequest,
  code: string | null
): Promise<NextResponse> {
  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }

  const next = request.nextUrl.searchParams.get('next') ?? '/';
  return NextResponse.redirect(new URL(next, request.url));
}
