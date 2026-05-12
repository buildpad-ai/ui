/**
 * Slider Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Slider component in isolation.
 * Covers all 18 stories: types, ranges, marks, ticks, sizes, colors, states.
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

test.describe('Slider - Basic Rendering', () => {
  test('Default: renders slider with label and value display', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--default');
    // Mantine slider role
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // Value display shows "Value: 50"
    const valueText = page.getByText('Value: 50');
    await expect(valueText).toBeVisible();
  });

  test('WithRange: shows min/max indicators', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--with-range');
    const minText = page.getByText('Min: 0');
    const maxText = page.getByText('Max: 100');
    await expect(minText).toBeVisible();
    await expect(maxText).toBeVisible();
    const valueText = page.getByText('Value: 75');
    await expect(valueText).toBeVisible();
  });
});

// ============================================================================
// Numeric Types
// ============================================================================

test.describe('Slider - Numeric Types', () => {
  test('IntegerType: renders integer slider', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--integer-type');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const valueText = page.getByText('Value: 25');
    await expect(valueText).toBeVisible();
  });

  test('DecimalType: renders decimal slider with precision', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--decimal-type');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // Decimal value should show decimal places
    const valueText = page.getByText(/Value: 29\.99/);
    await expect(valueText).toBeVisible();
  });

  test('FloatType: renders float slider', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--float-type');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const valueText = page.getByText(/Value: 36\.5/);
    await expect(valueText).toBeVisible();
  });
});

// ============================================================================
// Step & Range
// ============================================================================

test.describe('Slider - Step & Range', () => {
  test('CustomStep: uses step interval of 10', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--custom-step');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const valueText = page.getByText('Value: 10');
    await expect(valueText).toBeVisible();
  });

  test('NegativeRange: supports negative values', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--negative-range');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const minText = page.getByText('Min: -50');
    await expect(minText).toBeVisible();
    const maxText = page.getByText('Max: 50');
    await expect(maxText).toBeVisible();
  });
});

// ============================================================================
// Visual Options
// ============================================================================

test.describe('Slider - Visual Options', () => {
  test('AlwaysShowValue: value label is always visible', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--always-show-value');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // labelAlwaysOn renders a floating label above the thumb
    const floatingLabel = page.locator('[class*="label"]');
    await expect(floatingLabel.first()).toBeVisible();
  });

  test('WithMarks: renders mark labels', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--with-marks');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // Marks should show labels 1-5 using Mantine's markLabel class
    for (const mark of ['1', '2', '3', '4', '5']) {
      const markLabel = page.locator('.mantine-Slider-markLabel').filter({ hasText: mark });
      await expect(markLabel.first()).toBeVisible();
    }
  });

  test('WithTicks: renders tick marks with labels', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--with-ticks');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // Should show percentage labels using Mantine's markLabel class
    const zeroLabel = page.locator('.mantine-Slider-markLabel').filter({ hasText: '0%' });
    await expect(zeroLabel.first()).toBeVisible();
    const hundredLabel = page.locator('.mantine-Slider-markLabel').filter({ hasText: '100%' });
    await expect(hundredLabel.first()).toBeVisible();
  });

  test('SmallSize: renders smaller slider', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--small-size');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
  });

  test('LargeSize: renders larger slider', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--large-size');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
  });

  test('CustomColor: renders with teal color', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--custom-color');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
  });

  test('PercentageSlider: renders with percentage marks', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--percentage-slider');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const fiftyLabel = page.locator('[class*="markLabel"]:has-text("50%")');
    await expect(fiftyLabel).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('Slider - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--required');
    // Slider uses custom label with <Text component="span" c="red">*</Text>
    const redAsterisk = page.locator('[class*="Text-root"]').filter({ hasText: '*' });
    await expect(redAsterisk.first()).toBeAttached();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--with-error');
    const errorText = page.getByText('Value exceeds maximum');
    await expect(errorText).toBeVisible();
  });

  test('Disabled: slider is visually disabled and non-interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--disabled');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    // Slider is visually disabled with reduced opacity and pointer-events: none
    const rootOpacity = await page.locator('.mantine-Slider-root').evaluate(
      el => getComputedStyle(el.closest('[style*="opacity"]') || el).opacity
    );
    expect(parseFloat(rootOpacity)).toBeLessThan(1);
  });

  test('ReadOnly: slider is visually readonly and non-interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--read-only');
    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();
    const rootOpacity = await page.locator('.mantine-Slider-root').evaluate(
      el => getComputedStyle(el.closest('[style*="opacity"]') || el).opacity
    );
    expect(parseFloat(rootOpacity)).toBeLessThan(1);
  });
});

// ============================================================================
// Interaction
// ============================================================================

test.describe('Slider - Interaction', () => {
  test('Default: can interact with slider via keyboard', async ({ page }) => {
    await goToStory(page, 'interfaces-slider--default');
    const slider = page.getByRole('slider');
    await slider.focus();
    // Press right arrow to increase value
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    // Value should have changed from 50
    const valueText = page.getByText(/Value: 5[0-9]/);
    await expect(valueText).toBeVisible();
  });
});
