/**
 * DaaS Files Proxy Route
 *
 * Proxies /api/files requests to the DaaS backend.
 * Used by File, FileImage, and Files components for uploads and metadata.
 *
 * GET    /api/files  → DaaS GET  /api/files  (list files)
 * POST   /api/files  → DaaS POST /api/files  (upload file — multipart/form-data)
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/files/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaasUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/files${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const daasUrl = getDaasUrl();
    // For file uploads, forward auth header but NOT Content-Type
    // (the browser/fetch sets the correct multipart boundary automatically)
    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = {};
    if (authHeaders['Authorization']) {
      headers['Authorization'] = authHeaders['Authorization'];
    }

    // Forward the raw body (multipart/form-data) as-is
    const body = await request.arrayBuffer();
    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const response = await fetch(`${daasUrl}/api/files`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
