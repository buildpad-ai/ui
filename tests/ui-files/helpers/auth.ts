import type { APIRequestContext } from '@playwright/test';

const HOST_URL = 'http://localhost:3000';

/**
 * Connect the storybook-host proxy session as the given token's user.
 * Calls POST /api/connect on the host app, which stores an encrypted
 * cookie valid for both :3000 and the :6009 Storybook proxy.
 */
export async function connectAs(request: APIRequestContext, token: string): Promise<void> {
  const filesUrl = process.env.FILES_DAAS_URL ?? '';
  if (!filesUrl) throw new Error('FILES_DAAS_URL env var is not set');

  const res = await request.post(`${HOST_URL}/api/connect`, {
    data: { url: filesUrl, token },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`connectAs failed (${res.status()}): ${body.slice(0, 200)}`);
  }
}
