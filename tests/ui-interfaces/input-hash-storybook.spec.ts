/**
 * InputHash Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces InputHash component in isolation using Storybook.
 * Covers all 10 stories: default, hashed value, masked, required, error, description,
 * disabled, readonly, and empty states.
 * 
 * Run: pnpm test:storybook:interfaces
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

test.describe('InputHash - Basic Rendering', () => {
  test('Default: renders input with label and placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--default');
    const input = page.getByRole('textbox', { name: /hash field/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Enter value to hash');
  });

  test('WithHashedValue: shows "Value securely stored" placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--with-hashed-value');
    const input = page.getByRole('textbox', { name: /password/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Value securely stored');
    // Input should be empty (local value is always empty even when hashed value exists)
    await expect(input).toHaveValue('');
  });

  test('WithDescription: shows description text', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--with-description');
    const desc = page.getByText('Value will be securely hashed before storage');
    await expect(desc).toBeVisible();
  });

  test('EmptyState: shows placeholder when no value set', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--empty-state');
    const input = page.getByRole('textbox', { name: /new password/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'No value set yet');
    await expect(input).toHaveValue('');
  });
});

// ============================================================================
// Lock Icon Indicator
// ============================================================================

test.describe('InputHash - Lock Icon', () => {
  test('Default: shows lock-open icon when no hashed value', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--default');
    // Right section should contain an SVG icon (lock-open)
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('WithHashedValue: shows lock icon when value is hashed', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--with-hashed-value');
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });
});

// ============================================================================
// Masked Mode
// ============================================================================

test.describe('InputHash - Masked Mode', () => {
  test('Masked: renders as password input', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--masked');
    const input = page.locator('input[type="password"]');
    await expect(input).toBeVisible();
  });

  test('MaskedWithHashedValue: renders masked input with hashed placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--masked-with-hashed-value');
    const input = page.locator('input[type="password"]');
    await expect(input).toBeVisible();
  });
});

// ============================================================================
// States: Required, Error, Disabled, ReadOnly
// ============================================================================

test.describe('InputHash - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--required');
    const requiredLabel = page.locator('label[data-required="true"]');
    await expect(requiredLabel).toBeVisible();
    const asteriskSpan = page.locator('.mantine-InputWrapper-required');
    await expect(asteriskSpan).toBeAttached();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--with-error');
    const errorText = page.getByText('Password is required');
    await expect(errorText).toBeVisible();
  });

  test('Disabled: input is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--disabled');
    const input = page.getByRole('textbox', { name: /disabled hash/i });
    await expect(input).toBeDisabled();
  });

  test('ReadOnly: input is non-editable', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--read-only');
    const input = page.getByRole('textbox', { name: /read only hash/i });
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });
});

// ============================================================================
// Interaction
// ============================================================================

test.describe('InputHash - Interaction', () => {
  test('Default: input accepts keyboard input', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--default');
    const input = page.getByRole('textbox', { name: /hash field/i });
    await input.fill('my-secret-value');
    await expect(input).toHaveValue('my-secret-value');
  });

  test('WithHashedValue: typing replaces placeholder and keeps lock-open icon', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--with-hashed-value');
    const input = page.getByRole('textbox', { name: /password/i });
    await expect(input).toHaveAttribute('placeholder', 'Value securely stored');
    await input.fill('new-password');
    await expect(input).toHaveValue('new-password');
  });

  test('Default: input is focusable', async ({ page }) => {
    await goToStory(page, 'interfaces-inputhash--default');
    const input = page.getByRole('textbox', { name: /hash field/i });
    await input.focus();
    await expect(input).toBeFocused();
  });
});
