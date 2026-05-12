/**
 * Color Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Color component using Storybook.
 * Color picker with hex input, presets, opacity, and format support.
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

test.describe('Color - Basic Rendering', () => {
  test('Default: renders color picker with label', async ({ page }) => {
    await goToStory(page, 'interfaces-color--default');
    await expect(page.getByText('Color')).toBeVisible();
    // Should have an input for hex value
    const input = page.locator('input').first();
    await expect(input).toBeVisible();
  });

  test('WithValue: renders with pre-selected color', async ({ page }) => {
    await goToStory(page, 'interfaces-color--with-value');
    await expect(page.getByText('Primary Color')).toBeVisible();
    await expect(page.getByText('Choose your primary brand color')).toBeVisible();
  });

  test('WithOpacity: renders with opacity support', async ({ page }) => {
    await goToStory(page, 'interfaces-color--with-opacity');
    await expect(page.getByText('Background Color')).toBeVisible();
    await expect(page.getByText('Select a color with transparency')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('Color - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-color--required');
    await expect(page.getByText('Theme Color')).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-color--with-error');
    await expect(page.getByText('Please enter a valid hex color format')).toBeVisible();
  });

  test('Disabled: color picker is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-color--disabled');
    await expect(page.getByText('This color picker is disabled')).toBeVisible();
    // The native color input (type="color") is the one that gets disabled attribute
    const disabledInput = page.locator('input[disabled]').first();
    await expect(disabledInput).toBeDisabled();
  });
});

// ============================================================================
// Presets
// ============================================================================

test.describe('Color - Presets', () => {
  test('CustomPresets: renders with custom preset swatches', async ({ page }) => {
    await goToStory(page, 'interfaces-color--custom-presets');
    await expect(page.getByText('Brand Color', { exact: true })).toBeVisible();
    await expect(page.getByText('Choose from brand colors or pick a custom one')).toBeVisible();
  });

  test('WithoutPresets: renders without presets', async ({ page }) => {
    await goToStory(page, 'interfaces-color--without-presets');
    await expect(page.getByText('Custom Color')).toBeVisible();
  });
});

// ============================================================================
// Advanced
// ============================================================================

test.describe('Color - Advanced', () => {
  test('AllFormats: renders with all format support', async ({ page }) => {
    await goToStory(page, 'interfaces-color--all-formats');
    await expect(page.getByText('Color with All Formats')).toBeVisible();
  });

  test('InteractiveDemo: renders interactive demo', async ({ page }) => {
    await goToStory(page, 'interfaces-color--interactive-demo');
    await expect(page.getByText('Interactive Color Demo')).toBeVisible();
  });

  test('FormIntegration: renders form integration example', async ({ page }) => {
    await goToStory(page, 'interfaces-color--form-integration');
    await expect(page.getByText('Website Theme Color')).toBeVisible();
  });

  test('AccessibilityDemo: renders accessibility demo', async ({ page }) => {
    await goToStory(page, 'interfaces-color--accessibility-demo');
    await expect(page.getByText('Accessible Color Picker')).toBeVisible();
  });
});
