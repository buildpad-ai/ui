import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE_NAME = 'daas_config';
const ALGORITHM = 'aes-256-gcm';

export interface DaaSConfig {
  url: string;
  token: string;
}

function getSecret(): Buffer {
  const secret =
    process.env.COOKIE_SECRET ||
    'buildpad-storybook-host-default-dev-key!!';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt and store DaaS config in an httpOnly cookie.
 */
export async function setDaaSConfig(config: DaaSConfig): Promise<void> {
  const cookieStore = await cookies();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv);

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
 */
export async function getDaaSConfig(): Promise<DaaSConfig | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const [ivHex, authTagHex, encrypted] = cookie.value.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
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
