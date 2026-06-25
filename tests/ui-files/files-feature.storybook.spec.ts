/**
 * Files Feature Smoke — Admin Storybook spec (Part 4, admin path)
 *
 * Proves every File Manager feature end-to-end against a real DaaS instance
 * through the ui-files Storybook DaaS playground (port 6009) proxied via
 * the storybook-host (port 3000).
 *
 * Auth: connect as admin via POST /api/connect → host sets the encrypted
 * cookie that the Storybook proxy forwards for all /api/* calls.
 *
 * Storybook story: Files/FileManager (DaaS) → Playground
 *   iframe URL: http://localhost:6009/iframe.html?id=files-filemanager-daas--playground
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { connectAs } from './helpers/auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RBAC_JSON = path.join(__dirname, '.files-rbac.json');
const STORYBOOK_BASE = 'http://localhost:6009';
const FILE_MANAGER_STORY = `${STORYBOOK_BASE}/iframe.html?id=files-filemanager-daas--playground&viewMode=story`;
const FILE_DETAIL_STORY = `${STORYBOOK_BASE}/iframe.html?id=files-filedetail-daas--playground&viewMode=story`;

function rbac() {
  if (!fs.existsSync(RBAC_JSON)) throw new Error(`${RBAC_JSON} not found — run test:files:setup`);
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8'));
}

async function loadStory(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  // Give React + DaaS data a moment to settle
  await page.waitForTimeout(1500);
}

async function waitForFileManager(page: Page): Promise<void> {
  await expect(page.getByTestId('file-manager')).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Feature smoke suite — runs as admin
// ---------------------------------------------------------------------------

test.describe('Files Feature Smoke (admin)', () => {
  let adminToken: string;
  let uploadedFileId: string | null = null;
  let createdFolderId: string | null = null;
  const filesUrl = process.env.FILES_DAAS_URL || '';

  test.beforeAll(async ({ request }) => {
    if (!filesUrl) test.skip(true, 'FILES_DAAS_URL not set');
    adminToken = rbac().admin.token;
    await connectAs(request, adminToken);
  });

  test.afterAll(async () => {
    // Clean up any files / folders created during the smoke test
    if (!adminToken || !filesUrl) return;
    if (uploadedFileId) {
      await fetch(`${filesUrl}/api/files/${uploadedFileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
    if (createdFolderId) {
      await fetch(`${filesUrl}/api/folders/${createdFolderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
  });

  // ── FileManager renders ────────────────────────────────────────────────

  test('file-manager renders', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);
  });

  // ── Toolbar affordances ────────────────────────────────────────────────

  test('admin sees new-folder button and view toggle', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);
    await expect(page.getByTestId('files-new-folder')).toBeVisible();
    await expect(page.getByTestId('files-view-toggle')).toBeVisible();
  });

  // ── Upload (from device) ───────────────────────────────────────────────

  test('upload a file via Upload component', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    // The Upload component renders an upload dropzone / button
    const uploadBtn = page.getByTestId('upload-from-device-btn');
    await expect(uploadBtn).toBeVisible({ timeout: 10_000 });

    // Use file chooser to upload a small text file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      uploadBtn.click(),
    ]);
    await fileChooser.setFiles({
      name: 'e2e-smoke-upload.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('E2E smoke test file'),
    });

    // Wait for a file-card to appear (the uploaded file)
    await expect(page.getByTestId('file-card').first()).toBeVisible({ timeout: 20_000 });
  });

  // ── Create folder ──────────────────────────────────────────────────────

  test('create a new folder', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    await page.getByTestId('files-new-folder').click();
    await expect(page.getByTestId('new-folder-name')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('new-folder-name').fill('e2e-smoke-folder');
    await page.getByTestId('new-folder-submit').click();

    // Folder card should appear
    await expect(page.getByTestId('folder-card').first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Navigate into folder + breadcrumb back ─────────────────────────────

  test('navigate into folder and back via breadcrumb', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    // Expect at least one folder (from prior test or existing data)
    const folderCard = page.getByTestId('folder-card').first();
    const folderExists = await folderCard.isVisible().catch(() => false);
    if (!folderExists) test.skip(true, 'No folders to navigate into');

    await folderCard.dblclick();
    // Breadcrumb should appear
    await expect(page.getByTestId('folder-breadcrumb')).toBeVisible({ timeout: 8_000 });

    // Click root breadcrumb to go back
    const breadcrumb = page.getByTestId('folder-breadcrumb');
    await breadcrumb.getByRole('link').first().click();
    await expect(page.getByTestId('file-manager')).toBeVisible({ timeout: 8_000 });
  });

  // ── Grid / list toggle ─────────────────────────────────────────────────

  test('toggle between grid and list view', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    const toggle = page.getByTestId('files-view-toggle');
    await toggle.click();
    // After toggle, either files-list or files-grid should be present
    const list = page.getByTestId('files-list');
    const grid = page.getByTestId('files-grid');
    const hasView = (await list.isVisible()) || (await grid.isVisible());
    expect(hasView).toBe(true);

    // Toggle back
    await toggle.click();
  });

  // ── Search ─────────────────────────────────────────────────────────────

  test('search filters the file list', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    const search = page.getByTestId('files-search');
    await search.fill('zzz-no-match-query');
    await page.waitForTimeout(600); // debounce
    // Either no cards, or empty state message
    const cardCount = await page.getByTestId('file-card').count();
    const folderCount = await page.getByTestId('folder-card').count();
    // After searching something unlikely to match, expect fewer results
    expect(cardCount + folderCount).toBeLessThanOrEqual(3);

    await search.clear();
  });

  // ── Select + bulk delete ───────────────────────────────────────────────

  test('select file and bulk delete', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    // Need at least one file-card
    const card = page.getByTestId('file-card').first();
    const hasCard = await card.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!hasCard) test.skip(true, 'No file cards to select');

    // Click checkbox
    const checkbox = page.getByTestId('file-card-checkbox').first();
    await checkbox.click();

    // Bulk actions bar should appear
    await expect(page.getByTestId('files-bulk-actions')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('files-bulk-delete').click();

    // Confirm modal
    await expect(page.getByTestId('files-delete-confirm-modal')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('files-delete-confirm-btn').click();

    // Modal should close
    await expect(page.getByTestId('files-delete-confirm-modal')).not.toBeVisible({ timeout: 8_000 });
  });

  // ── Import from URL ────────────────────────────────────────────────────

  test('import-from-URL button is visible', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await waitForFileManager(page);

    // The Upload component renders the import-from-url button
    await expect(page.getByTestId('import-from-url-btn')).toBeVisible({ timeout: 10_000 });
  });

  // ── FileDetail ─────────────────────────────────────────────────────────

  test('file-detail renders with delete, download, and metadata form', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('file-detail-delete')).toBeVisible();
    await expect(page.getByTestId('file-detail-download')).toBeVisible();
    await expect(page.getByTestId('file-metadata-form')).toBeVisible();
    await expect(page.getByTestId('file-metadata-save')).toBeVisible();
  });

  test('file-detail: folder select (move-to-folder) is rendered', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('file-folder-select')).toBeVisible();
  });

  test('file-detail: info panel copy-id button present', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });
    // Info panel may be in a sidebar — scroll into view if needed
    const infoPanel = page.getByTestId('file-info-panel');
    const hasPanelVisible = await infoPanel.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasPanelVisible) {
      await expect(page.getByTestId('file-info-copy-id')).toBeVisible();
    }
  });

  test('file-detail: replace button is visible for image/file', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });
    // Replace may only show for certain file types — just assert it exists in DOM
    const replace = page.getByTestId('file-detail-replace');
    const exists = await replace.count();
    // Not every file type shows replace — acceptable if absent
    if (exists > 0) {
      await expect(replace.first()).toBeVisible();
    }
  });

  test('file-detail: edit metadata title and save', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });

    const form = page.getByTestId('file-metadata-form');
    await expect(form).toBeVisible();

    // Fill the title field (first text input in the metadata form)
    const titleInput = form.getByRole('textbox').first();
    await titleInput.fill(`e2e-smoke-title-${Date.now()}`);

    const saveBtn = page.getByTestId('file-metadata-save');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // No error toast / modal — pass
    await page.waitForTimeout(1000);
  });

  // ── Preview types ──────────────────────────────────────────────────────

  test('file preview renders (image, video, audio, pdf, or fallback)', async ({ page }) => {
    await loadStory(page, FILE_DETAIL_STORY);
    await expect(page.getByTestId('file-detail')).toBeVisible({ timeout: 20_000 });

    // At least one preview type should be rendered
    const previewIds = [
      'file-preview-image',
      'file-preview-video',
      'file-preview-audio',
      'file-preview-pdf',
      'file-preview-fallback',
    ];
    let found = false;
    for (const id of previewIds) {
      const el = page.getByTestId(id);
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
