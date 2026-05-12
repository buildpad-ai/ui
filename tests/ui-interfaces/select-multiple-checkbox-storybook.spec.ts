/**
 * SelectMultipleCheckbox Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectMultipleCheckbox component using Storybook.
 * Uses Mantine Checkbox components in a grid layout.
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

test.describe('SelectMultipleCheckbox - Basic Rendering', () => {
  test('Default: renders checkbox group with choices', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--default');
    await expect(page.getByText('Select Fruits')).toBeVisible();
    const checkboxes = checkboxInputs(page);
    await expect(checkboxes).toHaveCount(5);
    await expect(page.getByText('Apple')).toBeVisible();
    await expect(page.getByText('Banana')).toBeVisible();
  });

  test('WithSelectedValues: renders with pre-selected values', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--with-selected-values');
    // apple and cherry should be checked
    const appleCheckbox = page.locator('input[type="checkbox"]').nth(0);
    await expect(appleCheckbox).toBeChecked();
    const cherryCheckbox = page.locator('input[type="checkbox"]').nth(2);
    await expect(cherryCheckbox).toBeChecked();
    // banana should not be checked
    const bananaCheckbox = page.locator('input[type="checkbox"]').nth(1);
    await expect(bananaCheckbox).not.toBeChecked();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('SelectMultipleCheckbox - Features', () => {
  test('AllowOther: renders with "Other" button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--allow-other');
    await expect(page.getByRole('button', { name: 'Other' })).toBeVisible();
  });

  test('AllowOtherWithCustomValues: renders with custom values selected', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--allow-other-with-custom-values');
    // apple should be checked, plus custom values shown
    const appleCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(appleCheckbox).toBeChecked();
  });

  test('ManyOptions: renders with "Show more" button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--many-options');
    await expect(page.getByText('Select Options')).toBeVisible();
    // itemsShown=6, so should show 6 initially
    const checkboxes = checkboxInputs(page);
    const count = await checkboxes.count();
    expect(count).toBe(6);
    // "Show more" button should be visible
    await expect(page.getByText(/Show \d+ more/)).toBeVisible();
  });

  test('SmallItemsShown: renders with fewer items shown', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--small-items-shown');
    const checkboxes = checkboxInputs(page);
    const count = await checkboxes.count();
    expect(count).toBe(3);
    await expect(page.getByText(/Show \d+ more/)).toBeVisible();
  });

  test('MixedValueTypes: renders with mixed value types', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--mixed-value-types');
    await expect(page.getByText('Mixed Value Types')).toBeVisible();
    const checkboxes = checkboxInputs(page);
    await expect(checkboxes).toHaveCount(4);
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectMultipleCheckbox - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--required');
    // Component renders label with asterisk appended
    await expect(page.getByText('Select Fruits')).toBeVisible();
    const asterisk = page.locator('span').filter({ hasText: '*' });
    const count = await asterisk.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--with-error');
    await expect(page.getByText('Please select at least one option')).toBeVisible();
  });

  test('Disabled: checkboxes are disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--disabled');
    const checkboxes = checkboxInputs(page);
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeDisabled();
    }
  });

  test('NoChoices: shows error when no choices', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--no-choices');
    await expect(page.getByText('Choices option configured incorrectly')).toBeVisible();
  });

  test('CustomColor: renders with custom color', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--custom-color');
    await expect(page.getByText('Select Fruits')).toBeVisible();
    const checkboxes = checkboxInputs(page);
    // apple and banana should be checked
    await expect(checkboxes.nth(0)).toBeChecked();
    await expect(checkboxes.nth(1)).toBeChecked();
  });
});

// ============================================================================
// Layout
// ============================================================================

test.describe('SelectMultipleCheckbox - Layout', () => {
  test('LongTextOptions: renders with long text options', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--long-text-options');
    await expect(page.getByText('Very Long Option Name That Exceeds Normal Length')).toBeVisible();
  });

  test('WithAllFeatures: renders complete example', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--with-all-features');
    await expect(page.getByText('Complete Example')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Other' })).toBeVisible();
  });
});
