/**
 * SelectMultipleCheckboxTree Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectMultipleCheckboxTree component using Storybook.
 * Hierarchical tree with checkboxes, search, and value-combining modes.
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

function checkboxInputs(page: import('@playwright/test').Page) {
  return page.locator('input[type="checkbox"]');
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('SelectMultipleCheckboxTree - Basic Rendering', () => {
  test('Default: renders tree with categories', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--default');
    await expect(page.getByText('Select Categories')).toBeVisible();
    // Should show top-level nodes: Technology, Design, Business
    await expect(page.getByText('Technology')).toBeVisible();
    await expect(page.getByText('Design')).toBeVisible();
    await expect(page.getByText('Business')).toBeVisible();
  });

  test('WithSelectedValues: renders with pre-selected values', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--with-selected-values');
    await expect(page.getByText('Select Categories')).toBeVisible();
    // frontend and ui should be checked
    const checkboxes = checkboxInputs(page);
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3); // At least top-level nodes
  });

  test('FlatChoices: renders flat list without tree', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--flat-choices');
    await expect(page.getByText('Flat list (no tree)')).toBeVisible();
    await expect(page.getByText('Option A')).toBeVisible();
    await expect(page.getByText('Option D')).toBeVisible();
  });

  test('EmptyChoices: renders empty state', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--empty-choices');
    await expect(page.getByText('No categories defined')).toBeVisible();
  });
});

// ============================================================================
// Value Combining Modes
// ============================================================================

test.describe('SelectMultipleCheckboxTree - Value Combining', () => {
  test('ValueCombiningAll: renders with "all" mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--value-combining-all');
    await expect(page.getByText('All nodes selected')).toBeVisible();
  });

  test('ValueCombiningLeaf: renders with "leaf" mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--value-combining-leaf');
    await expect(page.getByText('Leaf nodes only')).toBeVisible();
  });

  test('ValueCombiningBranch: renders with "branch" mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--value-combining-branch');
    await expect(page.getByText('Branch root only')).toBeVisible();
  });

  test('ValueCombiningExclusive: renders with "exclusive" mode', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--value-combining-exclusive');
    await expect(page.getByText('Exclusive (only clicked node)')).toBeVisible();
  });
});

// ============================================================================
// Deep Hierarchy
// ============================================================================

test.describe('SelectMultipleCheckboxTree - Deep Hierarchy', () => {
  test('DeepHierarchy: renders 3-level nesting', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--deep-hierarchy');
    await expect(page.getByText('Select Regions')).toBeVisible();
    await expect(page.getByText('Europe', { exact: true })).toBeVisible();
    await expect(page.getByText('Asia', { exact: true })).toBeVisible();
  });

  test('DeepHierarchyWithSelection: renders with deep selections', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--deep-hierarchy-with-selection');
    await expect(page.getByText('Select Regions')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectMultipleCheckboxTree - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--required');
    await expect(page.getByText('Select Categories')).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--with-error');
    await expect(page.getByText('Please select at least one category')).toBeVisible();
  });

  test('Disabled: tree is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--disabled');
    const checkboxes = checkboxInputs(page);
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // All checkboxes should be disabled
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeDisabled();
    }
  });
});

// ============================================================================
// DaaS Integration
// ============================================================================

test.describe('SelectMultipleCheckboxTree - DaaS', () => {
  test('AsDaaSBackendConfigured: renders mapper output', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--as-daa-s-backend-configured');
    await expect(page.getByText('Content Categories')).toBeVisible();
  });
});
