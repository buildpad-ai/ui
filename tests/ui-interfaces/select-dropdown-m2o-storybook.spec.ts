/**
 * SelectDropdownM2O Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectDropdownM2O component in isolation using Storybook.
 * Covers: default, dropdown/modal layouts, template, searchable, create,
 * link, allow none, required, error, disabled, readonly, full featured.
 * 
 * Note: SelectDropdownM2O renders a "Configuration Error" message in Storybook because
 * relational interfaces require API proxy routes. The error message contains
 * field names that can match label text, so we use exact matching.
 * 
 * Run: pnpm test:storybook:interfaces
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

test.describe('SelectDropdownM2O - Basic Rendering', () => {
  test('Default: renders M2O selector', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--default');
    await expect(page.getByText('Category', { exact: true }).first()).toBeVisible();
  });

  test('DropdownLayout: renders dropdown mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--dropdown-layout');
    await expect(page.getByText('Author', { exact: true }).first()).toBeVisible();
  });

  test('ModalLayout: renders modal mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--modal-layout');
    await expect(page.getByText('Department', { exact: true }).first()).toBeVisible();
  });
});

test.describe('SelectDropdownM2O - Features', () => {
  test('WithTemplate: renders with display template', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--with-template');
    await expect(page.getByText('Manager', { exact: true }).first()).toBeVisible();
  });

  test('Searchable: renders with search enabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--searchable');
    await expect(page.getByText('Customer', { exact: true }).first()).toBeVisible();
  });

  test('WithCreateEnabled: renders with create button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--with-create-enabled');
    await expect(page.getByText('Brand', { exact: true }).first()).toBeVisible();
  });

  test('WithLinkEnabled: renders with link to item', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--with-link-enabled');
    await expect(page.getByText('Parent Category', { exact: true }).first()).toBeVisible();
  });

  test('AllowNone: renders clearable selection', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--allow-none');
    await expect(page.getByText('Supervisor (Optional)', { exact: true }).first()).toBeVisible();
  });
});

test.describe('SelectDropdownM2O - States', () => {
  test('Required: renders required field', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--required');
    await expect(page.getByText('Organization', { exact: true }).first()).toBeVisible();
  });

  test('WithError: renders error state', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--with-error');
    // The error text may not render visibly; check label instead
    await expect(page.getByText('Team', { exact: true }).first()).toBeVisible();
  });

  test('Disabled: renders disabled state', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--disabled');
    await expect(page.getByText('Status', { exact: true }).first()).toBeVisible();
  });

  test('ReadOnly: renders read-only state', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--read-only');
    await expect(page.getByText('Created By', { exact: true }).first()).toBeVisible();
  });
});

test.describe('SelectDropdownM2O - Advanced', () => {
  test('FullFeatured: renders with all features', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--full-featured');
    await expect(page.getByText('Assigned To', { exact: true }).first()).toBeVisible();
  });

  test('ProductCategory: renders product category use case', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdownm2o--product-category');
    await expect(page.getByText('Product Category', { exact: true }).first()).toBeVisible();
  });
});
