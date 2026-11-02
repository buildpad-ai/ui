/**
 * Engine Catch-All Proxy Route
 *
 * Proxies every /api path that has no route of its own to the same path on the
 * Buildpad Engine: users, roles, policies, permissions, access, workflows, cron,
 * versions, utils, scope and the rest. The Users, Workflows and Cron modules
 * call these from the browser, and on an Engine project the browser calls only
 * the app's own /api routes. The routes in app/api still answer their own
 * paths; this one answers the rest. The Engine checks the user's permissions.
 *
 * GET|POST|PATCH|PUT|DELETE /api/<path> → the same method and path on the Engine
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
 * Location: app/api/[...path]/route.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { forwardToEngine } from '@/lib/api/forward';

type RouteParams = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  // A "." or ".." segment would take the request out of /api on the Engine.
  if (path.some(segment => segment === '.' || segment === '..')) {
    return NextResponse.json({ errors: [{ message: 'Not found' }] }, { status: 404 });
  }
  return forwardToEngine(request, `/api/${path.map(encodeURIComponent).join('/')}`);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
