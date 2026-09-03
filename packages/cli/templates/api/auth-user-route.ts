/**
 * Auth User API Route (Proxy)
 * 
 * Returns the currently authenticated user's information.
 * Proxies through the Next.js server to avoid CORS issues.
 * 
 * @buildpad/origin: api-routes/auth-user
 * @buildpad/version: 1.1.0
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthHeaders, getDaasUrl } from '@/lib/api/auth-headers';

/**
 * GET /api/auth/user
 * 
 * Returns current user info. Tries DaaS backend first (for full user profile
 * with roles/permissions), falls back to Supabase Auth user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    // Try to get enhanced user profile from DaaS backend
    try {
      const headers = await getAuthHeaders();
      const daasUrl = getDaasUrl();

      const response = await fetch(`${daasUrl}/api/users/me`, {
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ data: data.data || data });
      }
    } catch {
      // DaaS not available, fall back to Supabase user
    }

    // Fallback: return basic Supabase user info
    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || null,
        last_name: user.user_metadata?.last_name || null,
        avatar: user.user_metadata?.avatar || null,
        status: 'active',
        role: null,
        roles: [],
        admin_access: false,
      },
    });
  } catch (error) {
    console.error('Auth user error:', error);
    return NextResponse.json(
      { errors: [{ message: 'Failed to get user info' }] },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/user
 *
 * Updates the signed-in user's own profile on DaaS (`PATCH /users/me`).
 * The LanguageSwitcher uses it to remember the chosen locale, so the
 * preference survives on another device; the NEXT_LOCALE cookie is what the
 * middleware actually reads.
 *
 * Only the fields below are forwarded — a user must not be able to grant
 * themselves a role, status or admin_access through their own profile.
 */
const SELF_EDITABLE_FIELDS = ['language', 'theme', 'first_name', 'last_name', 'avatar'] as const;

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { errors: [{ message: 'Authentication required' }] },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    for (const field of SELF_EDITABLE_FIELDS) {
      if (body[field] !== undefined) payload[field] = body[field];
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { errors: [{ message: `No editable fields provided (allowed: ${SELF_EDITABLE_FIELDS.join(', ')})` }] },
        { status: 400 }
      );
    }

    const headers = await getAuthHeaders();
    const daasUrl = getDaasUrl();

    const response = await fetch(`${daasUrl}/api/users/me`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { errors: data?.errors ?? [{ message: 'Failed to update profile' }] },
        { status: response.status }
      );
    }

    return NextResponse.json({ data: data.data ?? data });
  } catch (error) {
    console.error('Auth user update error:', error);
    return NextResponse.json(
      { errors: [{ message: 'Failed to update profile' }] },
      { status: 500 }
    );
  }
}
