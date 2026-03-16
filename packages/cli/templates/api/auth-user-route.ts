/**
 * Auth User API Route (Proxy)
 * 
 * Returns the currently authenticated user's information.
 * Proxies through the Next.js server to avoid CORS issues.
 * 
 * @buildpad/origin: api-routes/auth-user
 * @buildpad/version: 1.0.0
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
