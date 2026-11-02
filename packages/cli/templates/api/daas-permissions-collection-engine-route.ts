/**
 * Engine Collection Permissions Proxy Route
 *
 * Proxies /api/permissions/[collection] to the Buildpad Engine. Read by
 * usePermissions for the signed-in user's permissions on one collection. The
 * Engine answers 403 for a non-admin, which the hook treats as "no extra rules".
 *
 * GET /api/permissions/[collection] → Engine GET /api/permissions/[collection]
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
 * Location: app/api/permissions/[collection]/route.ts
 */

import { type NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/api/forward';

type RouteParams = { params: Promise<{ collection: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { collection } = await params;
  return forwardToEngine(request, `/api/permissions/${encodeURIComponent(collection)}`);
}
