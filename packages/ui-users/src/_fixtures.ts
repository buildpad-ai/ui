/**
 * Shared mock data for Storybook stories of the prop-driven components.
 *
 * Internal to the stories only — intentionally NOT exported from `index.ts`
 * and not bundled by tsup (it builds `src/index.ts` alone).
 */
import type { Access, Policy, Role, User } from '@buildpad/types';

export const mockRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    icon: 'supervised_user_circle',
    description: 'Full administrative access to all collections and settings.',
    parent: null,
    scope_config: null,
    users: [{ count: 2 }],
    created_at: new Date('2026-01-10T09:00:00Z').toISOString(),
    updated_at: new Date('2026-05-01T09:00:00Z').toISOString(),
  },
  {
    id: 'role-editor',
    name: 'Editor',
    icon: 'edit',
    description: 'Can create and edit content, no administrative access.',
    parent: 'role-admin',
    scope_config: {
      allowed_scopes: ['^/tenant:.*$'],
      validation_message: 'Editors can only be assigned within a tenant scope.',
    },
    users: [{ count: 5 }],
    created_at: new Date('2026-01-12T09:00:00Z').toISOString(),
    updated_at: new Date('2026-04-15T09:00:00Z').toISOString(),
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    icon: 'visibility',
    description: 'Read-only access.',
    parent: null,
    scope_config: null,
    users: [{ count: 12 }],
    created_at: new Date('2026-01-15T09:00:00Z').toISOString(),
    updated_at: new Date('2026-03-20T09:00:00Z').toISOString(),
  },
];

export const mockRole = mockRoles[0];

export const mockPolicies: Policy[] = [
  {
    id: 'policy-admin',
    name: 'Admin Policy',
    icon: 'admin_panel_settings',
    description: 'Grants full administrative privileges across the system.',
    admin_access: true,
    app_access: true,
    delegate_access: false,
    userCount: 1,
    roleCount: 1,
    created_at: new Date('2026-01-10T09:00:00Z').toISOString(),
    updated_at: new Date('2026-05-01T09:00:00Z').toISOString(),
  },
  {
    id: 'policy-app-access',
    name: 'App Access',
    icon: 'apps',
    description: 'Minimal permissions required to sign in and use the app.',
    admin_access: false,
    app_access: true,
    delegate_access: false,
    userCount: 18,
    roleCount: 3,
    created_at: new Date('2026-01-11T09:00:00Z').toISOString(),
    updated_at: new Date('2026-02-01T09:00:00Z').toISOString(),
  },
  {
    id: 'policy-content-editor',
    name: 'Content Editor',
    icon: 'edit',
    description: 'Create and update content collections.',
    admin_access: false,
    app_access: true,
    delegate_access: false,
    userCount: 5,
    roleCount: 1,
    created_at: new Date('2026-01-14T09:00:00Z').toISOString(),
    updated_at: new Date('2026-04-01T09:00:00Z').toISOString(),
  },
];

export const mockPolicy = mockPolicies[0];

export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'jane.doe@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    title: 'Platform Administrator',
    description: null,
    location: 'Remote',
    tags: ['founder'],
    language: 'en-US',
    theme: 'auto',
    status: 'active',
    token: null,
    last_access: new Date('2026-07-01T14:22:00Z').toISOString(),
    roles: [{ id: 'role-admin', name: 'Administrator', icon: 'supervised_user_circle' }],
    admin_access: true,
    policyCount: 1,
    created_at: new Date('2026-01-10T09:00:00Z').toISOString(),
    updated_at: new Date('2026-06-01T09:00:00Z').toISOString(),
  },
  {
    id: 'user-2',
    email: 'sam.lee@example.com',
    first_name: 'Sam',
    last_name: 'Lee',
    title: 'Content Editor',
    description: null,
    location: 'New York, NY',
    tags: [],
    language: 'en-US',
    theme: 'light',
    status: 'active',
    token: null,
    last_access: new Date('2026-07-05T09:10:00Z').toISOString(),
    roles: [{ id: 'role-editor', name: 'Editor', icon: 'edit' }],
    admin_access: false,
    policyCount: 0,
    created_at: new Date('2026-02-02T09:00:00Z').toISOString(),
    updated_at: new Date('2026-05-20T09:00:00Z').toISOString(),
  },
  {
    id: 'user-3',
    email: 'pending.invite@example.com',
    first_name: null,
    last_name: null,
    title: null,
    description: null,
    location: null,
    tags: [],
    language: 'en-US',
    theme: 'auto',
    status: 'invited',
    token: null,
    last_access: null,
    roles: [{ id: 'role-viewer', name: 'Viewer', icon: 'visibility' }],
    admin_access: false,
    policyCount: 0,
    created_at: new Date('2026-06-28T09:00:00Z').toISOString(),
    updated_at: new Date('2026-06-28T09:00:00Z').toISOString(),
  },
  {
    id: 'user-4',
    email: 'suspended.user@example.com',
    first_name: 'Alex',
    last_name: 'Kim',
    title: null,
    description: null,
    location: null,
    tags: [],
    language: 'en-US',
    theme: 'dark',
    status: 'suspended',
    token: null,
    last_access: new Date('2026-04-11T09:00:00Z').toISOString(),
    roles: [],
    admin_access: false,
    policyCount: 0,
    created_at: new Date('2026-03-02T09:00:00Z').toISOString(),
    updated_at: new Date('2026-04-11T09:00:00Z').toISOString(),
  },
];

export const mockUser = mockUsers[0];

export const mockAccess: Access[] = [
  { id: 'access-1', policy: mockPolicies[0].id, role: mockRoles[0].id, user: null, sort: 1 },
  { id: 'access-2', policy: mockPolicies[1].id, role: null, user: mockUsers[1].id, sort: 1 },
];
