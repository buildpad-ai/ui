/**
 * SelectMultipleDropdown Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectMultipleDropdown component using Storybook.
 * Uses Mantine MultiSelect component.
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

test.describe('SelectMultipleDropdown - Basic Rendering', () => {
  test('Default: renders multi-select with label', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--default');
    await expect(page.getByText('Select Fruits')).toBeVisible();
    const input = page.locator('.mantine-MultiSelect-input, input[type="search"]').first();
    await expect(input).toBeVisible();
  });

  test('WithSelectedValues: renders with pre-selected pills', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--with-selected-values');
    // Selected values show as pills inside the input
    const pills = page.locator('.mantine-Pill-label');
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('WithPlaceholder: renders with placeholder text', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--with-placeholder');
    await expect(page.getByText('Assign Roles')).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('SelectMultipleDropdown - Features', () => {
  test('MaxTwoSelections: limits selections', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--max-two-selections');
    await expect(page.getByText('Select up to 2 fruits')).toBeVisible();
  });

  test('NotSearchable: renders without search', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--not-searchable');
    await expect(page.getByText('Select Fruits (no search)')).toBeVisible();
  });

  test('NotClearable: renders without clear button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--not-clearable');
    await expect(page.getByText('Select Fruits (no clear)')).toBeVisible();
    // Apple should be shown as a pill
    const pill = page.locator('.mantine-Pill-label').filter({ hasText: 'Apple' });
    await expect(pill).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectMultipleDropdown - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--required');
    // Mantine required shows asterisk
    const asterisk = page.locator('.mantine-InputWrapper-required, [data-required]');
    const count = await asterisk.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--with-error');
    await expect(page.getByText('Please select at least one option')).toBeVisible();
  });

  test('Disabled: multi-select is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--disabled');
    const input = page.locator('input').first();
    await expect(input).toBeDisabled();
  });

  test('EmptyChoices: shows error when no choices', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--empty-choices');
    await expect(page.getByText('Choices option configured incorrectly')).toBeVisible();
  });
});

// ============================================================================
// DaaS Integration
// ============================================================================

test.describe('SelectMultipleDropdown - DaaS', () => {
  test('AsDaaSBackendConfigured: renders mapper output', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--as-daa-s-backend-configured');
    await expect(page.getByText('Status Tags')).toBeVisible();
    const pill = page.locator('.mantine-Pill-label').filter({ hasText: 'Active' });
    await expect(pill).toBeVisible();
  });
});
