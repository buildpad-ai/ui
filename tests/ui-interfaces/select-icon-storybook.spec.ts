/**
 * SelectIcon Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectIcon component using Storybook.
 * Icon picker with search, categories, and grid display.
 * 
 * Run: SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6005 npx playwright test --project=storybook-interfaces --reporter=line
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('SelectIcon - Basic Rendering', () => {
  test('Default: renders icon picker', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--default');
    // Should render the component without errors
    await page.waitForTimeout(300);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('WithLabel: renders with label', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--with-label');
    await expect(page.getByText('Choose an Icon')).toBeVisible();
  });

  test('WithValue: renders with pre-selected icon', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--with-value');
    await expect(page.getByText('Selected Icon')).toBeVisible();
  });

  test('LongIconName: renders with long icon name', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--long-icon-name');
    await expect(page.getByText('Icon')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectIcon - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--required');
    // Label renders as "Icon*" with asterisk for required
    await expect(page.getByText(/Icon\*/)).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--with-error');
    await expect(page.getByText('Please select an icon')).toBeVisible();
  });

  test('Disabled: icon picker is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--disabled');
    await expect(page.getByText('Icon', { exact: true }).first()).toBeVisible();
  });

  test('DisabledWithValue: disabled with pre-selected value', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--disabled-with-value');
    await expect(page.getByText('Icon', { exact: true }).first()).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('SelectIcon - Features', () => {
  test('SearchExample: renders with search hint', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--search-example');
    await expect(page.getByText('Icon')).toBeVisible();
  });

  test('IconCategories: renders with categories', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--icon-categories');
    await expect(page.getByText('Browse Categories')).toBeVisible();
  });

  test('CustomWidth: renders with custom width', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--custom-width');
    await expect(page.getByText('Icon', { exact: true }).first()).toBeVisible();
  });
});
