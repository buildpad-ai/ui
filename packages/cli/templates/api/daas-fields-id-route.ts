/**
 * DaaS Field by Name Proxy Route
 *
 * Proxies /api/fields/[collection]/[field] requests to the DaaS backend.
 *
 * GET    /api/fields/[collection]/[field]  → DaaS GET    /api/fields/{collection}/{field}
 * PATCH  /api/fields/[collection]/[field]  → DaaS PATCH  /api/fields/{collection}/{field}  (alter — DDL)
 * DELETE /api/fields/[collection]/[field]  → DaaS DELETE /api/fields/{collection}/{field}  (drop — DDL)
 *
 * PATCH/DELETE mutate the schema (DDL) and require DaaS **schema rights**; DaaS
 * enforces them and returns the error verbatim on insufficient privileges.
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/fields/[collection]/[field]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ collection: string; field: string }> };

async function proxyRequest(
  request: NextRequest,
  collection: string,
  field: string,
  method: string
) {
  const daasUrl = getDaasUrl();
  const headers = await getAuthHeaders();
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${daasUrl}/api/fields/${collection}/${field}${searchParams ? `?${searchParams}` : ''}`;

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
  const { collection, field } = await params;
  try {
    return await proxyRequest(request, collection, field, 'GET');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { collection, field } = await params;
  try {
    return await proxyRequest(request, collection, field, 'PATCH');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { collection, field } = await params;
  try {
    return await proxyRequest(request, collection, field, 'DELETE');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
