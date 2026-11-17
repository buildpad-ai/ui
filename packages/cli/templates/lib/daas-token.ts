/**
 * DaaS token for direct browser → DaaS calls.
 *
 * The browser's Supabase session can run out while the server still has a
 * valid one: a tab left idle past the access token's lifetime, or a refresh
 * token the server already rotated. Calls made with that token get 401 until
 * the page is reloaded. This module uses the browser token while it is still
 * good and otherwise asks the app's own `/api/auth/token` route, which reads
 * the server session the middleware has just refreshed.
 *
 * @buildpad/origin: lib/daas-token
 * @buildpad/version: 1.0.0
 */

import { createClient } from '@/lib/supabase/client';

/** Renew a token that has less than this left, so it cannot expire in flight. */
const MARGIN_MS = 60_000;

/** The app's own route; NEXT_PUBLIC_BASE_PATH carries a multi-zone basePath. */
const TOKEN_ROUTE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/auth/token`;

let inflight: Promise<string | null> | null = null;

/** The token's `exp` in milliseconds, or 0 when it cannot be read. */
function expiresAtMs(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * A token from the server session, or null when there is none (the person is
 * signed out). Concurrent callers share one request.
 */
export function renewDaaSToken(): Promise<string | null> {
  inflight ??= fetch(TOKEN_ROUTE, { cache: 'no-store', credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = (await res.json()) as { access_token?: string | null };
      return body.access_token ?? null;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The browser's token while it has over a minute left, else one from the server session. */
export async function getDaaSToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (token && expiresAtMs(token) - Date.now() > MARGIN_MS) return token;
  return renewDaaSToken();
}
