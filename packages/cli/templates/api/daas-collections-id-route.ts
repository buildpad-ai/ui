/**
 * DaaS Collection by Name Proxy Route
 *
 * Proxies /api/collections/[collection] requests to the DaaS backend.
 *
 * GET    /api/collections/[collection]  → DaaS GET    /api/collections/{collection}
 * DELETE /api/collections/[collection]  → DaaS DELETE /api/collections/{collection}  (drop — DDL)
 *
 * DELETE drops the table (DDL) and requires DaaS **schema rights**; DaaS enforces
 * them and returns the error verbatim on insufficient privileges.
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/collections/[collection]/route.ts
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
  const url = `${daasUrl}/api/collections/${collection}${searchParams ? `?${searchParams}` : ''}`;

  const response = await fetch(url, { method, headers, cache: 'no-store' });

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

export async function DELETE(request: NextRequest, { params }: Params) {
  const { collection } = await params;
  try {
    return await proxyRequest(request, collection, 'DELETE');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
