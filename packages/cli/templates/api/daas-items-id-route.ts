/**
 * DaaS Item by ID Proxy Route
 *
 * Proxies /api/items/[collection]/[id] requests to the DaaS backend.
 *
 * GET    /api/items/[collection]/[id]  → DaaS GET    /api/items/{collection}/{id}
 * PATCH  /api/items/[collection]/[id]  → DaaS PATCH  /api/items/{collection}/{id}
 * DELETE /api/items/[collection]/[id]  → DaaS DELETE /api/items/{collection}/{id}
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/items/[collection]/[id]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ collection: string; id: string }> };

async function proxyRequest(
  request: NextRequest,
  collection: string,
  id: string,
  method: string
) {
  const daasUrl = getDaaSUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/items/${collection}/${id}${searchParams ? `?${searchParams}` : ''}`;

  const fetchOptions: RequestInit = { method, headers, cache: 'no-store' };

  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
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
  const { collection, id } = await params;
  try {
    return await proxyRequest(request, collection, id, 'GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { collection, id } = await params;
  try {
    return await proxyRequest(request, collection, id, 'PATCH');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { collection, id } = await params;
  try {
    return await proxyRequest(request, collection, id, 'DELETE');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
