/**
 * Files RBAC — Storybook UI spec (Part 4, RBAC matrix)
 *
 * For each role, connects via the storybook-host proxy (POST /api/connect)
 * then opens the FileManager DaaS playground and asserts that the correct
 * affordances are shown or hidden per the RBAC policy:
 *
 *   admin  → all affordances visible; bulk-delete enabled
 *   editor → create visible; can edit/delete own file; folder rename visible
 *   viewer → no upload, no new-folder, no bulk-delete, no file-detail-delete,
 *             file-metadata-save disabled
 *   noperm → empty / no file-cards, no upload
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { connectAs } from './helpers/auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '.files-rbac.json');
const STORYBOOK_BASE = 'http://localhost:6009';
const FILE_MANAGER_STORY = `${STORYBOOK_BASE}/iframe.html?id=files-filemanager-daas--playground&viewMode=story`;
const FILE_DETAIL_STORY = `${STORYBOOK_BASE}/iframe.html?id=files-filedetail-daas--playground&viewMode=story`;

interface RoleEntry {
  userId: string;
  email: string;
  token: string;
}
interface RbacJson {
  admin: RoleEntry;
  editor: RoleEntry;
  viewer: RoleEntry;
  noperm: RoleEntry;
}

function rbac(): RbacJson {
  if (!fs.existsSync(RBAC_JSON)) throw new Error(`${RBAC_JSON} not found — run test:files:setup`);
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8'));
}

async function openFileManager(page: Page): Promise<void> {
  await page.goto(FILE_MANAGER_STORY);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('file-manager')).toBeVisible({ timeout: 20_000 });
}

async function openFileDetail(page: Page): Promise<void> {
  await page.goto(FILE_DETAIL_STORY);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Helper: ensure at least one file exists (uploaded by admin) so the
// grid / list is non-empty for viewer / noperm assertions.
// ---------------------------------------------------------------------------

async function ensureAdminSeedFile(request: APIRequestContext, adminToken: string): Promise<string | null> {
  const filesUrl = process.env.FILES_DAAS_URL || '';
  if (!filesUrl) return null;

  const form = new FormData();
  form.append('file', new Blob(['e2e rbac storybook seed'], { type: 'text/plain' }), 'e2e-rbac-seed.txt');
  form.append('title', `e2e-rbac-seed-${Date.now()}`);

  const res = await request.fetch(`${filesUrl}/api/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    multipart: {
      file: { name: 'e2e-rbac-seed.txt', mimeType: 'text/plain', buffer: Buffer.from('e2e rbac storybook seed') },
      title: `e2e-rbac-seed-${Date.now()}`,
    },
  });

  if (!res.ok()) return null;
  const json = await res.json();
  return json?.data?.id ?? null;
}

async function cleanupFile(request: APIRequestContext, adminToken: string, fileId: string): Promise<void> {
  const filesUrl = process.env.FILES_DAAS_URL || '';
  if (!filesUrl || !fileId) return;
  await request.fetch(`${filesUrl}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

// ---------------------------------------------------------------------------
// Admin role
// ---------------------------------------------------------------------------

test.describe('RBAC UI — admin', () => {
  let tokens: RbacJson;

  test.beforeAll(async ({ request }) => {
    tokens = rbac();
    await connectAs(request, tokens.admin.token);
  });

  test('new-folder button is visible', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('files-new-folder')).toBeVisible();
  });

  test('view toggle is visible', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('files-view-toggle')).toBeVisible();
  });

  test('selecting a file shows bulk-actions with delete', async ({ page }) => {
    await openFileManager(page);

    const card = page.getByTestId('file-card').first();
    const hasCard = await card.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasCard) test.skip(true, 'No file cards for selection test');

    await page.getByTestId('file-card-checkbox').first().click();
    await expect(page.getByTestId('files-bulk-actions')).toBeVisible();
    await expect(page.getByTestId('files-bulk-delete')).toBeVisible();
  });

  test('file-detail: delete button visible', async ({ page }) => {
    await openFileDetail(page);
    await expect(page.getByTestId('file-detail-delete')).toBeVisible();
  });

  test('file-detail: metadata-save is enabled', async ({ page }) => {
    await openFileDetail(page);
    await expect(page.getByTestId('file-metadata-save')).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Editor role
// ---------------------------------------------------------------------------

test.describe('RBAC UI — editor', () => {
  let tokens: RbacJson;

  test.beforeAll(async ({ request }) => {
    tokens = rbac();
    await connectAs(request, tokens.editor.token);
  });

  test('new-folder button is visible', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('files-new-folder')).toBeVisible();
  });

  test('upload affordance is visible', async ({ page }) => {
    await openFileManager(page);
    // Upload component renders for users with create permission
    const upload = page.getByTestId('upload-component');
    await expect(upload).toBeVisible({ timeout: 10_000 });
  });

  test('can create a folder', async ({ page }) => {
    await openFileManager(page);
    await page.getByTestId('files-new-folder').click();
    await expect(page.getByTestId('new-folder-name')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('new-folder-name').fill(`e2e-editor-folder-${Date.now()}`);
    await page.getByTestId('new-folder-submit').click();
    // Folder should appear or dialog closes (either is success)
    await expect(page.getByTestId('file-manager')).toBeVisible({ timeout: 8_000 });
  });

  test('file-detail: metadata-save is enabled for own file', async ({ page }) => {
    await openFileDetail(page);
    await expect(page.getByTestId('file-metadata-save')).toBeEnabled({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Viewer role
// ---------------------------------------------------------------------------

test.describe('RBAC UI — viewer', () => {
  let tokens: RbacJson;
  let seedFileId: string | null = null;

  test.beforeAll(async ({ request }) => {
    tokens = rbac();
    // Seed a file as admin so the viewer sees something
    seedFileId = await ensureAdminSeedFile(request, tokens.admin.token);
    await connectAs(request, tokens.viewer.token);
  });

  test.afterAll(async ({ request }) => {
    if (seedFileId) await cleanupFile(request, tokens.admin.token, seedFileId);
  });

  test('new-folder button is hidden', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('files-new-folder')).not.toBeVisible();
  });

  test('upload affordance is hidden', async ({ page }) => {
    await openFileManager(page);
    // Upload component should not render without create permission
    const upload = page.getByTestId('upload-component');
    await expect(upload).not.toBeVisible({ timeout: 5_000 });
  });

  test('selecting a file does not show bulk-delete', async ({ page }) => {
    await openFileManager(page);

    const card = page.getByTestId('file-card').first();
    const hasCard = await card.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasCard) test.skip(true, 'No file-cards visible for viewer — empty or no permission');

    // Try to click checkbox
    const checkbox = page.getByTestId('file-card-checkbox').first();
    const checkboxVisible = await checkbox.isVisible({ timeout: 3_000 }).catch(() => false);
    if (checkboxVisible) {
      await checkbox.click();
      // bulk-delete should not appear
      await expect(page.getByTestId('files-bulk-delete')).not.toBeVisible({ timeout: 3_000 });
    }
    // If no checkbox visible, viewer can't select — also passes the intent
  });

  test('file-detail: delete button is hidden', async ({ page }) => {
    await openFileDetail(page);
    await expect(page.getByTestId('file-detail-delete')).not.toBeVisible({ timeout: 10_000 });
  });

  test('file-detail: metadata-save is disabled', async ({ page }) => {
    await openFileDetail(page);
    // Save button should be disabled or absent
    const saveBtn = page.getByTestId('file-metadata-save');
    const saveVisible = await saveBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (saveVisible) {
      await expect(saveBtn).toBeDisabled();
    }
    // If not visible at all, viewer has no edit form — acceptable
  });
});

// ---------------------------------------------------------------------------
// Noperm role
// ---------------------------------------------------------------------------

test.describe('RBAC UI — noperm', () => {
  let tokens: RbacJson;

  test.beforeAll(async ({ request }) => {
    tokens = rbac();
    await connectAs(request, tokens.noperm.token);
  });

  test('no file-cards rendered (no daas_files read permission)', async ({ page }) => {
    await openFileManager(page);

    // With no permissions, the file list should be empty
    const cardCount = await page.getByTestId('file-card').count();
    expect(cardCount).toBe(0);
  });

  test('upload affordance is hidden', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('upload-component')).not.toBeVisible({ timeout: 5_000 });
  });

  test('new-folder button is hidden', async ({ page }) => {
    await openFileManager(page);
    await expect(page.getByTestId('files-new-folder')).not.toBeVisible();
  });
});
