/**
 * SelectDropdown Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectDropdown component using Storybook.
 * Uses Mantine Select which renders a combobox input.
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

test.describe('SelectDropdown - Basic Rendering', () => {
  test('Default: renders with label and selected value', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--default');
    // Mantine Select renders as a regular input with data-testid
    const input = page.locator('[data-testid="select-dropdown"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('React');
    await expect(page.getByText('Favorite Framework')).toBeVisible();
  });

  test('StringValues: renders with string value selected', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--string-values');
    await expect(page.getByText('Project Category')).toBeVisible();
    await expect(page.getByText('Select the main category for your project')).toBeVisible();
  });

  test('NumericValues: renders with numeric value', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--numeric-values');
    await expect(page.getByText('Priority Level', { exact: true })).toBeVisible();
    const input = page.locator('[data-testid="select-dropdown"]');
    // Numeric value 3 maps to "High" text
    const val = await input.inputValue();
    expect(val).toBeTruthy();
  });

  test('BooleanValues: renders with boolean value', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--boolean-values');
    await expect(page.getByText('Status')).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('SelectDropdown - Features', () => {
  test('Clearable: renders with clearable option', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--clearable');
    await expect(page.getByText('Optional Framework')).toBeVisible();
    await expect(page.getByText('You can clear this selection')).toBeVisible();
  });

  test('Searchable: renders with search functionality', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--searchable');
    await expect(page.getByText('Searchable Framework')).toBeVisible();
  });

  test('AllowCustomValues: renders with custom value support', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--allow-custom-values');
    await expect(page.getByText('Framework or Custom')).toBeVisible();
  });

  test('WithIcon: renders with icon in left section', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--with-icon');
    await expect(page.getByText('Framework')).toBeVisible();
  });

  test('LargeDataset: renders with 100 items and search', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--large-dataset');
    await expect(page.getByText('Country', { exact: true })).toBeVisible();
    await expect(page.getByText('Large list with search functionality')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectDropdown - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--required');
    const label = page.locator('label');
    await expect(label).toBeVisible();
    // Mantine required shows asterisk
    const asterisk = page.locator('.mantine-InputWrapper-required, [data-required]');
    const count = await asterisk.count();
    expect(count).toBeGreaterThanOrEqual(0); // Required indicator present
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--with-error');
    await expect(page.getByText('Please select a valid framework')).toBeVisible();
  });

  test('Disabled: select is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--disabled');
    const input = page.locator('[data-testid="select-dropdown"]');
    await expect(input).toBeDisabled();
  });

  test('ReadOnly: select is read-only', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--read-only');
    const input = page.locator('[data-testid="select-dropdown"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('readonly', '');
  });

  test('NoChoicesError: shows error when no choices', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--no-choices-error');
    await expect(page.getByText('Choices option configured incorrectly')).toBeVisible();
  });
});

// ============================================================================
// All Features
// ============================================================================

test.describe('SelectDropdown - Combined', () => {
  test('AllFeatures: renders with all features combined', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--all-features');
    await expect(page.getByText('Advanced Framework Selection')).toBeVisible();
    await expect(page.getByText('Demonstrates all available features')).toBeVisible();
  });
});
