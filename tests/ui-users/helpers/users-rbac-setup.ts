/**
 * Global setup for the users-management E2E suite — DaaS4-compatible.
 *
 * DaaS4 model recap:
 *   - Roles have no admin_access / app_access flags (those are policy-level)
 *   - Users have a `roles` array (M2M via daas_user_roles)
 *   - Built-in Admin Policy id = 00000000-0000-0000-0000-000000000001 (admin_access=true)
 *   - Built-in User Policy  id = 00000000-0000-0000-0000-000000000002 (app_access=true)
 *
 * Provisions on USERS_DAAS_URL (defaults to FILES_DAAS_URL):
 *   e2e-users-admin   → e2e_users_admin   role + Admin Policy   → full CRUD
 *   e2e-users-manager → e2e_users_manager role + manager policy → CRUD daas_users, read roles/policies
 *   e2e-users-viewer  → e2e_users_viewer  role + viewer policy  → read-only limited user fields
 *   e2e-users-noperm  → e2e_users_noperm  role (no admin-collection perms)
 *
 * Writes tests/ui-users/.users-rbac.json (gitignored).
 * Setup is idempotent — safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { admin, createOrGet, findUserByEmail, daasUrl } from './daas-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '../.users-rbac.json');

const BUILTIN_ADMIN_POLICY_ID = '00000000-0000-0000-0000-000000000001';
const BUILTIN_USER_POLICY_ID = '00000000-0000-0000-0000-000000000002';

const TOKENS = {
  admin: 'e2e_users_admin_token_bp',
  manager: 'e2e_users_manager_token_bp',
  viewer: 'e2e_users_viewer_token_bp',
  noperm: 'e2e_users_noperm_token_bp',
} as const;

const EMAILS = {
  admin: 'e2e-users-admin@buildpad.test',
  manager: 'e2e-users-manager@buildpad.test',
  viewer: 'e2e-users-viewer@buildpad.test',
  noperm: 'e2e-users-noperm@buildpad.test',
} as const;

interface RoleEntry {
  userId: string;
  email: string;
  token: string;
  roleId: string;
  policyId: string | null;
}
interface RbacJson {
  admin: RoleEntry;
  manager: RoleEntry;
  viewer: RoleEntry;
  noperm: RoleEntry;
}

// ── Role / policy helpers ───────────────────────────────────────────────────

async function createRole(name: string): Promise<string> {
  const role = await createOrGet<{ id: string }>(
    '/api/roles',
    '/api/roles',
    { name, icon: 'supervised_user_circle' },
    'name',
  );
  if (!role) throw new Error(`Failed to create role: ${name}`);
  return role.id;
}

async function createPolicy(name: string): Promise<string> {
  const policy = await createOrGet<{ id: string }>(
    '/api/policies',
    '/api/policies',
    { name, icon: 'policy', admin_access: false, app_access: true },
    'name',
  );
  if (!policy) throw new Error(`Failed to create policy: ${name}`);
  return policy.id;
}

async function linkPolicyToRole(roleId: string, policyId: string): Promise<void> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; role: string; policy: string }[] }>(
      `/api/access?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    if (items.find(a => a.role === roleId && a.policy === policyId)) return;
    if (items.length < 100) break;
    page++;
  }
  await admin.post('/api/access', { role: roleId, policy: policyId });
}

async function addPermission(
  policyId: string,
  collection: string,
  action: string,
  fields: string[],
  permissions: Record<string, unknown> = {},
): Promise<void> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; policy: string; collection: string; action: string }[] }>(
      `/api/permissions?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    if (items.find(p => p.policy === policyId && p.collection === collection && p.action === action)) return;
    if (items.length < 100) break;
    page++;
  }

  await admin.post('/api/permissions', { policy: policyId, collection, action, fields, permissions });
}

// ── User helpers ────────────────────────────────────────────────────────────

async function provisionUser(email: string, token: string, roleId: string): Promise<string> {
  let user = await findUserByEmail(email);

  if (!user) {
    const createBody: Record<string, unknown> = {
      email,
      password: `E2eUsers#${token.slice(0, 12)}`,
      first_name: 'E2E',
      last_name: email.split('@')[0],
      status: 'active',
      roles: [roleId],
    };

    const res = await admin.post<{ data: { id: string } }>('/api/users', createBody);
    if (res.status < 300) {
      user = res.data?.data;
    } else {
      user = await findUserByEmail(email);
      if (!user) throw new Error(`Failed to create user ${email}: ${JSON.stringify(res.data)}`);
    }
  }

  const userId = user!.id;

  // Ensure role assignment (PATCH with roles array)
  await admin.patch(`/api/users/${userId}`, { roles: [roleId] });

  // Set static token (separate PATCH — roles and token can conflict if batched)
  await admin.patch(`/api/users/${userId}`, { token });

  return userId;
}

// ── Main ────────────────────────────────────────────────────────────────────

export default async function globalSetup(): Promise<void> {
  console.log('\n🔧 Users E2E: provisioning RBAC fixtures…\n');

  // ── Admin role → built-in Admin Policy (admin_access=true) ──
  console.log('  Creating e2e_users_admin role…');
  const adminRoleId = await createRole('e2e_users_admin');
  await linkPolicyToRole(adminRoleId, BUILTIN_ADMIN_POLICY_ID);

  // ── Manager role + custom policy: CRUD users, read roles/policies ──
  console.log('  Creating e2e_users_manager role + policy…');
  const managerRoleId = await createRole('e2e_users_manager');
  const managerPolicyId = await createPolicy('e2e_users_manager_policy');
  await linkPolicyToRole(managerRoleId, managerPolicyId);
  await linkPolicyToRole(managerRoleId, BUILTIN_USER_POLICY_ID);

  await addPermission(managerPolicyId, 'daas_users', 'read', ['*']);
  await addPermission(managerPolicyId, 'daas_users', 'create', ['*']);
  await addPermission(managerPolicyId, 'daas_users', 'update', [
    'first_name', 'last_name', 'title', 'description', 'location', 'tags', 'status', 'roles',
  ]);
  await addPermission(managerPolicyId, 'daas_roles', 'read', ['*']);
  await addPermission(managerPolicyId, 'daas_policies', 'read', ['*']);

  // ── Viewer role + custom policy: read-only limited user fields ──
  console.log('  Creating e2e_users_viewer role + policy…');
  const viewerRoleId = await createRole('e2e_users_viewer');
  const viewerPolicyId = await createPolicy('e2e_users_viewer_policy');
  await linkPolicyToRole(viewerRoleId, viewerPolicyId);
  await linkPolicyToRole(viewerRoleId, BUILTIN_USER_POLICY_ID);

  await addPermission(viewerPolicyId, 'daas_users', 'read', [
    'id', 'email', 'first_name', 'last_name', 'status',
  ]);

  // ── Noperm role (User Policy only — app access, no admin collections) ──
  console.log('  Creating e2e_users_noperm role…');
  const nopermRoleId = await createRole('e2e_users_noperm');
  await linkPolicyToRole(nopermRoleId, BUILTIN_USER_POLICY_ID);

  // ── Provision users ──
  console.log('  Provisioning users with static tokens…');
  const [adminUserId, managerUserId, viewerUserId, nopermUserId] = await Promise.all([
    provisionUser(EMAILS.admin, TOKENS.admin, adminRoleId),
    provisionUser(EMAILS.manager, TOKENS.manager, managerRoleId),
    provisionUser(EMAILS.viewer, TOKENS.viewer, viewerRoleId),
    provisionUser(EMAILS.noperm, TOKENS.noperm, nopermRoleId),
  ]);

  // ── Write .users-rbac.json ──
  const rbac: RbacJson = {
    admin: { userId: adminUserId, email: EMAILS.admin, token: TOKENS.admin, roleId: adminRoleId, policyId: null },
    manager: { userId: managerUserId, email: EMAILS.manager, token: TOKENS.manager, roleId: managerRoleId, policyId: managerPolicyId },
    viewer: { userId: viewerUserId, email: EMAILS.viewer, token: TOKENS.viewer, roleId: viewerRoleId, policyId: viewerPolicyId },
    noperm: { userId: nopermUserId, email: EMAILS.noperm, token: TOKENS.noperm, roleId: nopermRoleId, policyId: null },
  };

  fs.writeFileSync(RBAC_JSON, JSON.stringify(rbac, null, 2));
  console.log(`\n✅ RBAC fixtures ready → ${RBAC_JSON}\n`);

  // ── Spot-check: verify manager can read daas_users ──
  const meRes = await fetch(
    `${daasUrl()}/api/permissions/me?debug=true`,
    { headers: { Authorization: `Bearer ${TOKENS.manager}` } },
  );
  if (meRes.ok) {
    const me = await meRes.json();
    const hasUsers = JSON.stringify(me).includes('daas_users');
    console.log(`  Manager /permissions/me: ${hasUsers ? '✓ daas_users present' : '⚠ daas_users not visible yet'}`);
  }
}

// Self-invoke only when run directly via tsx (not when imported by Playwright)
if (process.argv[1]?.includes('users-rbac-setup')) {
  globalSetup().catch((err: unknown) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
}
