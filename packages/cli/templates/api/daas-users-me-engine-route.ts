/**
 * Engine Current User Proxy Route
 *
 * Proxies /api/users/me to the Buildpad Engine. Used by useAuth and the
 * profile helpers to read and update the signed-in user.
 *
 * GET   /api/users/me → Engine GET   /api/users/me (supports ?fields=)
 * PATCH /api/users/me → Engine PATCH /api/users/me (password fields dropped)
 *
 * This file is copied to your project by the Buildpad CLI (Engine projects).
 * Location: app/api/users/me/route.ts
 */

import { type NextRequest } from 'next/server';
import { forwardToEngine } from '@/lib/api/forward';

export async function GET(request: NextRequest) {
  return forwardToEngine(request, '/api/users/me');
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  // Send no password change from the application: on an Engine project an
  // administrator resets a user's password, in the Studio's Users module.
  delete body.password;
  delete body.current_password;
  return forwardToEngine(request, '/api/users/me', JSON.stringify(body));
}
