/**
 * DaaS Items Collection Proxy Route
 *
 * Proxies /api/items/[collection] requests to the DaaS backend.
 *
 * GET  /api/items/[collection]  → DaaS GET  /api/items/{collection}  (list)
 * POST /api/items/[collection]  → DaaS POST /api/items/{collection}  (create)
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/items/[collection]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ collection: string }> };

async function proxyRequest(
  request: NextRequest,
  collection: string,
  method: string
) {
  const daasUrl = getDaasUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/items/${collection}${searchParams ? `?${searchParams}` : ''}`;

  const fetchOptions: RequestInit = { method, headers, cache: 'no-store' };

  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = request.headers.get('content-type');
    if (contentType) {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] =
        contentType;
    }
    try {
      const body = await request.arrayBuffer();
      if (body.byteLength > 0) fetchOptions.body = body;
    } catch {
      // no body
    }
  }

  const response = await fetch(url, fetchOptions);

  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: NextRequest, { params }: Params) {
  const { collection } = await params;
  try {
    return await proxyRequest(request, collection, 'GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { collection } = await params;
  try {
    return await proxyRequest(request, collection, 'POST');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
