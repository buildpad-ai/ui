import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE_NAME = 'daas_config';
const ALGORITHM = 'aes-256-gcm';

export interface DaaSConfig {
  url: string;
  token: string;
}

const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 16;
const MIN_SECRET_LENGTH = 32;
const DEV_FALLBACK_SECRET = 'buildpad-storybook-host-default-dev-key!!';

/** Thrown when the server is not configured to encrypt credential cookies. */
export class CookieSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CookieSecretError';
  }
}

let warnedAboutDevSecret = false;

function getSecret(): Buffer {
  const secret = process.env.COOKIE_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new CookieSecretError(
        `COOKIE_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters in production.`
      );
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  if (!secret) {
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn(
        '[storybook-host] COOKIE_SECRET is not set; using an insecure development key. Set COOKIE_SECRET in production.'
      );
    }
    return crypto.createHash('sha256').update(DEV_FALLBACK_SECRET).digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt and store DaaS config in an httpOnly cookie.
 */
export async function setDaaSConfig(config: DaaSConfig): Promise<void> {
  const cookieStore = await cookies();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  const value = `${iv.toString('hex')}:${authTag}:${encrypted}`;

  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Read and decrypt DaaS config from the cookie.
 *
 * Returns null when there is no cookie or it cannot be decrypted/parsed.
 * Throws `CookieSecretError` if a cookie is present but the server has no
 * usable COOKIE_SECRET (production only).
 *
 * NOTE: the returned URL must still be re-validated with `validateDaaSUrl`
 * before it is fetched.
 */
export async function getDaaSConfig(): Promise<DaaSConfig | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  // Resolve the key outside the try so misconfiguration is surfaced, not
  // silently treated as "not connected".
  const key = getSecret();

  try {
    const [ivHex, authTagHex, encrypted] = cookie.value.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      return null;
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const parsed: unknown = JSON.parse(decrypted);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as DaaSConfig).url !== 'string' ||
      typeof (parsed as DaaSConfig).token !== 'string'
    ) {
      return null;
    }
    return { url: (parsed as DaaSConfig).url, token: (parsed as DaaSConfig).token };
  } catch {
    return null;
  }
}

/**
 * Clear DaaS config cookie.
 */
export async function clearDaaSConfig(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
