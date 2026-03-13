/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for secure OAuth authorization code flow.
 * Also handles state parameter encryption for CSRF protection using AES-256-GCM.
 *
 * @buildpad/origin: lib/oauth/pkce
 * @buildpad/version: 1.0.0
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

import crypto from 'crypto';

/**
 * Generate PKCE code verifier.
 * A cryptographically random string using unreserved characters.
 * Length: 43 characters (32 bytes base64url encoded).
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge using S256 method.
 * SHA256 hash of the verifier, base64url encoded.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Generate random state for CSRF protection.
 * 32 hex characters (16 bytes of entropy).
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Encrypt OAuth state data for secure cookie storage.
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Format: iv (16 bytes) + authTag (16 bytes) + ciphertext
 *
 * @param data - Object to encrypt (state, code_verifier, provider, returnTo)
 * @returns Base64url encoded encrypted string
 */
export function encryptState(data: object): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET environment variable is required');
  }

  // Derive a 256-bit key from the secret
  const key = crypto.scryptSync(secret, 'oauth-state-salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(json, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + encrypted
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

/**
 * Decrypt OAuth state data from cookie.
 *
 * @param encrypted - Base64url encoded encrypted string
 * @returns Decrypted object
 * @throws Error if decryption fails (tampered or expired cookie)
 */
export function decryptState<T extends object>(encrypted: string): T {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET environment variable is required');
  }

  try {
    const buffer = Buffer.from(encrypted, 'base64url');

    // Extract components
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const ciphertext = buffer.subarray(32);

    // Derive the same key
    const key = crypto.scryptSync(secret, 'oauth-state-salt', 32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted) as T;
  } catch {
    throw new Error('Failed to decrypt OAuth state - may be tampered or expired');
  }
}

/**
 * OAuth state data structure stored in encrypted cookie.
 */
export interface OAuthStateData {
  /** Random state for CSRF protection */
  state: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** OAuth provider name */
  provider: string;
  /** URL to redirect after successful auth */
  returnTo: string;
  /** Timestamp when state was created (ms since epoch) */
  createdAt: number;
}

/**
 * Create a complete OAuth state object with PKCE verifier.
 */
export function createOAuthState(
  provider: string,
  returnTo: string = '/'
): OAuthStateData {
  return {
    state: generateState(),
    codeVerifier: generateCodeVerifier(),
    provider,
    returnTo,
    createdAt: Date.now(),
  };
}

/**
 * Validate that state hasn't expired.
 * Default expiry: 10 minutes (matching cookie maxAge).
 */
export function isStateExpired(
  stateData: OAuthStateData,
  maxAgeMs: number = 10 * 60 * 1000
): boolean {
  return Date.now() - stateData.createdAt > maxAgeMs;
}
