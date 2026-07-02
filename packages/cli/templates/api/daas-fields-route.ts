/**
 * DaaS Fields Proxy Route
 *
 * Proxies /api/fields/[collection] requests to the DaaS backend.
 * Avoids CORS issues and keeps DaaS credentials server-side.
 *
 * GET  /api/fields/[collection]  → DaaS GET  /api/fields/{collection}  (read)
 * POST /api/fields/[collection]  → DaaS POST /api/fields/{collection}  (create field — DDL)
 *
 * The POST handler provisions a new column (DDL). It requires DaaS **schema
 * rights**; DaaS enforces them and returns the error verbatim on insufficient
 * privileges or a name conflict.
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/fields/[collection]/route.ts
 *
 * Env vars required:
 *   BUILDPAD_DAAS_URL  (or NEXT_PUBLIC_BUILDPAD_DAAS_URL) — DaaS base URL
 *   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase auth
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
  const url = `${daasUrl}/api/fields/${collection}${searchParams ? `?${searchParams}` : ''}`;

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
