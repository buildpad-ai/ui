/**
 * Engine Assets Proxy Route (by ID)
 *
 * Proxies /api/assets/[id] requests to the Buildpad Engine.
 * Used by FileImage and Upload components to serve image thumbnails and assets.
 *
 * GET /api/assets/[id] → Engine GET /api/files/assets/[id] (stream asset with optional transform key)
 *
 * The Buildpad Engine serves file content at /api/files/assets/:id, not
 * /api/assets/:id. The browser's <img>/<a> sends no Authorization header, so
 * this route attaches the signed-in user's Bearer token server-side.
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
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
    const url = `${daasUrl}/api/files/assets/${id}${searchParams ? `?${searchParams}` : ''}`;

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
    // Download saves with the file's name only when Content-Disposition comes through.
    for (const name of ['content-disposition', 'content-length', 'etag', 'last-modified']) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new NextResponse(response.body, { status: 200, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
