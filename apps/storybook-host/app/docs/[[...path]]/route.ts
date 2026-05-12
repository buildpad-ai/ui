import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path: segments } = await params;
  const requestedPath = (segments ?? []).join('/');

  const publicDir = path.join(process.cwd(), 'public', 'docs');
  let filePath = path.join(publicDir, requestedPath);

  if (!filePath.startsWith(publicDir)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    let content: Buffer;
    let isDirectory = false;
    try {
      content = await readFile(filePath);
    } catch {
      if (!path.extname(filePath)) {
        filePath = path.join(filePath, 'index.html');
        content = await readFile(filePath);
        isDirectory = true;
      } else {
        throw new Error('Not found');
      }
    }

    if (isDirectory) {
      const pathname = request.nextUrl.pathname;
      if (!pathname.endsWith('/')) {
        return new NextResponse(null, {
          status: 302,
          headers: { Location: pathname + '/' },
        });
      }
    }

    const mimeType = getMimeType(filePath);
    const cacheControl = filePath.endsWith('.html')
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=31536000, immutable';

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': cacheControl,
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
