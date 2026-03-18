/**
 * DaaS API Auth Headers Helper
 *
 * Provides auth headers and DaaS URL for server-side proxy routes.
 * Uses the current Supabase session JWT as the Bearer token for DaaS.
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: lib/api/auth-headers.ts
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Get authorization headers for forwarding requests to DaaS.
 * Reads the Supabase session JWT from the current request cookies.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Supabase not configured — return headers without auth token.
    // Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
  }

  return headers;
}

/**
 * Get the DaaS base URL from environment variables.
 * Uses BUILDPAD_DAAS_URL (server-side, private) with fallback to
 * NEXT_PUBLIC_BUILDPAD_DAAS_URL (public, also visible to browser).
 *
 * @throws If neither env var is set.
 */
export function getDaasUrl(): string {
  const url =
    process.env.BUILDPAD_DAAS_URL ??
    process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL;

  if (!url) {
    throw new Error(
      'DaaS URL not configured. Set BUILDPAD_DAAS_URL (or NEXT_PUBLIC_BUILDPAD_DAAS_URL) in .env.local'
    );
  }

  return url.replace(/\/$/, '');
}
