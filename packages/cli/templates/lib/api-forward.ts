/**
 * Engine Proxy Helper
 *
 * Forwards one request from a Next.js /api route to the Buildpad Engine with
 * the signed-in user's access token as `Authorization: Bearer`. The Engine
 * accepts no cookie session and no credentialed cross-origin request, so every
 * browser call on an Engine project goes through a route that uses this.
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
 * Location: lib/api/forward.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

/**
 * Sends one request on to `enginePath` on the Engine with the signed-in user's
 * access token, and passes the Engine's status and body back unchanged.
 * `jsonBody`, when given, replaces the request body (sent as JSON).
 */
export async function forwardToEngine(
  request: NextRequest,
  enginePath: string,
  jsonBody?: string
): Promise<NextResponse> {
  try {
    const headers = await getAuthHeaders();
    const resourceUri = request.headers.get('x-resource-uri');
    if (resourceUri) headers['X-Resource-Uri'] = resourceUri;

    const method = request.method;
    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      if (jsonBody !== undefined) {
        body = jsonBody;
      } else {
        // Forward the body as received: multipart keeps its boundary.
        const contentType = request.headers.get('content-type');
        if (contentType) headers['Content-Type'] = contentType;
        const raw = await request.arrayBuffer();
        if (raw.byteLength > 0) body = raw;
      }
    }
    if (!body) delete headers['Content-Type'];

    const query = request.nextUrl.searchParams.toString();
    const response = await fetch(`${getDaasUrl()}${enginePath}${query ? `?${query}` : ''}`, {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Engine could not be reached';
    return NextResponse.json({ errors: [{ message }] }, { status: 502 });
  }
}
