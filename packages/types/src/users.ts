/**
 * Users / Roles / Policies / Access Types
 *
 * TypeScript type definitions for the DaaS access-control domains consumed by
 * `@buildpad/ui-users`: users, roles, policies, and the `daas_access` junction
 * table. Mirrors the reference admin UI in buildpad-daas (`app/{users,roles,policies}`).
 *
 * These are additive and intentionally separate from the two existing
 * `DaaSUser` interfaces (`packages/services/src/daas-context.tsx` and
 * `packages/hooks/src/api.ts`), which represent the *currently authenticated*
 * user in each of those modules' own narrower shapes. Both are left untouched.
 */

/**
 * User account status.
 */
export type UserStatus = 'active' | 'suspended' | 'invited' | 'draft' | 'terminated';

/**
 * User entity representing a `daas_users` row.
 */
export interface User {
  /** Unique identifier for the user */
  id: string;

  /** Email address (unique, used for login) */
  email: string;

  /** Write-only — only sent on create or password reset, never returned by the API */
  password?: string;

  /** First name */
  first_name: string | null;

  /** Last name */
  last_name: string | null;

  /** Job title */
  title?: string | null;

  /** Free-text description/bio */
  description?: string | null;

  /** Location */
  location?: string | null;

  /** Arbitrary tags */
  tags?: string[] | null;

  /** UI language preference */
  language?: string | null;

  /** UI theme preference */
  theme?: string | null;

  /**
   * Avatar image source, rendered verbatim as the `<img src>` (no asset-URL
   * construction). Display-only pass-through — this module never writes it
   * (the user form excludes `avatar`; upload is out of scope).
   */
  avatar?: string | null;

  /** Account status */
  status: UserStatus;

  /** Static API token (masked in the UI, regenerable) */
  token?: string | null;

  /** Timestamp of the user's last authenticated request */
  last_access?: string | null;

  /**
   * Many-to-many roles via the `daas_user_roles` junction. Each element is
   * either a full `Role` object (when fetched with a relation join) or a bare
   * role ID string.
   */
  roles?: Array<string | { id: string; name: string; icon?: string | null }>;

  /**
   * Whether this user has admin access. Computed server-side from the user's
   * attached/role policies (`admin_access` on any attached `Policy`) —
   * NEVER write this field back to the API. `updateUser` strips it.
   */
  readonly admin_access?: boolean;

  /** Number of policies directly attached to this user (list/detail enrichment) */
  policyCount?: number;

  created_at?: string;
  updated_at?: string;
}

/**
 * Scope-assignment rules for a role: an allow-list of regex patterns that a
 * scope URI must match for a user to be assignable to the role, plus an
 * optional custom validation message shown when assignment is rejected.
 */
export interface RoleScopeConfig {
  allowed_scopes: string[];
  validation_message?: string;
}

/**
 * Role entity representing a `daas_roles` row.
 */
export interface Role {
  /** Unique identifier for the role */
  id: string;

  /** Role name */
  name: string;

  /** Icon name (Tabler or legacy Material Icon name via `IconDisplay`/`SelectIcon`) */
  icon?: string | null;

  /** Description */
  description?: string | null;

  /** Parent role ID — self-FK hierarchy (null/undefined for a top-level role) */
  parent?: string | null;

  /** Scope-assignment rules, or `null` when disabled */
  scope_config?: RoleScopeConfig | null;

  /**
   * Whether the role can be assigned at the current request's scope —
   * computed server-side from `scope_config` (always true when `scope_config`
   * is null). Read-only; never write this field.
   */
  readonly assignable?: boolean;

  /**
   * Member count, present when the role was fetched with `includeUsers=true`.
   * Shape matches the DaaS count-aggregate response: `users[0].count`.
   */
  users?: Array<{ count?: number }>;

  /** Attached policies, present when the role was fetched with `includePolicies=true` */
  policies?: Access[];

  /** Child roles (when the client builds the hierarchy — no dedicated tree endpoint) */
  children?: Role[];

  created_at?: string;
  updated_at?: string;
}

/**
 * Policy entity representing a `daas_policies` row.
 */
export interface Policy {
  /** Unique identifier for the policy */
  id: string;

  /** Policy name */
  name: string;

  /** Icon name */
  icon?: string | null;

  /** Description */
  description?: string | null;

  /** Grants full administrative privileges */
  admin_access: boolean;

  /** Allows access to the app with minimal baseline permissions */
  app_access: boolean;

  /** Allows using the `X-On-Behalf-Of` header to delegate audit identity */
  delegate_access?: boolean;

  /** Number of users this policy is attached to (list/detail enrichment) */
  userCount?: number;

  /** Number of roles this policy is attached to (list/detail enrichment) */
  roleCount?: number;

  created_at?: string;
  updated_at?: string;
}

/**
 * `daas_access` junction row: attaches a policy to either a role or a user
 * (mutually exclusive — both null means a public/unscoped policy).
 */
export interface Access {
  /** Unique identifier for the access row */
  id: string;

  /** The policy being assigned — full object or bare ID */
  policy: string | Policy;

  /** Role the policy is attached to, if role-scoped */
  role?: string | Role | null;

  /** User the policy is attached to, if user-scoped */
  user?: string | User | null;

  /** Sort order for priority when multiple policies apply */
  sort?: number | null;
}

/**
 * List-response pagination envelope shared by the users/roles/policies list
 * endpoints: `{ count, totalCount, page, pageSize, totalPages }`.
 */
export interface ListMeta {
  /** Number of items in the current page */
  count: number;
  /** Total number of items across all pages (respecting filters) */
  totalCount: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
}
