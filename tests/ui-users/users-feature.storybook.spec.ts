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
