/**
 * My Apps sign-in on an Engine project
 *
 * Helpers for the Engine variant of the external-oauth module
 * (`external-oauth-engine`). The application's server finishes the
 * authorization-code flow with My Apps, then hands the ID token to the
 * project's Buildpad Engine through the Supabase client's
 * `signInWithIdToken`. The Engine checks the token and answers with an
 * ordinary session.
 *
 * What an Engine project does NOT have, and this module never uses: a
 * service-role key, the Supabase administration API, magic links or one-time
 * codes, and role writes from the application. A first sign-in creates an
 * account with no role; an administrator gives it a role in the Studio.
 *
 * @buildpad/origin: lib/oauth/engine
 * @buildpad/version: 1.0.0
 * @see .github/skills/add-external-oauth/SKILL.md (Engine part)
 */

import crypto from 'node:crypto';
import { createServerClient } from '@supabase/ssr';

/**
 * The provider name the Engine knows My Apps by. The Engine's operator names
 * it in `AUTH_EXTERNAL_ISSUERS`, the Platform records the app's client id
 * under it, and the app passes it to `signInWithIdToken`. Change all three
 * together, or not at all.
 */
export const MY_APPS_PROVIDER = 'my-apps';

/** The one cookie that carries the flow from the provider route to the callback. */
export const ENGINE_FLOW_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-engine_oauth_flow' : 'engine_oauth_flow';

/** How long a started sign-in may take (seconds). */
export const ENGINE_FLOW_MAX_AGE = 600;

/**
 * What the provider route stores and the callback reads. Every value is
 * random and single-use; the cookie is httpOnly, so the browser's scripts
 * never see it. `nonce` is the RAW nonce: My Apps receives only its SHA-256
 * hex digest.
 */
export interface EngineFlowState {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * The OIDC `nonce` sent to My Apps: the lower-case hex SHA-256 of the raw
 * nonce, the Supabase convention the Engine applies. The Engine refuses a
 * token whose `nonce` claim equals the raw value.
 */
export function hashNonce(rawNonce: string): string {
  return crypto.createHash('sha256').update(rawNonce).digest('hex');
}

/** PKCE S256 challenge for a verifier (RFC 7636). */
export function codeChallengeOf(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function createEngineFlowState(returnTo: string): EngineFlowState {
  return {
    state: randomToken(16),
    nonce: randomToken(32),
    codeVerifier: randomToken(32),
    returnTo,
    createdAt: Date.now(),
  };
}

export function encodeFlowState(flow: EngineFlowState): string {
  return Buffer.from(JSON.stringify(flow), 'utf8').toString('base64url');
}

/** Null when the cookie is missing, malformed or expired. */
export function decodeFlowState(value: string | undefined): EngineFlowState | null {
  if (!value) return null;
  try {
    const flow = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<EngineFlowState>;
    if (
      typeof flow.state !== 'string' ||
      typeof flow.nonce !== 'string' ||
      typeof flow.codeVerifier !== 'string' ||
      typeof flow.returnTo !== 'string' ||
      typeof flow.createdAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - flow.createdAt > ENGINE_FLOW_MAX_AGE * 1000) return null;
    return flow as EngineFlowState;
  } catch {
    return null;
  }
}

/** Constant-time string comparison for the `state` check. */
export function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export const flowCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ENGINE_FLOW_MAX_AGE,
};

/** The Engine settings every project's environment holds. */
export interface EngineEnv {
  /** The Engine_URL (`NEXT_PUBLIC_SUPABASE_URL`). */
  engineUrl: string;
  /** The fixed public value the Supabase client needs; the Engine does not read it. */
  publicKey: string;
  /** The project's tenant id, sent as `X-Tenant-Id` on the sign-in. */
  tenantId: string;
}

export function readEngineEnv(): { env: EngineEnv | null; missing: string[] } {
  const engineUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const tenantId = process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID;
  const missing: string[] = [];
  if (!engineUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!publicKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!tenantId) missing.push('NEXT_PUBLIC_BUILDPAD_TENANT_ID');
  if (!engineUrl || !publicKey || !tenantId) return { env: null, missing };
  return { env: { engineUrl: engineUrl.replace(/\/+$/, ''), publicKey, tenantId }, missing };
}

export interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/**
 * A Supabase server client for the Engine's sign-in. It sends `X-Tenant-Id`
 * on every request it makes, so the sign-in names the project's tenant. The
 * session cookies it writes go to `sink`, and the caller decides whether they
 * reach the browser; this is the cookie format the kit's middleware and
 * `lib/supabase/server.ts` read.
 */
export function createEngineSignInClient(
  env: EngineEnv,
  readCookies: () => { name: string; value: string }[],
  sink: CookieToSet[]
) {
  return createServerClient(env.engineUrl, env.publicKey, {
    global: {
      headers: { 'X-Tenant-Id': env.tenantId },
    },
    cookies: {
      getAll() {
        return readCookies();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        sink.push(...cookiesToSet);
      },
    },
  });
}

/**
 * Whether the signed-in account holds a role in the project's tenant.
 * `GET /api/users/me` answers `roles: []` and `admin_access: false` for an
 * account no administrator has given a role yet. `unknown` when the Engine
 * could not be asked; the caller then keeps the session.
 */
export async function projectAccessOf(
  env: EngineEnv,
  accessToken: string
): Promise<'granted' | 'pending' | 'unknown'> {
  try {
    const response = await fetch(`${env.engineUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return 'unknown';
    const body = (await response.json()) as {
      data?: { roles?: unknown[]; admin_access?: boolean };
    };
    const me = body.data;
    if (!me || !Array.isArray(me.roles)) return 'unknown';
    return me.roles.length === 0 && me.admin_access !== true ? 'pending' : 'granted';
  } catch {
    return 'unknown';
  }
}

/**
 * The error codes the callback puts in `/login?error=`. The login buttons
 * turn each into a sentence; no provider or Engine text is echoed.
 */
export type EngineSignInError =
  | 'sign_in_cancelled'
  | 'sign_in_expired'
  | 'sign_in_failed'
  | 'sign_in_refused'
  | 'account_disabled'
  | 'engine_unavailable'
  | 'configuration_error';

/**
 * Maps the Engine's answer to `signInWithIdToken` to a code. The Engine
 * answers every refusal (an account that is a host or tenant administrator,
 * an existing account with the same email that is not linked to this My Apps
 * identity, an unverified email, a token it does not trust) with the same
 * body as a wrong password, on purpose, so the app cannot tell them apart.
 */
export function signInErrorOf(error: { status?: number; code?: string }): EngineSignInError {
  if (error.code === 'user_banned') return 'account_disabled';
  if (error.code === 'invalid_credentials') return 'sign_in_refused';
  if (typeof error.status === 'number' && error.status >= 500) return 'engine_unavailable';
  // Anything else, such as a 400 with no code: the Engine names no My Apps
  // issuer (its operator has not enabled the sign-in) or the request was malformed.
  return 'sign_in_failed';
}
