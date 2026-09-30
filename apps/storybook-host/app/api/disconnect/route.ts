/**
 * POST /api/disconnect
 *
 * Clears the DaaS config cookie. A present Origin header must match this
 * host (blocks cross-site logout CSRF).
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearDaaSConfig } from '@/lib/cookie';
import { originMatchesHost } from '@/lib/request-guards';

export async function POST(request: NextRequest) {
  if (!originMatchesHost(request)) {
    return NextResponse.json(
      { error: 'Cross-origin requests are not allowed' },
      { status: 403 }
    );
  }
  await clearDaaSConfig();
  return NextResponse.json({ success: true });
}
