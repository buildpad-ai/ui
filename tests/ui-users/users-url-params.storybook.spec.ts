/**
 * URL persistence — Storybook spec (useUrlListParams via UsersManager)
 *
 * Proves the default URL behavior added to the list managers: settled search /
 * sort / page state lands in the query string (debounced, replaceState), a
 * reload restores the view from the URL, and parameters the manager does not
 * own (Storybook's own `id` / `viewMode`) survive every write.
 *
 * Same harness as users-feature.storybook.spec.ts: real DaaS through the
 * storybook-host proxy, connected as admin via POST /api/connect.
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

function rbac() {
  if (!fs.existsSync(RBAC_JSON)) throw new Error(`${RBAC_JSON} not found — run test:users:setup`);
  return JSON.parse(fs.readFileSync(RBAC_JSON, 'utf-8'));
}

async function loadStory(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

test.describe('UsersManager URL persistence', () => {
  test.beforeAll(async () => {
    const url = process.env.USERS_DAAS_URL || process.env.FILES_DAAS_URL || '';
    if (!url) test.skip(true, 'USERS_DAAS_URL / FILES_DAAS_URL not set');
    rbac();
  });

  test.beforeEach(async ({ page }) => {
    await connectAs(page, 'admin');
  });

  test('typing a search settles into the URL, debounced, preserving foreign params', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('users-manager-search').fill('admin');

    // The write rides the manager's 300 ms debounce — poll, don't sleep.
    await expect.poll(() => page.url(), { timeout: 5_000 }).toContain('search=admin');

    // Merge, don't clobber: Storybook's own params must survive the write.
    const url = new URL(page.url());
    expect(url.searchParams.get('id')).toBe('users-usersmanager-daas--playground');
    expect(url.searchParams.get('viewMode')).toBe('story');
  });

  test('a reload restores the searched view from the URL', async ({ page }) => {
    await loadStory(page, `${USERS_STORY}&search=admin`);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    // The input is hydrated from the URL, and the list is already filtered.
    await expect(page.getByTestId('users-manager-search')).toHaveValue('admin');
  });

  test('clearing the search removes the parameter (defaults stay off the URL)', async ({ page }) => {
    await loadStory(page, `${USERS_STORY}&search=admin`);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('users-manager-search').fill('');
    await expect.poll(() => page.url(), { timeout: 5_000 }).not.toContain('search=');
    // Storybook's params still intact after the delete-path write.
    expect(new URL(page.url()).searchParams.get('viewMode')).toBe('story');
  });

  test('a sort click lands in the URL as a DaaS-style sort string', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    // First click sorts ascending by email; second flips to `-email`.
    const emailHeader = page.getByRole('button', { name: /email/i }).first()
      .or(page.locator('th', { hasText: /email/i }).first());
    await emailHeader.click();
    await expect.poll(() => page.url(), { timeout: 5_000 }).toMatch(/sort=(-)?email/);
  });

  test('urlParams can be steered externally: popstate-style rewrites flow back into state', async ({ page }) => {
    await loadStory(page, USERS_STORY);
    await expect(page.getByTestId('users-manager')).toBeVisible({ timeout: 20_000 });

    // Simulate what the micro-frontend bridge does after SET_QUERY_PARAMS:
    // rewrite the URL programmatically and dispatch the contract event.
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('search', 'driven-from-outside');
      window.history.replaceState(window.history.state, '', url.toString());
      window.dispatchEvent(new Event('buildpad:urlchange'));
    });

    await expect(page.getByTestId('users-manager-search')).toHaveValue(
      'driven-from-outside',
      { timeout: 5_000 },
    );
  });
});
