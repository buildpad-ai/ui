/**
 * DaaS Folders Proxy Route (by ID)
 *
 * Proxies /api/folders/[id] requests to the DaaS backend.
 * Used by the Files module to read, rename, and delete folders.
 *
 * GET    /api/folders/[id] → DaaS GET    /api/folders/[id]
 * PATCH  /api/folders/[id] → DaaS PATCH  /api/folders/[id] (rename / move)
 * DELETE /api/folders/[id] → DaaS DELETE /api/folders/[id]
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/folders/[id]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ id: string }> };

async function proxyRequest(request: NextRequest, id: string, method: string) {
  const daasUrl = getDaasUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/folders/${id}${searchParams ? `?${searchParams}` : ''}`;

  const fetchOptions: RequestInit = { method, headers, cache: 'no-store' };

  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = request.headers.get('content-type');
    if (contentType) {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = contentType;
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
  const { id } = await params;
  try {
    return await proxyRequest(request, id, 'GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return await proxyRequest(request, id, 'PATCH');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return await proxyRequest(request, id, 'DELETE');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
