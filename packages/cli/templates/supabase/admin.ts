/**
 * Supabase Admin Client
 *
 * Server-side client using service role key for admin operations.
 * Used for JIT (Just-In-Time) user provisioning when using external OAuth providers.
 *
 * ⚠️ NEVER expose service role key to the browser.
 * Only import this module in server-side code (API routes, Server Components).
 *
 * @buildpad/origin: supabase/admin
 * @buildpad/version: 1.0.0
 */

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// Singleton admin client
let adminClient: SupabaseClient | null = null;

/**
 * Create or return cached Supabase admin client.
 * Uses service role key which bypasses RLS.
 */
export function createSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. ' +
      'Needed to create users from external OAuth providers.'
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Options for finding or creating a user.
 */
export interface FindOrCreateUserOptions {
  /** User's email address */
  email: string;
  /** Whether email is verified by the IDP */
  emailVerified: boolean;
  /** OAuth provider name (e.g., 'azure', 'google') */
  provider: string;
  /** User's ID from the provider */
  providerId: string;
  /** Additional user metadata from the IDP */
  metadata: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
}

/**
 * Result of find or create user operation.
 */
export interface UserSessionResult {
  /** The Supabase user */
  user: User;
  /** Session with access and refresh tokens */
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at: number;
  };
  /** Whether this is a newly created user */
  isNewUser: boolean;
}

/**
 * Find an existing user by email or create a new one, then generate a session.
 *
 * This implements JIT user provisioning: users are created in Supabase on first
 * OAuth login, and their profile is updated on subsequent logins.
 *
 * Note: Supabase Admin API does not expose getUserByEmail().
 * We work around this by paginating through listUsers().
 */
export async function findOrCreateUser(
  options: FindOrCreateUserOptions
): Promise<UserSessionResult> {
  const supabase = createSupabaseAdmin();
  const { email, emailVerified, provider, providerId, metadata } = options;

  const providerInfo = {
    provider,
    provider_id: providerId,
    linked_at: new Date().toISOString(),
  };

  // ─── Step 1: Find user by email (paginate through listUsers) ───────────
  // There is no getUserByEmail() in the Admin API.
  let existingUser: User | null = null;
  let page = 1;
  const perPage = 1000;

  while (!existingUser) {
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const found = usersData?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) {
      existingUser = found;
      break;
    }

    if (!usersData?.users || usersData.users.length < perPage) {
      break;
    }

    page++;
  }

  let user: User;
  let isNewUser = false;

  if (existingUser) {
    // ─── Step 2A: User exists — update metadata with latest IDP info ───
    user = existingUser;

    const existingProviders =
      (user.user_metadata?.linked_providers as typeof providerInfo[] | undefined) || [];

    const isAlreadyLinked = existingProviders.some(
      (p) => p.provider === provider && p.provider_id === providerId
    );

    if (!isAlreadyLinked) {
      const { data: updatedUser, error: updateError } =
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            full_name: metadata.fullName || user.user_metadata?.full_name,
            first_name: metadata.firstName || user.user_metadata?.first_name,
            last_name: metadata.lastName || user.user_metadata?.last_name,
            avatar_url: metadata.avatarUrl || user.user_metadata?.avatar_url,
            linked_providers: [...existingProviders, providerInfo],
          },
          email_confirm: emailVerified,
        });

      if (updateError) {
        console.error('Failed to update user metadata:', updateError);
        // Non-fatal: continue with existing user data
      } else if (updatedUser?.user) {
        user = updatedUser.user;
      }
    }
  } else {
    // ─── Step 2B: User doesn't exist — create new user ─────────────────
    isNewUser = true;

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: emailVerified,
        user_metadata: {
          full_name: metadata.fullName,
          first_name: metadata.firstName,
          last_name: metadata.lastName,
          avatar_url: metadata.avatarUrl,
          linked_providers: [providerInfo],
        },
        app_metadata: {
          provider,
          provider_id: providerId,
          providers: [provider],
        },
      });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser?.user) {
      throw new Error('User creation returned no user');
    }

    user = newUser.user;
  }

  // ─── Step 3: Generate a Supabase session for the user ─────────────────
  const session = await generateUserSession(supabase, user);

  return { user, session, isNewUser };
}

/**
 * Generate a valid Supabase session for a user.
 *
 * Uses the magic link generation + OTP verification flow to produce
 * a real access_token / refresh_token pair without sending any email.
 */
async function generateUserSession(
  supabase: SupabaseClient,
  user: User
): Promise<UserSessionResult['session']> {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email!,
    options: {
      redirectTo: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  });

  if (linkError) {
    throw new Error(`Failed to generate session link: ${linkError.message}`);
  }

  if (!linkData?.properties?.hashed_token) {
    throw new Error('No hashed token in link response');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });

  if (sessionError) {
    throw new Error(`Failed to create session: ${sessionError.message}`);
  }

  if (!sessionData?.session) {
    throw new Error('No session returned from OTP verification');
  }

  const session = sessionData.session;

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in || 3600,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Get a user by ID.
 */
export async function getUserById(userId: string): Promise<User | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    console.error('Failed to get user:', error);
    return null;
  }

  return data?.user ?? null;
}

/**
 * Delete a user (useful for tests and cleanup).
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Failed to delete user:', error);
    return false;
  }

  return true;
}
