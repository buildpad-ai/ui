/**
 * Global setup for the files E2E suite — DaaS4-compatible.
 *
 * DaaS4 differences vs Directus v9/v10:
 *   - Roles have no admin_access / app_access flags (those are policy-level)
 *   - Users have a `roles` array (not a single `role` field)
 *   - Built-in Admin Policy id = 00000000-0000-0000-0000-000000000001 (admin_access=true)
 *   - Built-in User Policy  id = 00000000-0000-0000-0000-000000000002 (app_access=true)
 *
 * Provisions on FILES_DAAS_URL (distinct from the buildpad-ui DaaS-studio instance):
 *   e2e-files-admin  → e2e_files_admin  role + Admin Policy  → full CRUD
 *   e2e-files-editor → e2e_files_editor role + editor policy → own-item CRUD
 *   e2e-files-viewer → e2e_files_viewer role + viewer policy → read-only
 *   e2e-files-noperm → e2e_files_noperm role (no daas_files perms)
 *
 * Writes tests/ui-files/.files-rbac.json (gitignored).
 * Setup is idempotent — safe to re-run.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { admin, createOrGet } from './daas-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '../.files-rbac.json');

const BUILTIN_ADMIN_POLICY_ID = '00000000-0000-0000-0000-000000000001';
const BUILTIN_USER_POLICY_ID = '00000000-0000-0000-0000-000000000002';

const TOKENS = {
  admin: 'e2e_files_admin_token_bp',
  editor: 'e2e_files_editor_token_bp',
  viewer: 'e2e_files_viewer_token_bp',
  noperm: 'e2e_files_noperm_token_bp',
} as const;

const EMAILS = {
  admin: 'e2e-files-admin@buildpad.test',
  editor: 'e2e-files-editor@buildpad.test',
  viewer: 'e2e-files-viewer@buildpad.test',
  noperm: 'e2e-files-noperm@buildpad.test',
} as const;

const COLLECTION = 'daas_files';

interface RoleEntry {
  userId: string;
  email: string;
  token: string;
  roleId: string;
  policyId: string | null;
}
interface RbacJson {
  admin: RoleEntry;
  editor: RoleEntry;
  viewer: RoleEntry;
  noperm: RoleEntry;
}

// ── Role helpers ────────────────────────────────────────────────────────────

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
  // Check if link already exists (scan all access entries)
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
  action: string,
  fields: string[],
  permissions: Record<string, unknown> = {},
  presets: Record<string, unknown> | null = null,
  validation: Record<string, unknown> | null = null,
): Promise<void> {
  // Check if already exists
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; policy: string; collection: string; action: string }[] }>(
      `/api/permissions?limit=100&page=${page}`,
    );
    if (res.status !== 200) break;
    const items = res.data?.data ?? [];
    if (items.find(p => p.policy === policyId && p.collection === COLLECTION && p.action === action)) return;
    if (items.length < 100) break;
    page++;
  }

  const body: Record<string, unknown> = { policy: policyId, collection: COLLECTION, action, fields, permissions };
  if (presets) body.presets = presets;
  if (validation) body.validation = validation;
  await admin.post('/api/permissions', body);
}

// ── User helpers ────────────────────────────────────────────────────────────

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  let page = 1;
  while (true) {
    const res = await admin.get<{ data: { id: string; email: string }[] }>(
      `/api/users?limit=100&page=${page}`,
    );
    if (res.status !== 200) return null;
    const items = res.data?.data ?? [];
    const match = items.find(u => u.email === email);
    if (match) return match;
    if (items.length < 100) return null;
    page++;
  }
}

async function provisionUser(
  email: string,
  token: string,
  roleId: string,
): Promise<string> {
  let user = await findUserByEmail(email);

  if (!user) {
    const createBody: Record<string, unknown> = {
      email,
      password: `E2eFiles#${token.slice(0, 12)}`,
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
  console.log('\n🔧 Files E2E: provisioning RBAC fixtures…\n');

  // ── Admin role → Admin Policy (built-in, admin_access=true) ──
  console.log('  Creating e2e_files_admin role…');
  const adminRoleId = await createRole('e2e_files_admin');
  await linkPolicyToRole(adminRoleId, BUILTIN_ADMIN_POLICY_ID);

  // ── Editor role + custom policy ──
  console.log('  Creating e2e_files_editor role + policy…');
  const editorRoleId = await createRole('e2e_files_editor');
  const editorPolicyId = await createPolicy('e2e_files_editor_policy');
  await linkPolicyToRole(editorRoleId, editorPolicyId);
  // Also link User Policy so they have app_access
  await linkPolicyToRole(editorRoleId, BUILTIN_USER_POLICY_ID);

  await addPermission(editorPolicyId, 'read', ['*']);
  await addPermission(editorPolicyId, 'create', ['*'], {}, { uploaded_by: '$CURRENT_USER' });
  await addPermission(
    editorPolicyId,
    'update',
    ['title', 'description', 'tags', 'location', 'focal_point_x', 'focal_point_y', 'folder'],
    { uploaded_by: { _eq: '$CURRENT_USER' } },
  );
  await addPermission(editorPolicyId, 'delete', ['*'], { uploaded_by: { _eq: '$CURRENT_USER' } });

  // ── Viewer role + custom policy ──
  console.log('  Creating e2e_files_viewer role + policy…');
  const viewerRoleId = await createRole('e2e_files_viewer');
  const viewerPolicyId = await createPolicy('e2e_files_viewer_policy');
  await linkPolicyToRole(viewerRoleId, viewerPolicyId);
  await linkPolicyToRole(viewerRoleId, BUILTIN_USER_POLICY_ID);

  await addPermission(viewerPolicyId, 'read', [
    'id', 'title', 'type', 'filename_download', 'filesize', 'uploaded_on', 'folder',
  ]);

  // ── Noperm role (no daas_files perms, but still has User Policy for app access) ──
  console.log('  Creating e2e_files_noperm role…');
  const nopermRoleId = await createRole('e2e_files_noperm');
  await linkPolicyToRole(nopermRoleId, BUILTIN_USER_POLICY_ID);

  // ── Provision users ──
  console.log('  Provisioning users with static tokens…');
  const [adminUserId, editorUserId, viewerUserId, nopermUserId] = await Promise.all([
    provisionUser(EMAILS.admin, TOKENS.admin, adminRoleId),
    provisionUser(EMAILS.editor, TOKENS.editor, editorRoleId),
    provisionUser(EMAILS.viewer, TOKENS.viewer, viewerRoleId),
    provisionUser(EMAILS.noperm, TOKENS.noperm, nopermRoleId),
  ]);

  // ── Write .files-rbac.json ──
  const rbac: RbacJson = {
    admin: { userId: adminUserId, email: EMAILS.admin, token: TOKENS.admin, roleId: adminRoleId, policyId: null },
    editor: { userId: editorUserId, email: EMAILS.editor, token: TOKENS.editor, roleId: editorRoleId, policyId: editorPolicyId },
    viewer: { userId: viewerUserId, email: EMAILS.viewer, token: TOKENS.viewer, roleId: viewerRoleId, policyId: viewerPolicyId },
    noperm: { userId: nopermUserId, email: EMAILS.noperm, token: TOKENS.noperm, roleId: nopermRoleId, policyId: null },
  };

  fs.writeFileSync(RBAC_JSON, JSON.stringify(rbac, null, 2));
  console.log(`\n✅ RBAC fixtures ready → ${RBAC_JSON}\n`);

  // ── Spot-check: verify editor can read daas_files ──
  const meRes = await fetch(
    `${process.env.FILES_DAAS_URL}/api/permissions/me?debug=true`,
    { headers: { Authorization: `Bearer ${TOKENS.editor}` } },
  );
  if (meRes.ok) {
    const me = await meRes.json();
    const hasFiles = JSON.stringify(me).includes('daas_files');
    console.log(`  Editor /permissions/me: ${hasFiles ? '✓ daas_files present' : '⚠ daas_files not visible yet'}`);
  }
}

// Self-invoke only when run directly via tsx (not when imported by Playwright)
if (process.argv[1]?.includes('files-rbac-setup')) {
  globalSetup().catch((err: unknown) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
}
