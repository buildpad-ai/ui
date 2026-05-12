/**
 * CollectionItemDropdown Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces CollectionItemDropdown component.
 * Covers: default, mock items, value, collection selector, templates,
 * search, allow none, enable link, states, custom primary key, full featured.
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

test.describe('CollectionItemDropdown - Basic Rendering', () => {
  test('Default: renders dropdown with label', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--default');
    await expect(page.getByText('Select Item')).toBeVisible();
  });

  test('WithMockItems: renders with mock user data', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--with-mock-items');
    await expect(page.getByText('Select User')).toBeVisible();
  });

  test('WithValue: renders with pre-selected value', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--with-value');
    await expect(page.getByText('Selected Article')).toBeVisible();
  });
});

test.describe('CollectionItemDropdown - Collection Selector', () => {
  test('WithCollectionSelector: renders collection picker', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--with-collection-selector');
    await expect(page.getByText('Related Item')).toBeVisible();
  });

  test('IncludeSystemCollections: includes system collections', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--include-system-collections');
    await expect(page.getByText('Any Item')).toBeVisible();
  });
});

test.describe('CollectionItemDropdown - Templates', () => {
  test('CustomTemplate: renders with custom display template', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--custom-template');
    // Label is "User" but page also contains "USERS" (collection badge).
    // getByText('User') matches both "User" and "USERS" (substring).
    // Use exact match on the label text.
    await expect(page.getByText('User', { exact: true }).first()).toBeVisible();
    // Verify the selected value template rendered
    await expect(page.getByText('Alice Johnson (alice@example.com)')).toBeVisible();
  });

  test('TemplateWithStatus: renders template with status', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--template-with-status');
    // Label is "Article" but page also contains "ARTICLES" (collection badge).
    // Use exact match.
    await expect(page.getByText('Article', { exact: true }).first()).toBeVisible();
  });
});

test.describe('CollectionItemDropdown - Features', () => {
  test('Searchable: renders with search enabled', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--searchable');
    await expect(page.getByText('Search Items')).toBeVisible();
  });

  test('AllowNone: renders clearable selection', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--allow-none');
    await expect(page.getByText('Clearable Selection')).toBeVisible();
  });

  test('WithEnableLink: renders with link icon', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--with-enable-link');
    await expect(page.getByText('Linked Item')).toBeVisible();
  });
});

test.describe('CollectionItemDropdown - States', () => {
  test('Required: renders required field', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--required');
    await expect(page.getByText('Required Item')).toBeVisible();
  });

  test('WithError: renders error state', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--with-error');
    await expect(page.getByText('Please select an item')).toBeVisible();
  });

  test('Disabled: renders disabled state', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--disabled');
    await expect(page.getByText('Disabled', { exact: true }).first()).toBeVisible();
  });

  test('ReadOnly: renders read-only state', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--read-only');
    await expect(page.getByText('Read Only', { exact: true }).first()).toBeVisible();
  });
});

test.describe('CollectionItemDropdown - Advanced', () => {
  test('CustomPrimaryKey: renders with custom primary key', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--custom-primary-key');
    await expect(page.getByText('Select Product')).toBeVisible();
  });

  test('FullFeatured: renders with all features enabled', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--full-featured');
    await expect(page.getByText('Assign Reviewer')).toBeVisible();
  });

  test('EmptyState: renders empty collection state', async ({ page }) => {
    await goToStory(page, 'interfaces-collectionitemdropdown--empty-state');
    await expect(page.getByText('Select Item')).toBeVisible();
  });
});
