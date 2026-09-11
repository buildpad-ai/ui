/**
 * POST /api/connect
 *
 * Receives DaaS URL + static token, validates the connection by
 * calling /api/users/me, then stores the config in an encrypted cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setDaaSConfig } from '@/lib/cookie';

export async function POST(request: NextRequest) {
  try {
    const { url, token } = await request.json();

    if (!url || !token) {
      return NextResponse.json(
        { error: 'DaaS URL and token are required' },
        { status: 400 }
      );
    }

    // Clean the URL (strip trailing slashes)
    const cleanUrl = url.replace(/\/+$/, ''); // NOSONAR: single anchored quantifier, linear

    // Test connection by fetching the current user
    const testResponse = await fetch(`${cleanUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      return NextResponse.json(
        {
          error: `Connection failed (${testResponse.status}): ${errorText.slice(0, 200)}`,
        },
        { status: 400 }
      );
    }

    const userData = await testResponse.json();

    // Save config to encrypted httpOnly cookie
    await setDaaSConfig({ url: cleanUrl, token });

    return NextResponse.json({
      success: true,
      user: userData.data || userData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to connect to DaaS',
      },
      { status: 500 }
    );
  }
}
