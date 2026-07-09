/**
 * Users Management — API-tier spec
 *
 * Exercises the exact API contract the @buildpad/ui-users surfaces depend on,
 * directly against USERS_DAAS_URL using static Bearer tokens. No browser.
 *
 * Part 1 — module flow (as admin): role → policy → attach → permissions →
 *          user (M2M roles) → bulk role membership → direct user↔policy
 *          attachment → counts → computed admin_access → cleanup.
 * Part 2 — role matrix:
 *   admin   → full CRUD on users/roles/policies
 *   manager → CRUD daas_users (field-limited update), read-only roles/policies
 *   viewer  → read-only, limited user fields
 *   noperm  → no access to the admin collections
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const USERS_DAAS_URL = process.env.USERS_DAAS_URL || process.env.FILES_DAAS_URL || '';
const RBAC_JSON = path.join(__dirname, '.users-rbac.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rbac() {
  if (!fs.existsSync(RBAC_JSON)) {
    throw new Error(`${RBAC_JSON} not found — run test:users:setup first`);
  }
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8')) as {
    admin: { token: string; userId: string; roleId: string };
    manager: { token: string; userId: string; roleId: string };
    viewer: { token: string; userId: string; roleId: string };
    noperm: { token: string; userId: string; roleId: string };
  };
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiGet(token: string, urlPath: string) {
  return fetch(`${USERS_DAAS_URL}${urlPath}`, { headers: bearer(token) });
}

async function apiPost(token: string, urlPath: string, body: unknown) {
  return fetch(`${USERS_DAAS_URL}${urlPath}`, {
    method: 'POST',
    headers: bearer(token),
    body: JSON.stringify(body),
  });
}

async function apiPatch(token: string, urlPath: string, body: unknown) {
  return fetch(`${USERS_DAAS_URL}${urlPath}`, {
    method: 'PATCH',
    headers: bearer(token),
    body: JSON.stringify(body),
  });
}

async function apiDelete(token: string, urlPath: string) {
  return fetch(`${USERS_DAAS_URL}${urlPath}`, {
    method: 'DELETE',
    headers: bearer(token),
  });
}

const RUN = Date.now();

/**
 * Role IDs a user currently holds. A plain detail GET returns `roles` as
 * bare junction-row IDs — `fields=*,roles.*` expands them to junction rows
 * whose `role_id` is the actual role.
 */
async function getUserRoleIds(token: string, userId: string): Promise<string[]> {
  const res = await apiGet(token, `/api/users/${userId}?fields=*,roles.*`);
  const json = await res.json();
  const roles = (json?.data?.roles ?? []) as Array<{ role_id?: string | { id?: string } }>;
  return roles
    .map(r => (typeof r.role_id === 'string' ? r.role_id : r.role_id?.id))
    .filter((id): id is string => Boolean(id));
}

// ---------------------------------------------------------------------------
// Part 1 — Module flow (admin)
// ---------------------------------------------------------------------------

test.describe('Users module flow — API tier (admin)', () => {
  // The flow tests build on each other's entities — serial mode skips the
  // rest of the chain when a step fails instead of continuing with undefined
  // IDs (a failed test restarts the worker, wiping module state).
  test.describe.configure({ mode: 'serial' });

  let tokens: ReturnType<typeof rbac>;

  // Entities created by the flow; cleaned up in afterAll (teardown also sweeps
  // anything named e2e-users-* / e2e_users_* as a safety net).
  let flowRoleId: string;
  let flowPolicyId: string;
  let flowUserId: string;
  let flowPermissionId: string | null = null;

  test.beforeAll(() => {
    if (!USERS_DAAS_URL) test.skip(true, 'USERS_DAAS_URL / FILES_DAAS_URL not set');
    tokens = rbac();
  });

  test.afterAll(async () => {
    if (!tokens) return;
    const t = tokens.admin.token;
    if (flowUserId) await apiDelete(t, `/api/users/${flowUserId}`).catch(() => {});
    if (flowPermissionId) await apiDelete(t, `/api/permissions/${flowPermissionId}`).catch(() => {});
    if (flowPolicyId) await apiDelete(t, `/api/policies/${flowPolicyId}`).catch(() => {});
    if (flowRoleId) await apiDelete(t, `/api/roles/${flowRoleId}`).catch(() => {});
  });

  test('create role with scope_config and parent', async () => {
    const res = await apiPost(tokens.admin.token, '/api/roles', {
      name: `e2e_users_flow_role_${RUN}`,
      icon: 'supervised_user_circle',
      description: 'Transient role created by users-rbac.api.spec',
      parent: tokens.manager.roleId,
      // '^$' keeps the role assignable at root scope (empty resource_uri) —
      // a tenant-only pattern would make the user-create assignment below fail.
      scope_config: {
        allowed_scopes: ['^$', '^/tenant:.*$'],
        validation_message: 'Tenant scopes only',
      },
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json();
    flowRoleId = json?.data?.id;
    expect(flowRoleId).toBeTruthy();
    expect(json?.data?.parent).toBe(tokens.manager.roleId);
    expect(json?.data?.scope_config?.allowed_scopes).toEqual(['^$', '^/tenant:.*$']);
  });

  test('create policy with app_access', async () => {
    const res = await apiPost(tokens.admin.token, '/api/policies', {
      name: `e2e_users_flow_policy_${RUN}`,
      icon: 'policy',
      description: 'Transient policy created by users-rbac.api.spec',
      admin_access: false,
      app_access: true,
      delegate_access: false,
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json();
    flowPolicyId = json?.data?.id;
    expect(flowPolicyId).toBeTruthy();
    expect(json?.data?.admin_access).toBe(false);
    expect(json?.data?.app_access).toBe(true);
  });

  test('attach policy to role via nested route, visible with includePolicies', async () => {
    const attach = await apiPost(tokens.admin.token, `/api/roles/${flowRoleId}/policies`, {
      policyIds: [flowPolicyId],
    });
    expect(attach.status).toBeLessThan(300);

    const res = await apiGet(tokens.admin.token, `/api/roles/${flowRoleId}?includePolicies=true`);
    expect(res.status).toBe(200);
    const json = await res.json();
    const policies = JSON.stringify(json?.data?.policies ?? []);
    expect(policies).toContain(flowPolicyId);
  });

  test('create permission row for the policy and list it via ?policy=', async () => {
    const res = await apiPost(tokens.admin.token, '/api/permissions', {
      policy: flowPolicyId,
      collection: 'daas_files',
      action: 'read',
      fields: ['*'],
      permissions: {},
    });
    expect(res.status).toBeLessThan(300);

    const list = await apiGet(tokens.admin.token, `/api/permissions?policy=${flowPolicyId}`);
    expect(list.status).toBe(200);
    const json = await list.json();
    const rows = (json?.data ?? []) as { id: string; collection: string; action: string }[];
    const created = rows.find(r => r.collection === 'daas_files' && r.action === 'read');
    expect(created).toBeTruthy();
    flowPermissionId = created!.id;
  });

  test('create user with M2M role assignment', async () => {
    const res = await apiPost(tokens.admin.token, '/api/users', {
      email: `e2e-users-flow-${RUN}@buildpad.test`,
      password: `E2eUsersFlow#${RUN}`,
      first_name: 'Flow',
      last_name: 'User',
      status: 'invited', // invite = create with status 'invited' (no invite endpoint)
      roles: [flowRoleId],
    });
    expect(res.status).toBeLessThan(300);
    const json = await res.json();
    flowUserId = json?.data?.id;
    expect(flowUserId).toBeTruthy();
    expect(json?.data?.password).toBeUndefined(); // never echoed back

    const detail = await apiGet(tokens.admin.token, `/api/users/${flowUserId}`);
    expect(detail.status).toBe(200);
    const detailJson = await detail.json();
    expect(detailJson?.data?.status).toBe('invited');

    const roleIds = await getUserRoleIds(tokens.admin.token, flowUserId);
    expect(roleIds).toContain(flowRoleId);
  });

  test('edits-only PATCH updates profile fields', async () => {
    const res = await apiPatch(tokens.admin.token, `/api/users/${flowUserId}`, {
      title: 'QA Fixture',
      status: 'active',
    });
    expect(res.status).toBeLessThan(300);

    const detail = await apiGet(tokens.admin.token, `/api/users/${flowUserId}`);
    const json = await detail.json();
    expect(json?.data?.title).toBe('QA Fixture');
    expect(json?.data?.status).toBe('active');
  });

  test('admin_access is computed — writing it never persists', async () => {
    // The hooks strip admin_access client-side; the API must also ignore/reject it.
    await apiPatch(tokens.admin.token, `/api/users/${flowUserId}`, { admin_access: true });

    const detail = await apiGet(tokens.admin.token, `/api/users/${flowUserId}`);
    const json = await detail.json();
    // flow user has no admin policy anywhere → computed admin_access must stay false
    expect(json?.data?.admin_access ?? false).toBe(false);
  });

  test('bulk-update adds and removes role membership', async () => {
    // Add the viewer fixture role alongside the flow role
    const add = await apiPatch(tokens.admin.token, '/api/users/bulk-update', {
      userIds: [flowUserId],
      addRoles: [tokens.viewer.roleId],
    });
    expect(add.status).toBeLessThan(300);

    let roleIds = await getUserRoleIds(tokens.admin.token, flowUserId);
    expect(roleIds).toContain(tokens.viewer.roleId);
    expect(roleIds).toContain(flowRoleId);

    // Remove it again
    const remove = await apiPatch(tokens.admin.token, '/api/users/bulk-update', {
      userIds: [flowUserId],
      removeRoles: [tokens.viewer.roleId],
    });
    expect(remove.status).toBeLessThan(300);

    roleIds = await getUserRoleIds(tokens.admin.token, flowUserId);
    expect(roleIds).not.toContain(tokens.viewer.roleId);
    expect(roleIds).toContain(flowRoleId);
  });

  test('attach + list + detach policy directly on the user', async () => {
    const attach = await apiPost(tokens.admin.token, `/api/users/${flowUserId}/policies`, {
      policyIds: [flowPolicyId],
    });
    expect(attach.status).toBeLessThan(300);

    const list = await apiGet(tokens.admin.token, `/api/users/${flowUserId}/policies`);
    expect(list.status).toBe(200);
    const listJson = await list.json();
    expect(JSON.stringify(listJson?.data ?? [])).toContain(flowPolicyId);

    const detach = await apiDelete(
      tokens.admin.token,
      `/api/users/${flowUserId}/policies/${flowPolicyId}`,
    );
    expect(detach.status).toBeLessThan(300);

    const after = await (await apiGet(tokens.admin.token, `/api/users/${flowUserId}/policies`)).json();
    expect(JSON.stringify(after?.data ?? [])).not.toContain(flowPolicyId);
  });

  test('list enrichments: role user counts and policy user/role counts', async () => {
    // Roles list with includeUsers → users:[{count}] present on the flow role
    const rolesRes = await apiGet(tokens.admin.token, '/api/roles?includeUsers=true&limit=1000');
    expect(rolesRes.status).toBe(200);
    const rolesJson = await rolesRes.json();
    const flowRole = (rolesJson?.data ?? []).find((r: { id: string }) => r.id === flowRoleId);
    expect(flowRole).toBeTruthy();
    expect(flowRole.users?.[0]?.count).toBeGreaterThanOrEqual(1); // the flow user

    // Policy detail → roleCount reflects the role attachment
    const policyRes = await apiGet(tokens.admin.token, `/api/policies/${flowPolicyId}`);
    expect(policyRes.status).toBe(200);
    const policyJson = await policyRes.json();
    expect(policyJson?.data?.roleCount).toBeGreaterThanOrEqual(1);
  });

  test('flow cleanup: delete user, permission, policy, role', async () => {
    expect((await apiDelete(tokens.admin.token, `/api/users/${flowUserId}`)).status).toBeLessThan(300);
    flowUserId = '';
    if (flowPermissionId) {
      expect(
        (await apiDelete(tokens.admin.token, `/api/permissions/${flowPermissionId}`)).status,
      ).toBeLessThan(300);
      flowPermissionId = null;
    }
    expect((await apiDelete(tokens.admin.token, `/api/policies/${flowPolicyId}`)).status).toBeLessThan(300);
    flowPolicyId = '';
    expect((await apiDelete(tokens.admin.token, `/api/roles/${flowRoleId}`)).status).toBeLessThan(300);
    flowRoleId = '';
  });
});

// ---------------------------------------------------------------------------
// Part 2 — Role matrix
// ---------------------------------------------------------------------------

test.describe('Users RBAC matrix — API tier', () => {
  let tokens: ReturnType<typeof rbac>;

  test.beforeAll(() => {
    if (!USERS_DAAS_URL) test.skip(true, 'USERS_DAAS_URL / FILES_DAAS_URL not set');
    tokens = rbac();
  });

  // ── manager: CRUD daas_users (field-limited update), read-only roles/policies ──

  test('manager can list users', async () => {
    const res = await apiGet(tokens.manager.token, '/api/users?limit=5');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json?.data)).toBe(true);
  });

  test('manager can update allowed user profile fields', async () => {
    const res = await apiPatch(tokens.manager.token, `/api/users/${tokens.viewer.userId}`, {
      title: `managed-${RUN}`,
    });
    expect(res.status).toBeLessThan(300);
  });

  test('manager cannot delete users', async () => {
    const res = await apiDelete(tokens.manager.token, `/api/users/${tokens.viewer.userId}`);
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  test('manager can read but not create roles', async () => {
    const read = await apiGet(tokens.manager.token, '/api/roles?limit=5');
    expect(read.status).toBe(200);

    const create = await apiPost(tokens.manager.token, '/api/roles', {
      name: `e2e_users_forbidden_role_${RUN}`,
    });
    expect(create.status).toBeGreaterThanOrEqual(403);
  });

  test('manager can read but not create policies', async () => {
    const read = await apiGet(tokens.manager.token, '/api/policies?limit=5');
    expect(read.status).toBe(200);

    const create = await apiPost(tokens.manager.token, '/api/policies', {
      name: `e2e_users_forbidden_policy_${RUN}`,
    });
    expect(create.status).toBeGreaterThanOrEqual(403);
  });

  // ── viewer: read-only, limited fields ──

  test('viewer can list users but only sees permitted fields', async () => {
    const res = await apiGet(tokens.viewer.token, '/api/users?limit=5');
    expect(res.status).toBe(200);
    const json = await res.json();
    const rows = (json?.data ?? []) as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.email ?? row.id).toBeTruthy();
      // Static tokens are conceal-masked (e.g. "**********") or null — the
      // raw value must never be exposed. Fixture tokens start with e2e_users_.
      const token = row.token as string | null | undefined;
      if (token) expect(token).toMatch(/^\*+$/);
    }
  });

  test('viewer cannot create users', async () => {
    const res = await apiPost(tokens.viewer.token, '/api/users', {
      email: `e2e-users-viewer-create-${RUN}@buildpad.test`,
      password: 'Forbidden#123',
    });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  test('viewer cannot update other users', async () => {
    const res = await apiPatch(tokens.viewer.token, `/api/users/${tokens.noperm.userId}`, {
      title: 'should-not-happen',
    });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  // ── noperm: no access to the admin collections ──

  test('noperm cannot list users', async () => {
    const res = await apiGet(tokens.noperm.token, '/api/users?limit=5');
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  test('noperm cannot list policies', async () => {
    const res = await apiGet(tokens.noperm.token, '/api/policies?limit=5');
    expect(res.status).toBeGreaterThanOrEqual(403);
  });

  // ── self-access always works ──

  test('every fixture user can read /users/me', async () => {
    for (const key of ['admin', 'manager', 'viewer', 'noperm'] as const) {
      const res = await apiGet(tokens[key].token, '/api/users/me');
      expect(res.status, `/users/me as ${key}`).toBe(200);
      const json = await res.json();
      expect(json?.data?.id).toBe(tokens[key].userId);
    }
  });

  test('computed admin_access is true only for the admin fixture', async () => {
    const adminMe = await (await apiGet(tokens.admin.token, '/api/users/me')).json();
    expect(adminMe?.data?.admin_access).toBe(true);

    const managerMe = await (await apiGet(tokens.manager.token, '/api/users/me')).json();
    expect(managerMe?.data?.admin_access ?? false).toBe(false);
  });
});
