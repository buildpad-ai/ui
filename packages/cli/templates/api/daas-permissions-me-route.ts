/**
 * DaaS Permissions (Me) Proxy Route
 *
 * Proxies /api/permissions/me requests to the DaaS backend.
 * Used by the DaaSAPI client to resolve the current user's permission set
 * and derive create/read/update/delete access for each collection.
 *
 * GET /api/permissions/me → DaaS GET /api/permissions/me
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/permissions/me/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaaSUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/permissions/me${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
