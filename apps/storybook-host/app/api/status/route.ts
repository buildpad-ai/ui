/**
 * GET /api/status
 *
 * Returns the current DaaS connection status.
 * Called by Storybook stories to check if the host proxy is ready.
 */

import { NextResponse } from 'next/server';
import { clearDaaSConfig, CookieSecretError, getDaaSConfig } from '@/lib/cookie';
import { buildDaaSTargetUrl, validateDaaSUrl } from '@/lib/daas-url';

const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET() {
  let config;
  try {
    config = await getDaaSConfig();
  } catch (error) {
    if (error instanceof CookieSecretError) {
      console.error('[DaaS status]', error.message);
      return NextResponse.json(
        {
          connected: false,
          url: null,
          user: null,
          error: 'Server is not configured to store DaaS credentials (COOKIE_SECRET).',
        },
        { status: 500 }
      );
    }
    throw error;
  }

  if (!config) {
    return NextResponse.json({
      connected: false,
      url: null,
      user: null,
    });
  }

  // Re-validate the stored URL (SSRF guard) before fetching it.
  const validated = validateDaaSUrl(config.url);
  const testUrl = validated.ok
    ? buildDaaSTargetUrl(validated.url, '/api/users/me')
    : null;
  if (!validated.ok || !testUrl) {
    await clearDaaSConfig();
    return NextResponse.json({
      connected: false,
      url: null,
      user: null,
      error: validated.ok
        ? 'Stored DaaS URL is invalid. Please reconnect.'
        : `Stored DaaS connection is no longer allowed: ${validated.error} Please reconnect.`,
    });
  }

  // Verify connection by fetching current user
  try {
    const response = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return NextResponse.json({
        connected: true,
        url: validated.url,
        user: null,
        error:
          response.status >= 300 && response.status < 400
            ? `Unexpected redirect: ${response.status}`
            : `Auth failed: ${response.status}`,
      });
    }

    const userData = await response.json();

    return NextResponse.json({
      connected: true,
      url: validated.url,
      user: userData.data || userData,
    });
  } catch (error) {
    console.error('[DaaS status] Upstream request failed:', error);
    return NextResponse.json({
      connected: true,
      url: validated.url,
      user: null,
      error: 'Connection error',
    });
  }
}
