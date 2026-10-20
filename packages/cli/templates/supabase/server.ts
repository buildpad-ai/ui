/**
 * Supabase Server Client
 * 
 * Server-side Supabase client for use in Server Components, API routes, and Server Actions.
 * This file is copied to your project by the Buildpad CLI.
 *
 * On a Buildpad Engine project, `NEXT_PUBLIC_BUILDPAD_TENANT_ID` names the
 * project's tenant and every request this client makes sends it as
 * `X-Tenant-Id`. The Engine reads that header on requests that carry no
 * session yet, such as `signInWithPassword`; without it the Engine picks a
 * tenant by its own rule, which can bind the session to a different tenant
 * than the app's. A request with a session is bound by its token, so the
 * header changes nothing there. On a Supabase project the variable is unset
 * and the client is created exactly as before.
 *
 * @buildpad/origin: supabase/server
 * @buildpad/version: 1.1.0
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    );
  }

  const cookieStore = await cookies();
  const tenantId = process.env.NEXT_PUBLIC_BUILDPAD_TENANT_ID;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(tenantId ? { global: { headers: { 'X-Tenant-Id': tenantId } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
