/**
 * Session-Based Authentication Client
 * 
 * This module provides authentication utilities that support multiple auth methods:
 * 1. Cookie-Based Sessions - For browser requests
 * 2. JWT Bearer Tokens - For API clients with Supabase Auth  
 * 3. Static Tokens - For programmatic access (DaaS-style)
 * 
 * @module @buildpad/services/auth/session
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Supabase client interface (generic type for compatibility with any Supabase client)
 * Projects using this module should install @supabase/supabase-js for full type support
 */
export interface SupabaseClient {
  from: (table: string) => any;
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  auth: {
    getUser: () => Promise<{ data: { user: User | null }; error: Error | null }>;
  };
}

/**
 * User type (compatible with Supabase User)
 */
export interface User {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
}

/**
 * Authentication error thrown when user is not authenticated
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Not authenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Result from createAuthenticatedClient
 */
export interface AuthenticatedClient {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Accountability info for audit logging
 */
export interface AccountabilityInfo {
  user: string;
  role: string | null;
  admin: boolean;
  app: boolean;
  ip?: string;
}

/**
 * Configuration for auth client factory
 */
export interface AuthClientConfig {
  /** Supabase URL */
  supabaseUrl: string;
  /** Supabase anon key */
  supabaseAnonKey: string;
  /** Supabase service role key (optional, for static token auth) */
  supabaseServiceKey?: string;
  /** Cookie configuration */
  cookieConfig?: {
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    path?: string;
    maxAge?: number;
  };
  /** Function to get request headers */
  getHeaders: () => Promise<Headers> | Headers;
  /** Function to get/set cookies (for SSR) */
  getCookies: () => Promise<{
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string, options: Record<string, unknown>) => void;
  }>;
  /** Function to create Supabase server client */
  createServerClient: (
    url: string,
    key: string,
    options: Record<string, unknown>
  ) => SupabaseClient;
  /** Function to create Supabase client */
  createClient: (
    url: string,
    key: string,
    options?: Record<string, unknown>
  ) => SupabaseClient;
}

// Module-level config storage
let _config: AuthClientConfig | null = null;

/**
 * Configure the auth module
 * 
 * @example
 * ```typescript
 * // In your app initialization
 * import { configureAuth } from '@buildpad/services/auth';
 * import { createServerClient } from '@supabase/ssr';
 * import { createClient } from '@supabase/supabase-js';
 * import { cookies, headers } from 'next/headers';
 * 
 * configureAuth({
 *   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *   supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
 *   getHeaders: () => headers(),
 *   getCookies: () => cookies(),
 *   createServerClient,
 *   createClient,
 * });
 * ```
 */
export function configureAuth(config: AuthClientConfig): void {
  _config = config;
}

/**
 * Get auth configuration
 */
export function getAuthConfig(): AuthClientConfig {
  if (!_config) {
    throw new Error(
      'Auth module not configured. Call configureAuth() before using auth functions.'
    );
  }
  return _config;
}

/**
 * Create a Supabase client with flexible authentication.
 * 
 * Supports:
 * 1. Authorization header with Bearer token (JWT or static token)
 * 2. Cookie-based session (for browser requests)
 * 
 * @throws {AuthenticationError} If user is not authenticated
 * @returns Promise containing supabase client and authenticated user
 * 
 * @example
 * ```typescript
 * // Works with both bearer token and cookies
 * const { supabase, user } = await createAuthenticatedClient();
 * const { data } = await supabase.from('daas_users').select('*');
 * ```
 */
export async function createAuthenticatedClient(): Promise<AuthenticatedClient> {
  const config = getAuthConfig();
  
  // First, try to get bearer token from Authorization header
  const headersList = await config.getHeaders();
  const authorization = headersList.get('authorization');
  
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.substring(7); // Remove 'Bearer ' prefix
    
    // Check if this looks like a JWT (has 3 dot-separated segments)
    const isJWT = token.split('.').length === 3;
    
    if (isJWT) {
      // Try JWT authentication with Supabase Auth
      const supabase = config.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
      
      // Verify user is authenticated
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error && user) {
        return { supabase, user };
      }
      // If JWT validation fails, continue to try static token authentication
    }
    
    // Try static token authentication (DaaS-style)
    // Requires service role key
    if (!config.supabaseServiceKey) {
      throw new AuthenticationError('Static token authentication requires service role key');
    }
    
    const serviceClient = config.createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    // Query user by static token
    const { data: userData, error: tokenError } = await serviceClient
      .from('daas_users')
      .select('id, email, first_name, last_name, status, admin_access')
      .eq('token', token)
      .single();
    
    if (tokenError || !userData) {
      throw new AuthenticationError('Authentication failed: invalid token');
    }
    
    // Check if user is active
    if (userData.status !== 'active') {
      throw new AuthenticationError('Authentication failed: user is not active');
    }

    // Get user's primary role via junction table
    const { data: primaryRole } = await serviceClient
      .from('daas_user_roles')
      .select('role_id')
      .eq('user_id', userData.id)
      .order('sort', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    // Create a user object compatible with Supabase User type
    const staticUser: User = {
      id: userData.id,
      email: userData.email,
      app_metadata: {},
      user_metadata: {
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: primaryRole?.role_id ?? null,
        admin_access: userData.admin_access,
      },
      aud: 'authenticated',
      created_at: '',
    };
    
    // Return service client for static token users (bypasses RLS)
    // This is safe because we've validated the token
    return { supabase: serviceClient, user: staticUser };
  }
  
  // Fall back to cookie-based authentication
  const cookieStore = await config.getCookies();
  const cookieConfig = config.cookieConfig ?? {};

  const supabase = config.createServerClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const mergedOptions = {
                ...options,
                sameSite: cookieConfig.sameSite ?? options.sameSite ?? 'lax',
                secure: cookieConfig.secure ?? options.secure ?? true,
                path: cookieConfig.path ?? options.path ?? '/',
                maxAge: options.maxAge ?? cookieConfig.maxAge,
                httpOnly: options.httpOnly ?? true,
              };
              cookieStore.set(name, value, mergedOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );

  // Verify user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw new AuthenticationError(`Authentication failed: ${error.message}`);
  }
  
  if (!user) {
    throw new AuthenticationError('User not authenticated');
  }

  return { supabase, user };
}

/**
 * Get the current authenticated user from the session.
 * 
 * @throws {AuthenticationError} If user is not authenticated
 * @returns Promise containing the authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  const { user } = await createAuthenticatedClient();
  return user;
}

/**
 * Check if the current user has admin access.
 * 
 * @throws {AuthenticationError} If user is not authenticated
 * @returns Promise<boolean> true if user has admin_access = true
 */
export async function isAdmin(): Promise<boolean> {
  const { supabase, user } = await createAuthenticatedClient();
  
  const { data, error } = await supabase
    .from('daas_users')
    .select('admin_access')
    .eq('id', user.id)
    .single();
  
  if (error) {
    console.error('Error checking admin access:', error);
    return false;
  }
  
  return data?.admin_access ?? false;
}

/**
 * Get the current user's role ID.
 * 
 * @throws {AuthenticationError} If user is not authenticated
 * @returns Promise<string | null> role ID or null if no role assigned
 */
export async function getUserRole(): Promise<string | null> {
  const { supabase, user } = await createAuthenticatedClient();
  
  // Get primary role via junction table (multi-role architecture)
  const { data, error } = await supabase
    .from('daas_user_roles')
    .select('role_id')
    .eq('user_id', user.id)
    .order('sort', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error getting user role:', error);
    return null;
  }
  
  return data?.role_id ?? null;
}

/**
 * Get the current user's full profile data.
 * 
 * @throws {AuthenticationError} If user is not authenticated
 * @returns Promise containing user profile data
 */
export async function getUserProfile() {
  const { supabase, user } = await createAuthenticatedClient();
  
  const { data, error } = await supabase
    .from('daas_users')
    .select(`
      id,
      email,
      first_name,
      last_name,
      avatar,
      location,
      title,
      description,
      language,
      theme,
      status,
      admin_access,
      roles:daas_user_roles(...daas_roles(id, name, icon))
    `)
    .eq('id', user.id)
    .single();
  
  if (error) {
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
  
  return data;
}

/**
 * Get accountability information for the current user.
 * Returns null if user is not authenticated (doesn't throw).
 */
export async function getAccountability(): Promise<AccountabilityInfo | null> {
  try {
    const { user } = await createAuthenticatedClient();
    const roleId = await getUserRole();
    const adminAccess = await isAdmin();
    
    return {
      user: user.id,
      role: roleId,
      admin: adminAccess,
      app: true,
      ip: undefined,
    };
  } catch {
    // User not authenticated
    return null;
  }
}

/**
 * Type guard to check if error is AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}
