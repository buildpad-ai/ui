/**
 * DaaS Collections Proxy Route
 *
 * Proxies /api/collections requests to the DaaS backend.
 *
 * GET  /api/collections  → DaaS GET  /api/collections  (list)
 * POST /api/collections  → DaaS POST /api/collections  (create collection — DDL)
 *
 * The POST handler provisions a new collection/table (DDL). It requires DaaS
 * **schema rights**; DaaS enforces them and returns the error verbatim on
 * insufficient privileges or a name conflict.
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/collections/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

async function proxyRequest(request: NextRequest, method: string) {
  const daasUrl = getDaasUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/collections${searchParams ? `?${searchParams}` : ''}`;

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

export async function GET(request: NextRequest) {
  try {
    return await proxyRequest(request, 'GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await proxyRequest(request, 'POST');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
