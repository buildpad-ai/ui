/**
 * DaaS Assets Proxy Route (by ID)
 *
 * Proxies /api/assets/[id] requests to the DaaS backend.
 * Used by FileImage and Upload components to serve image thumbnails and assets.
 *
 * GET /api/assets/[id] → DaaS GET /api/assets/[id] (stream asset with optional transform key)
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/assets/[id]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const daasUrl = getDaasUrl();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/assets/${id}${searchParams ? `?${searchParams}` : ''}`;

    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = {};
    if (authHeaders['Authorization']) {
      headers['Authorization'] = authHeaders['Authorization'];
    }

    const response = await fetch(url, { headers, cache: 'no-store' });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const cacheControl = response.headers.get('cache-control');

    const responseHeaders = new Headers({ 'Content-Type': contentType });
    if (cacheControl) responseHeaders.set('Cache-Control', cacheControl);

    return new NextResponse(response.body, { status: 200, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
