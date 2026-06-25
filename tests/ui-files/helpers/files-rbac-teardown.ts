/**
 * Global teardown for the files E2E suite.
 *
 * Deletes all e2e_ fixtures in reverse dependency order using IDs from
 * .files-rbac.json (written by setup). Falls back to full-list scans
 * when IDs aren't available.
 *
 * Idempotent — ignores 404s so partial teardowns are safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { admin } from './daas-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '../.files-rbac.json');

interface RoleEntry {
  userId: string;
  email: string;
  token: string;
  roleId: string | null;
  policyId: string | null;
}
interface RbacJson {
  admin: RoleEntry;
  editor: RoleEntry;
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

/** Scan all pages of a list endpoint and find item matching field=value client-side. */
async function findIdByField(
  listPath: string,
  field: string,
  value: string,
): Promise<string | null> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: Record<string, unknown>[] }>(
      `${listPath}?limit=100&page=${page}`,
    );
    if (res.status !== 200) return null;
    const items = res.data?.data ?? [];
    const match = items.find(item => item[field] === value);
    if (match) return match['id'] as string;
    if (items.length < 100) return null;
    page++;
  }
}

async function deleteUserById(id: string): Promise<void> {
  await ignore404(() => admin.delete(`/api/users/${id}`));
}

async function deletePermissionsByPolicyId(policyId: string): Promise<void> {
  // Get all permissions and filter client-side by policy
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; policy: string }[] }>(
      `/api/permissions?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    for (const perm of items.filter(p => p.policy === policyId)) {
      await ignore404(() => admin.delete(`/api/permissions/${perm.id}`));
    }
    if (items.length < 100) break;
    page++;
  }
}

async function deleteAccessByPolicyId(policyId: string): Promise<void> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; policy: string }[] }>(
      `/api/access?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    for (const link of items.filter(a => a.policy === policyId)) {
      await ignore404(() => admin.delete(`/api/access/${link.id}`));
    }
    if (items.length < 100) break;
    page++;
  }
}

async function deleteE2eFiles(): Promise<void> {
  // Scan files and delete those with e2e- title prefix
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; title: string | null }[] }>(
      `/api/files?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    for (const file of items.filter(f => f.title?.startsWith('e2e-'))) {
      await ignore404(() => admin.delete(`/api/files/${file.id}`));
    }
    if (items.length < 100) break;
    page++;
  }
}

async function deleteE2eFolders(): Promise<void> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; name: string }[] }>(
      `/api/folders?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    for (const folder of items.filter(f => f.name?.startsWith('e2e-'))) {
      await ignore404(() => admin.delete(`/api/folders/${folder.id}`));
    }
    if (items.length < 100) break;
    page++;
  }
}

export default async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Files E2E: tearing down RBAC fixtures…\n');

  // Load IDs from .files-rbac.json if available
  let rbac: RbacJson | null = null;
  if (fs.existsSync(RBAC_JSON)) {
    try { rbac = JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8')); } catch {}
  }

  // 1. Remove test files and folders
  await deleteE2eFiles();
  await deleteE2eFolders();
  console.log('  ✓ Test files/folders removed');

  // 2. Remove users
  const userIds = rbac
    ? [rbac.admin.userId, rbac.editor.userId, rbac.viewer.userId, rbac.noperm.userId]
    : [];

  // Also scan for any scope test users
  for (const email of [
    'e2e-files-tenant-a@buildpad.test',
    'e2e-files-tenant-b@buildpad.test',
  ]) {
    const id = await findIdByField('/api/users', 'email', email);
    if (id) userIds.push(id);
  }

  for (const id of userIds) {
    await deleteUserById(id);
  }
  console.log('  ✓ E2E users deleted');

  // 3. Remove permissions + access + policies (use IDs from rbac.json)
  const policyIds = rbac
    ? [rbac.editor.policyId, rbac.viewer.policyId].filter(Boolean) as string[]
    : [];

  // Also look up scope policy by name if not in rbac.json
  const scopePolicyId = await findIdByField('/api/policies', 'name', 'e2e_files_scope_policy');
  if (scopePolicyId) policyIds.push(scopePolicyId);

  for (const policyId of policyIds) {
    await deletePermissionsByPolicyId(policyId);
    await deleteAccessByPolicyId(policyId);
    await ignore404(() => admin.delete(`/api/policies/${policyId}`));
  }
  console.log('  ✓ Policies + permissions removed');

  // 4. Remove roles (use IDs from rbac.json + name scan for scope role)
  const roleIds = rbac
    ? [rbac.admin.roleId, rbac.editor.roleId, rbac.viewer.roleId, rbac.noperm.roleId].filter(Boolean) as string[]
    : [];

  const scopeRoleId = await findIdByField('/api/roles', 'name', 'e2e_files_scope');
  if (scopeRoleId) roleIds.push(scopeRoleId);

  // Deduplicate (all might be Administrator if setup was broken)
  const builtinIds = new Set(['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
  for (const id of [...new Set(roleIds)]) {
    if (builtinIds.has(id)) continue; // never delete built-in roles
    await ignore404(() => admin.delete(`/api/roles/${id}`));
  }
  console.log('  ✓ Roles removed');

  // 5. Scope items + type + collection-config (correct DaaS4 paths: /api/scope/*)
  const scopeItemAId = await findIdByField('/api/scope/items', 'name', 'E2E Tenant A').catch(() => null);
  const scopeItemBId = await findIdByField('/api/scope/items', 'name', 'E2E Tenant B').catch(() => null);
  if (scopeItemAId) await ignore404(() => admin.delete(`/api/scope/items/${scopeItemAId}`));
  if (scopeItemBId) await ignore404(() => admin.delete(`/api/scope/items/${scopeItemBId}`));
  const scopeTypeId = await findIdByField('/api/scope/types', 'name', 'Tenant').catch(() => null);
  if (scopeTypeId) await ignore404(() => admin.delete(`/api/scope/types/${scopeTypeId}`));
  // Remove daas_files collection-config if e2e tests added it (skip system collections)
  const ccId = await findIdByField('/api/scope/collection-config', 'collection', 'daas_files').catch(() => null);
  if (ccId) await ignore404(() => admin.delete(`/api/scope/collection-config/${ccId}`));
  console.log('  ✓ Scope fixtures removed (if any)');

  // Clean up rbac.json
  if (fs.existsSync(RBAC_JSON)) fs.unlinkSync(RBAC_JSON);

  console.log('\n✅ Files E2E teardown complete.\n');
}

// Self-invoke only when run directly via tsx (not when imported by Playwright)
if (process.argv[1]?.includes('files-rbac-teardown')) {
  globalTeardown().catch((err: unknown) => {
    console.error('Teardown failed:', err);
    process.exit(1);
  });
}
