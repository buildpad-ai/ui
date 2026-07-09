/**
 * Global teardown for the users-management E2E suite.
 *
 * Deletes all e2e_users fixtures in reverse dependency order using IDs from
 * .users-rbac.json (written by setup), plus any transient `e2e-users-*`
 * entities left behind by specs. Falls back to full-list scans when IDs
 * aren't available.
 *
 * Idempotent — ignores 404s so partial teardowns are safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { admin } from './daas-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '../.users-rbac.json');

const BUILTIN_IDS = new Set([
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
]);

interface RoleEntry {
  userId: string;
  email: string;
  token: string;
  roleId: string | null;
  policyId: string | null;
}
interface RbacJson {
  admin: RoleEntry;
  manager: RoleEntry;
  viewer: RoleEntry;
  noperm: RoleEntry;
}

async function ignore404(fn: () => Promise<{ status: number; data: unknown }>): Promise<void> {
  try {
    const res = await fn();
    if (res.status >= 400 && res.status !== 404) {
      console.warn(`  ⚠ teardown returned ${res.status}:`, JSON.stringify(res.data).slice(0, 120));
    }
  } catch {
    // network errors tolerated
  }
}

/** Collect ids of all items whose `field` value matches `predicate` (full-list scan). */
async function collectIds(
  listPath: string,
  field: string,
  predicate: (value: unknown) => boolean,
): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: Record<string, unknown>[] }>(
      `${listPath}?limit=100&page=${page}`,
    );
    if (res.status !== 200) return ids;
    const items = res.data?.data ?? [];
    for (const item of items) {
      if (predicate(item[field])) ids.push(item['id'] as string);
    }
    if (items.length < 100) return ids;
    page++;
  }
}

async function deletePermissionsByPolicyId(policyId: string): Promise<void> {
  const ids = await collectIds('/api/permissions', 'policy', v => v === policyId);
  for (const id of ids) {
    await ignore404(() => admin.delete(`/api/permissions/${id}`));
  }
}

async function deleteAccessByPolicyId(policyId: string): Promise<void> {
  const ids = await collectIds('/api/access', 'policy', v => v === policyId);
  for (const id of ids) {
    await ignore404(() => admin.delete(`/api/access/${id}`));
  }
}

export default async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Users E2E: tearing down RBAC fixtures…\n');

  let rbac: RbacJson | null = null;
  if (fs.existsSync(RBAC_JSON)) {
    try { rbac = JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8')); } catch {}
  }

  // 1. Remove users — fixtures by ID plus any transient e2e-users-* spec leftovers
  const userIds = rbac
    ? [rbac.admin.userId, rbac.manager.userId, rbac.viewer.userId, rbac.noperm.userId]
    : [];
  userIds.push(
    ...(await collectIds('/api/users', 'email', v => typeof v === 'string' && v.startsWith('e2e-users-'))),
  );
  for (const id of [...new Set(userIds)]) {
    await ignore404(() => admin.delete(`/api/users/${id}`));
  }
  console.log('  ✓ E2E users deleted');

  // 2. Remove permissions + access + policies (fixture IDs + name-prefix scan)
  const policyIds = rbac
    ? ([rbac.manager.policyId, rbac.viewer.policyId].filter(Boolean) as string[])
    : [];
  policyIds.push(
    ...(await collectIds('/api/policies', 'name', v => typeof v === 'string' && v.startsWith('e2e_users_'))),
  );
  for (const policyId of [...new Set(policyIds)]) {
    if (BUILTIN_IDS.has(policyId)) continue;
    await deletePermissionsByPolicyId(policyId);
    await deleteAccessByPolicyId(policyId);
    await ignore404(() => admin.delete(`/api/policies/${policyId}`));
  }
  console.log('  ✓ Policies + permissions removed');

  // 3. Remove roles (fixture IDs + name-prefix scan)
  const roleIds = rbac
    ? ([rbac.admin.roleId, rbac.manager.roleId, rbac.viewer.roleId, rbac.noperm.roleId].filter(
        Boolean,
      ) as string[])
    : [];
  roleIds.push(
    ...(await collectIds('/api/roles', 'name', v => typeof v === 'string' && v.startsWith('e2e_users_'))),
  );
  for (const id of [...new Set(roleIds)]) {
    if (BUILTIN_IDS.has(id)) continue; // never delete built-in roles
    await ignore404(() => admin.delete(`/api/roles/${id}`));
  }
  console.log('  ✓ Roles removed');

  if (fs.existsSync(RBAC_JSON)) fs.unlinkSync(RBAC_JSON);

  console.log('\n✅ Users E2E teardown complete.\n');
}

// Self-invoke only when run directly via tsx (not when imported by Playwright)
if (process.argv[1]?.includes('users-rbac-teardown')) {
  globalTeardown().catch((err: unknown) => {
    console.error('Teardown failed:', err);
    process.exit(1);
  });
}
