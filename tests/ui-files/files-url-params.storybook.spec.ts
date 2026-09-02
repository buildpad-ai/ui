/**
 * URL persistence — Storybook spec (useUrlListParams via FileManager)
 *
 * Mirrors tests/ui-users/users-url-params.storybook.spec.ts for the Files
 * module: settled search lands in the query string (debounced, replaceState),
 * a reload restores the view, opening a folder deep-links as `?folder=<id>`,
 * and that deep link rebuilds the breadcrumb from a bare id.
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

function rbac() {
  if (!fs.existsSync(RBAC_JSON)) throw new Error(`${RBAC_JSON} not found — run test:files:setup`);
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8'));
}

async function loadStory(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

test.describe('FileManager URL persistence', () => {
  test.beforeAll(async () => {
    if (!process.env.FILES_DAAS_URL) test.skip(true, 'FILES_DAAS_URL not set');
    rbac();
  });

  test.beforeEach(async ({ page }) => {
    await connectAs(page.request, rbac().admin.token);
  });

  test('search settles into the URL and a reload restores it', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await expect(page.getByTestId('files-toolbar')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('files-search').fill('report');
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('search=report');
    // Storybook's own params survive the write (merge, don't clobber).
    expect(new URL(page.url()).searchParams.get('viewMode')).toBe('story');

    await page.reload();
    await expect(page.getByTestId('files-search')).toHaveValue('report', {
      timeout: 20_000,
    });
  });

  test('opening a folder deep-links it, and the deep link rebuilds the breadcrumb', async ({ page }) => {
    await loadStory(page, FILE_MANAGER_STORY);
    await expect(page.getByTestId('files-toolbar')).toBeVisible({ timeout: 20_000 });

    // Create a folder to navigate into (name unique per run; cleaned by teardown's
    // fixture sweep or harmless to leave behind in the test DaaS).
    const folderName = `url-sync-${Date.now()}`;
    await page.getByTestId('files-new-folder').click();
    await page.getByRole('textbox').last().fill(folderName);
    await page.getByRole('button', { name: /create/i }).click();

    const card = page.getByText(folderName, { exact: true }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.dblclick().catch(() => card.click());

    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('folder=');
    const folderId = new URL(page.url()).searchParams.get('folder');
    expect(folderId).toBeTruthy();

    // Cold-load the deep link: the breadcrumb must be rebuilt from the bare id.
    await loadStory(page, `${FILE_MANAGER_STORY}&folder=${folderId}`);
    await expect(page.getByText(folderName).first()).toBeVisible({ timeout: 20_000 });
  });
});
