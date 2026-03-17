/**
 * Custom Application Permissions — Server Utilities
 *
 * Provides server-side resolution and enforcement of application-level
 * boolean capability flags stored in daas_policies.custom_permissions.
 *
 * These flags have the form:
 *   { "MyApp.Dashboard.TaskWidget": true, "MyApp.Reports.Export": false }
 *
 * They are merged across all effective policies with boolean OR, exactly
 * like DaaS collection permissions are merged from multiple policies.
 *
 * Setup:
 *   1. Add custom_permissions JSONB column to daas_policies via MCP fields tool.
 *   2. Extend /api/permissions/me to include `custom` in the JSON response.
 *   3. Extend PermissionsContext to hold customPermissions state.
 *   4. See .github/skills/create-custom-permissions/SKILL.md for full guide.
 *
 * @buildpad/origin: lib/permissions/custom
 * @buildpad/version: 1.0.0
 */

import { cookies, headers } from 'next/headers';

/**
 * Permission denied error for custom flags.
 * Matches the shape of the existing PermissionError in lib/permissions/enforcer.ts.
 */
export class CustomPermissionError extends Error {
  public readonly statusCode: number;
  public readonly key: string;

  constructor(key: string, statusCode = 403) {
    super(`Custom permission denied: ${key}`);
    this.name = 'CustomPermissionError';
    this.statusCode = statusCode;
    this.key = key;
  }
}

/**
 * Fetch the merged custom permission map for the currently authenticated user.
 *
 * Calls GET /api/permissions/me/custom (or reads the `custom` field from
 * /api/permissions/me if you extended that endpoint instead).
 *
 * Must be called from Server Components or API route handlers — never from
 * Client Components.
 *
 * Admin users always receive an empty map but every key check returns true
 * via isAdmin shortcut in PermissionsContext. Server-side, the endpoint
 * itself returns {} with isAdmin=true; call hasCustomPermission() which
 * checks the isAdmin flag for you.
 *
 * @returns Record<string, boolean> — merged flags across all effective policies.
 */
export async function getCustomPermissions(): Promise<Record<string, boolean>> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // Build absolute URL for the internal fetch.
  // NEXT_PUBLIC_BUILDPAD_DAAS_URL is the origin when this runs inside DaaS itself.
  // For wrapping apps, use process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL.
  const origin =
    process.env.NEXT_PUBLIC_BUILDPAD_DAAS_URL ||
    headerStore.get('x-forwarded-proto')?.concat('://', headerStore.get('x-forwarded-host') ?? '') ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  // Forward the auth cookie so the endpoint authenticates the current user.
  const cookieHeader = cookieStore.toString();

  const res = await fetch(`${origin}/api/permissions/me/custom`, {
    headers: {
      cookie: cookieHeader,
      'x-internal-request': '1',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    if (res.status === 401) return {};
    console.error('[custom-permissions] fetch failed', res.status);
    return {};
  }

  const json = await res.json();

  // Support both { data: { ... } } and flat { ... } shapes.
  const data: Record<string, unknown> =
    json?.data && typeof json.data === 'object' ? json.data : json;

  // Ensure all values are boolean.
  const merged: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'boolean') merged[key] = value;
  }
  return merged;
}

/**
 * Check whether the current user holds a specific custom permission flag.
 *
 * Returns false when the key is absent or explicitly false.
 *
 * @example
 * const canExport = await hasCustomPermission('MyApp.Reports.Export');
 * if (!canExport) redirect('/403');
 */
export async function hasCustomPermission(key: string): Promise<boolean> {
  const perms = await getCustomPermissions();
  return perms[key] === true;
}

/**
 * Enforce a custom permission key. Throws CustomPermissionError (403) if
 * the current user does not hold the flag.
 *
 * Use in Next.js API route handlers alongside enforcePermission() for
 * collection-level access.
 *
 * @example
 * // app/api/leave-requests/[id]/reject/route.ts
 * await enforceCustomPermission('MyApp.LeaveRequest.Reject');
 * await enforcePermission({ collection: 'leave_requests', action: 'update' });
 */
export async function enforceCustomPermission(key: string): Promise<void> {
  const granted = await hasCustomPermission(key);
  if (!granted) {
    throw new CustomPermissionError(key);
  }
}

// ─── Resolution helper ────────────────────────────────────────────────────────
// Use this when you already have the policy IDs and a Supabase client,
// e.g. when extending /api/permissions/me to avoid an extra HTTP round-trip.

/**
 * Resolve custom permissions directly from a list of policy IDs.
 * Intended for use inside /api/permissions/me where you already have
 * a Supabase client and the user's effective policy IDs.
 *
 * @param supabase - Authenticated Supabase client
 * @param policyIds - Array of policy UUIDs (from get_user_policies RPC)
 * @returns Merged Record<string, boolean>
 */
export async function resolveCustomPermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  policyIds: string[]
): Promise<Record<string, boolean>> {
  if (policyIds.length === 0) return {};

  const { data: policies, error } = await supabase
    .from('daas_policies')
    .select('custom_permissions')
    .in('id', policyIds);

  if (error || !policies) return {};

  const merged: Record<string, boolean> = {};
  for (const policy of policies as Array<{ custom_permissions: Record<string, boolean> | null }>) {
    const cp = policy.custom_permissions;
    if (!cp || typeof cp !== 'object') continue;
    for (const [key, value] of Object.entries(cp)) {
      if (value === true) merged[key] = true;
      else if (!(key in merged)) merged[key] = false;
    }
  }
  return merged;
}
