/**
 * DaaS Files Proxy Route (by ID)
 *
 * Proxies /api/files/[id] requests to the DaaS backend.
 * Used by File, FileImage, and Files components for metadata, update, and deletion.
 *
 * GET    /api/files/[id] → DaaS GET    /api/files/[id] (get file metadata)
 * PATCH  /api/files/[id] → DaaS PATCH  /api/files/[id] (update file metadata)
 * DELETE /api/files/[id] → DaaS DELETE /api/files/[id] (delete file)
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/files/[id]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ id: string }> };

async function proxyRequest(request: NextRequest, id: string, method: string) {
  const daasUrl = getDaasUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/files/${id}${searchParams ? `?${searchParams}` : ''}`;

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
