/**
 * OAuth Token Validation
 *
 * Validates ID tokens from OAuth providers using JWKS.
 * Falls back to decoding without verification if JWKS is not configured.
 * Normalizes user claims across different providers.
 *
 * @buildpad/origin: lib/oauth/validate
 * @buildpad/version: 1.0.0
 */

import * as jose from 'jose';
import type { OAuthProviderConfig } from './config';

// Cache JWKS for performance (avoid fetching on every request)
const jwksCache = new Map<string, jose.JWTVerifyGetKey>();

/**
 * Standard OIDC ID token claims.
 * Different providers use different field names — all variants are typed here.
 */
export interface IdTokenClaims {
  /** Subject - provider's unique user identifier */
  sub: string;
  /** User's email address (standard OIDC) */
  email?: string;
  /** Whether email is verified */
  email_verified?: boolean;
  /** Full name */
  name?: string;
  /** Given/first name */
  given_name?: string;
  /** Family/last name */
  family_name?: string;
  /** Profile picture URL */
  picture?: string;
  /** Token issuer */
  iss?: string;
  /** Audience (client ID) */
  aud?: string | string[];
  /** Expiration time */
  exp?: number;
  /** Issued at time */
  iat?: number;
  /** Azure AD: Object ID */
  oid?: string;
  /** Azure AD / some enterprise IDPs: User Principal Name (often an email) */
  preferred_username?: string;
  /** Any additional claims from provider */
  [key: string]: unknown;
}

/**
 * Result of token validation.
 */
export interface TokenValidationResult {
  /** Whether validation was successful */
  valid: boolean;
  /** Extracted claims from the token */
  claims?: IdTokenClaims;
  /** Error message if validation failed */
  error?: string;
  /** Whether JWKS cryptographic verification was performed */
  verified: boolean;
}

/**
 * Validate an ID token from an OAuth provider.
 *
 * If JWKS URI is configured, performs full cryptographic verification.
 * Otherwise, decodes the token without verification (less secure — set JWKS in production).
 */
export async function validateIdToken(
  idToken: string,
  config: OAuthProviderConfig
): Promise<TokenValidationResult> {
  try {
    // If JWKS is configured, perform full cryptographic verification
    if (config.jwksUri && config.issuer) {
      return await verifyWithJwks(idToken, config);
    }

    // Fallback: decode without verification
    console.warn(
      'JWKS not configured - decoding ID token without cryptographic verification. ' +
      'Set OAUTH_JWKS_URI and OAUTH_ISSUER for production use.'
    );

    const claims = jose.decodeJwt(idToken) as IdTokenClaims;

    if (!claims.sub) {
      return { valid: false, error: 'Token missing subject claim', verified: false };
    }

    // Check expiration even without crypto verification
    if (claims.exp && claims.exp < Date.now() / 1000) {
      return { valid: false, error: 'Token has expired', verified: false };
    }

    return { valid: true, claims, verified: false };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
      verified: false,
    };
  }
}

/**
 * Verify token using JWKS (JSON Web Key Set).
 * Uses a cached RemoteJWKSet to avoid refetching on every request.
 */
async function verifyWithJwks(
  idToken: string,
  config: OAuthProviderConfig
): Promise<TokenValidationResult> {
  try {
    let jwks = jwksCache.get(config.jwksUri!);
    if (!jwks) {
      jwks = jose.createRemoteJWKSet(new URL(config.jwksUri!));
      jwksCache.set(config.jwksUri!, jwks);
    }

    const { payload } = await jose.jwtVerify(idToken, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
    });

    const claims = payload as IdTokenClaims;

    if (!claims.sub) {
      return { valid: false, error: 'Token missing subject claim', verified: true };
    }

    return { valid: true, claims, verified: true };

  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: 'Token has expired', verified: true };
    }
    if (error instanceof jose.errors.JWKSNoMatchingKey) {
      return { valid: false, error: 'No matching key found in JWKS', verified: true };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return { valid: false, error: `Claim validation failed: ${error.message}`, verified: true };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Token verification failed',
      verified: true,
    };
  }
}

/**
 * Decode a JWT without verification.
 * Used to extract claims from access_token (some providers embed claims there).
 *
 * ⚠️ DO NOT use this for authentication decisions — use validateIdToken() instead.
 */
export function decodeTokenUnsafe(token: string): IdTokenClaims | null {
  try {
    return jose.decodeJwt(token) as IdTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Normalize user claims across different OAuth providers.
 *
 * Critical learning: providers use different claim names for the same fields.
 * This function checks all known variants and returns a consistent structure.
 *
 * Email claim variants:
 * - `email`             — Standard OIDC, Google, Auth0
 * - `preferred_username` — Azure AD (User Principal Name)
 * - `upn`               — Some enterprise IDPs
 * - `mail`              — LDAP-style providers
 * - `login`             — GitHub
 * - `username`          — Some custom IDPs
 */
export function normalizeUserClaims(claims: IdTokenClaims): {
  email: string | undefined;
  emailVerified: boolean;
  name: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  picture: string | undefined;
  providerId: string;
} {
  const email =
    claims.email ||
    claims.preferred_username ||
    (claims.upn as string | undefined) ||
    (claims.mail as string | undefined) ||
    (claims.emailAddress as string | undefined) ||
    (claims.user_email as string | undefined) ||
    (claims.login as string | undefined) ||
    (claims.username as string | undefined);

  // Name parsing: try structured claims first, fall back to parsing full name
  let firstName = claims.given_name;
  let lastName = claims.family_name;

  if (claims.name && (!firstName || !lastName)) {
    const parts = claims.name.split(' ');
    if (!firstName) firstName = parts[0];
    if (!lastName) lastName = parts.slice(1).join(' ') || undefined;
  }

  return {
    email,
    emailVerified: claims.email_verified ?? true, // Trust the IDP's verification
    name: claims.name,
    firstName,
    lastName,
    picture: claims.picture,
    providerId: claims.sub,
  };
}
