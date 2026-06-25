/**
 * DaaS Files Import Proxy Route
 *
 * Proxies /api/files/import requests to the DaaS backend.
 * Used by the Files module (and useFiles().importFromUrl) to fetch a remote
 * file server-side and store it in Supabase Storage.
 *
 * POST /api/files/import → DaaS POST /api/files/import
 *   body: { url: string, data?: { folder?, title?, description?, ... } }
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/files/import/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

export async function POST(request: NextRequest) {
  try {
    const daasUrl = getDaasUrl();
    const headers = await getAuthHeaders();

    const body = await request.text();
    const response = await fetch(`${daasUrl}/api/files/import`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
