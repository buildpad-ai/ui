/**
 * Users Feature Smoke — Storybook spec
 *
 * Proves the users/roles/policies admin surfaces end-to-end against a real
 * DaaS instance through the ui-users Storybook DaaS playgrounds (port 6011)
 * proxied via the storybook-host (port 3000).
 *
 * Auth: connect via POST /api/connect → host sets the encrypted cookie that
 * the Storybook proxy forwards for all /api/* calls.
 *
 * Stories (in-story list ↔ detail navigation):
 *   Users/UsersManager (DaaS)    → users-usersmanager-daas--playground
 *   Users/RolesManager (DaaS)    → users-rolesmanager-daas--playground
 *   Users/PoliciesManager (DaaS) → users-policiesmanager-daas--playground
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { connectAs } from './helpers/auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '.users-rbac.json');
const STORYBOOK_BASE = process.env.STORYBOOK_USERS_URL || 'http://localhost:6011';
const USERS_STORY = `${STORYBOOK_BASE}/iframe.html?id=users-usersmanager-daas--playground&viewMode=story`;
const ROLES_STORY = `${STORYBOOK_BASE}/iframe.html?id=users-rolesmanager-daas--playground&viewMode=story`;
const POLICIES_STORY = `${STORYBOOK_BASE}/iframe.html?id=users-policiesmanager-daas--playground&viewMode=story`;

function rbac() {
  if (!fs.existsSync(RBAC_JSON)) throw new Error(`${RBAC_JSON} not found — run test:users:setup`);
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8'));
}

async function loadStory(page: Page, url: string): Promise<void> {
  // 'networkidle' can hang on background polling — each test waits for
  // specific testids with generous timeouts instead.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Give React + DaaS data a moment to settle
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Feature smoke suite — runs as admin
// ---------------------------------------------------------------------------

test.describe('Users Feature Smoke (admin)', () => {
  let fixtures: ReturnType<typeof rbac>;

  test.beforeAll(async () => {
    const url = process.env.USERS_DAAS_URL || process.env.FILES_DAAS_URL || '';
    if (!url) test.skip(true, 'USERS_DAAS_URL / FILES_DAAS_URL not set');
    fixtures = rbac();
  });

  // The host stores the connection in an encrypted httpOnly cookie —
  // connect via page.request so the cookie lands in the BROWSER context's
  // jar (the worker-scoped `request` fixture has a separate jar).
  test.beforeEach(async ({ page }) => {
    await connectAs(page.request, fixtures.admin.token);
  });

  // ── UsersManager ─────────────────────────────────────────────────────────

  test('users-manager renders with fixture users', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });
    // At least the four e2e fixture users exist
    await expect(page.getByText(fixtures.admin.email)).toBeVisible({ timeout: 20_000 });
  });

  test('users-manager search narrows the list', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('users-manager-search').fill('e2e-users-viewer');
    // 300ms debounce + fetch
    await expect(page.getByText(fixtures.viewer.email)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(fixtures.noperm.email)).toBeHidden();
  });

  test('clicking a user row opens the user detail with a Policies tab', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    // The fixture user may be beyond page 1 — narrow the list first.
    await page.getByTestId('users-manager-search').fill(fixtures.viewer.email);
    await expect(page.getByTestId(`users-manager-row-${fixtures.viewer.userId}`)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId(`users-manager-row-${fixtures.viewer.userId}`).click();
    await expect(page.getByTestId('user-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: /Policies/ })).toBeVisible();
    // Email field is populated from the fetched record
    await expect(page.getByTestId('user-detail-email')).toHaveValue(fixtures.viewer.email, {
      timeout: 20_000,
    });
  });

  // ── RolesManager ─────────────────────────────────────────────────────────

  test('roles-manager renders and opens role detail with Users/Policies tabs', async ({ page }) => {
    await loadStory(page, ROLES_STORY);
    await expect(page.getByTestId('roles-manager')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('e2e_users_manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`roles-manager-row-${fixtures.manager.roleId}`).click();
    await expect(page.getByTestId('role-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('role-detail-name')).toHaveValue('e2e_users_manager', {
      timeout: 20_000,
    });
    await expect(page.getByRole('tab', { name: /Users/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Policies/ })).toBeVisible();
  });

  test('role detail Users tab lists role members', async ({ page }) => {
    await loadStory(page, ROLES_STORY);
    await expect(page.getByTestId('roles-manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`roles-manager-row-${fixtures.manager.roleId}`).click();
    await expect(page.getByTestId('role-detail')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: /Users/ }).click();
    await expect(page.getByTestId('role-users-manager')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(fixtures.manager.email)).toBeVisible({ timeout: 20_000 });
  });

  // ── PoliciesManager ──────────────────────────────────────────────────────

  test('policies-manager renders and opens policy detail with access switches + matrix', async ({
    page,
  }) => {
    await loadStory(page, POLICIES_STORY);
    await expect(page.getByTestId('policies-manager')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('e2e_users_manager_policy')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`policies-manager-row-${fixtures.manager.policyId}`).click();
    await expect(page.getByTestId('policy-detail')).toBeVisible({ timeout: 20_000 });
    // Mantine Switch renders its <input> visually hidden — assert presence.
    await expect(page.getByTestId('policy-detail-app-access')).toBeAttached();
    await expect(page.getByTestId('policy-detail-admin-access')).toBeAttached();
    // The SystemPermissions matrix renders for an existing policy
    await expect(page.getByTestId('policy-detail-permissions')).toBeVisible({ timeout: 20_000 });
  });

  test('matrix "Use Custom" opens the permission detail editor with live fields', async ({
    page,
  }) => {
    await loadStory(page, POLICIES_STORY);
    await expect(page.getByTestId('policies-manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`policies-manager-row-${fixtures.manager.policyId}`).click();
    await expect(page.getByTestId('policy-detail-permissions')).toBeVisible({ timeout: 20_000 });

    // daas_users:update is a custom-level cell (subset of fields) and NOT
    // app-minimal (that's daas_users:read, which renders as a locked badge).
    const toggle = page.getByTestId('policy-detail-permissions-toggle-daas_users-update');
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await expect(toggle).toHaveAttribute('data-level', 'custom');
    await toggle.click();
    await page.getByTestId('policy-detail-permissions-toggle-daas_users-update-custom').click();

    // The tabbed editor opens with the update-action tab set.
    // (The Modal-root testid element has no box of its own — assert the dialog role.)
    const modal = page.getByRole('dialog', { name: /daas_users → UPDATE/ });
    await expect(modal).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('policy-detail-permissions-detail-tab-permissions')).toBeVisible();
    await expect(page.getByTestId('policy-detail-permissions-detail-tab-validation')).toBeVisible();
    await expect(page.getByTestId('policy-detail-permissions-detail-tab-presets')).toBeVisible();

    // Field Permissions tab lists checkboxes from the live /api/fields/daas_users
    await page.getByTestId('policy-detail-permissions-detail-tab-fields').click();
    const firstName = page.getByTestId('policy-detail-permissions-detail-fields-field-first_name');
    await expect(firstName).toBeChecked({ timeout: 20_000 }); // in the fixture's update fields
    const email = page.getByTestId('policy-detail-permissions-detail-fields-field-email');
    await expect(email).toBeAttached();
    await expect(email).not.toBeChecked(); // not granted for update

    // Cancel — no mutation, editor closes (unmounts entirely)
    await page.getByTestId('policy-detail-permissions-detail-cancel').click();
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('policy-detail-permissions-detail')).not.toBeAttached();
  });

  test('custom permission edits persist only through the policy Save (live round-trip)', async ({
    page,
  }) => {
    const permsUrl = `http://localhost:3000/api/permissions?policy=${fixtures.manager.policyId}&limit=100`;
    const fetchDeletePerm = async () => {
      const res = await page.request.get(permsUrl);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      return (body.data as Array<{ collection: string; action: string; permissions: unknown }>).find(
        (p) => p.collection === 'daas_users' && p.action === 'delete',
      );
    };

    await loadStory(page, POLICIES_STORY);
    await expect(page.getByTestId('policies-manager')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`policies-manager-row-${fixtures.manager.policyId}`).click();
    await expect(page.getByTestId('policy-detail-permissions')).toBeVisible({ timeout: 20_000 });

    // Precondition: no daas_users:delete permission on the fixture policy
    expect(await fetchDeletePerm()).toBeUndefined();
    const cell = page.getByTestId('policy-detail-permissions-toggle-daas_users-delete');
    await expect(cell).toHaveAttribute('data-level', 'none');

    // Author a custom item filter (delete action → Item Permissions tab only)
    await cell.click();
    await page.getByTestId('policy-detail-permissions-toggle-daas_users-delete-custom').click();
    await expect(page.getByRole('dialog', { name: /daas_users → DELETE/ })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('policy-detail-permissions-detail-filter-mode-toggle').click();
    await page
      .getByTestId('policy-detail-permissions-detail-filter-json')
      .fill('{"status": {"_eq": "suspended"}}');
    await page.getByTestId('policy-detail-permissions-detail-save').click();

    // The edit is LOCAL: cell flips to custom, form goes dirty, nothing on the server yet
    await expect(cell).toHaveAttribute('data-level', 'custom');
    await expect(page.getByText('Unsaved Changes')).toBeVisible();
    expect(await fetchDeletePerm()).toBeUndefined();

    // Host Save applies the alterations to /api/permissions
    await page.getByTestId('policy-detail-save-btn').click();
    await expect(page.getByText('Unsaved Changes')).toBeHidden({ timeout: 20_000 });
    const saved = await fetchDeletePerm();
    expect(saved?.permissions).toEqual({ status: { _eq: 'suspended' } });
    // Matrix refetched clean from the server — still custom
    await expect(
      page.getByTestId('policy-detail-permissions-toggle-daas_users-delete'),
    ).toHaveAttribute('data-level', 'custom', { timeout: 20_000 });

    // Cleanup through the same flow: No Access + Save removes the row server-side
    await page.getByTestId('policy-detail-permissions-toggle-daas_users-delete').click();
    await page.getByTestId('policy-detail-permissions-toggle-daas_users-delete-none').click();
    await page.getByTestId('policy-detail-save-btn').click();
    await expect(page.getByText('Unsaved Changes')).toBeHidden({ timeout: 20_000 });
    expect(await fetchDeletePerm()).toBeUndefined();
    await expect(
      page.getByTestId('policy-detail-permissions-toggle-daas_users-delete'),
    ).toHaveAttribute('data-level', 'none');
  });
});

// ---------------------------------------------------------------------------
// RBAC gating — non-admin sees a reduced surface
// ---------------------------------------------------------------------------

test.describe('Users RBAC gating (viewer)', () => {
  let fixtures: ReturnType<typeof rbac>;

  test.beforeAll(async () => {
    const url = process.env.USERS_DAAS_URL || process.env.FILES_DAAS_URL || '';
    if (!url) test.skip(true, 'USERS_DAAS_URL / FILES_DAAS_URL not set');
    fixtures = rbac();
  });

  // Connect in the browser context's cookie jar (see note above).
  test.beforeEach(async ({ page }) => {
    await connectAs(page.request, fixtures.viewer.token);
  });

  test('viewer sees the users list but no Add User button', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });
    // Permission gating: viewer has read but not create on daas_users.
    // Search first — the admin fixture may be beyond page 1.
    await page.getByTestId('users-manager-search').fill(fixtures.admin.email);
    await expect(page.getByText(fixtures.admin.email)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('users-manager-add-btn')).toBeHidden();
  });
});
