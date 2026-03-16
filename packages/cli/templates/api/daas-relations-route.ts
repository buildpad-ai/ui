/**
 * DaaS Relations Proxy Route
 *
 * Proxies /api/relations requests to the DaaS backend.
 * Used by M2M, M2O, and O2M relation hooks to fetch relation definitions.
 *
 * GET /api/relations  → DaaS GET /api/relations
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/relations/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaaSUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/relations${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
