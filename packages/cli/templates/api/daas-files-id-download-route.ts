/**
 * DaaS File Download Proxy Route
 *
 * Proxies /api/files/[id]/download requests to the DaaS backend.
 * Returns a (typically signed, time-limited) download URL for the file.
 *
 * GET /api/files/[id]/download?expires_in=3600
 *   → DaaS GET /api/files/[id]/download
 *   → { url: string, expires_in?: number }
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/files/[id]/download/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const daasUrl = getDaasUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/files/${id}/download${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
