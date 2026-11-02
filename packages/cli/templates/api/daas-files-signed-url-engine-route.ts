/**
 * Engine Signed File URL Proxy Route
 *
 * Proxies /api/files/signed-url to the Buildpad Engine. Used by the file
 * hooks to show a file without a session and to start a direct upload.
 *
 * GET    /api/files/signed-url?id=&expires= → a URL that shows the file
 * POST   /api/files/signed-url { filename_download, type, filesize, folder? } → start a direct upload
 * DELETE /api/files/signed-url { upload_token } → discard a direct upload that was not registered
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
 * Location: app/api/files/signed-url/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { forwardToEngine } from '@/lib/api/forward';
import { getDaasUrl } from '@/lib/api/auth-headers';

export async function GET(request: NextRequest) {
  const response = await forwardToEngine(request, '/api/files/signed-url');
  if (!response.ok) return response;
  const { data } = await response.json();
  // On the Engine's own disk the URL is a path on the Engine; on S3 it is a full address.
  const url =
    typeof data?.url === 'string' && data.url.startsWith('/') ? `${getDaasUrl()}${data.url}` : data?.url;
  return NextResponse.json({ data: { ...data, url } });
}

export async function POST(request: NextRequest) {
  return forwardToEngine(request, '/api/files/signed-url');
}

export async function DELETE(request: NextRequest) {
  return forwardToEngine(request, '/api/files/signed-url');
}
