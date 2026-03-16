/**
 * DaaS Fields Proxy Route
 *
 * Proxies /api/fields/[collection] requests to the DaaS backend.
 * Avoids CORS issues and keeps DaaS credentials server-side.
 *
 * GET /api/fields/[collection]  → DaaS GET /api/fields/{collection}
 *
 * This file is copied to your project by the Buildpad CLI.
 * Location: app/api/fields/[collection]/route.ts
 *
 * Env vars required:
 *   BUILDPAD_DAAS_URL  (or NEXT_PUBLIC_BUILDPAD_DAAS_URL) — DaaS base URL
 *   NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

type Params = { params: Promise<{ collection: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { collection } = await params;

  try {
    const daasUrl = getDaaSUrl();
    const headers = await getAuthHeaders();
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${daasUrl}/api/fields/${collection}${searchParams ? `?${searchParams}` : ''}`;

    const response = await fetch(url, { headers, cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ errors: [{ message }] }, { status: 500 });
  }
}
