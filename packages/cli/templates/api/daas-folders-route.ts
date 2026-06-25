/**
 * DaaS Folders Proxy Route
 *
 * Proxies /api/folders requests to the DaaS backend.
 * Used by the Files module to list and create folders for organizing files.
 *
 * GET  /api/folders → DaaS GET  /api/folders (list folders, supports ?filter/?search)
 * POST /api/folders → DaaS POST /api/folders (create folder)
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/folders/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  try {
    const daasUrl = getDaasUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/folders${searchParams ? `?${searchParams}` : ''}`;

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
    const headers = await getAuthHeaders();

    const body = await request.text();
    const response = await fetch(`${daasUrl}/api/folders`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
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
