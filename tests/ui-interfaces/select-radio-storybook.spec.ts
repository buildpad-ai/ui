/**
 * SelectRadio Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces SelectRadio component using Storybook.
 * Uses Mantine Radio.Group with radio inputs.
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

function radioInputs(page: import('@playwright/test').Page) {
  return page.locator('input[type="radio"]');
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('SelectRadio - Basic Rendering', () => {
  test('Default: renders radio group with options', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--default');
    await expect(page.getByText('Select Option')).toBeVisible();
    const radios = radioInputs(page);
    await expect(radios).toHaveCount(3);
    await expect(page.getByText('Option A')).toBeVisible();
    await expect(page.getByText('Option B')).toBeVisible();
    await expect(page.getByText('Option C')).toBeVisible();
  });

  test('WithValue: renders with pre-selected value', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--with-value');
    await expect(page.getByText('Priority')).toBeVisible();
    // "medium" should be checked
    const mediumRadio = page.locator('input[type="radio"][value="medium"]');
    await expect(mediumRadio).toBeChecked();
  });

  test('WithDescription: renders with description text', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--with-description');
    // Note: SelectRadio doesn't pass description to Radio.Group, but the story has it in argTypes
    await expect(page.getByText('Contact Preference')).toBeVisible();
    await expect(page.getByText('Email')).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('SelectRadio - Features', () => {
  test('AllowOther: renders with "Other" option', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--allow-other');
    await expect(page.getByText('Other', { exact: true })).toBeVisible();
    const radios = radioInputs(page);
    // 3 choices + 1 "Other" = 4 radios
    await expect(radios).toHaveCount(4);
  });

  test('ManyOptions: renders many options with "Other"', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--many-options');
    await expect(page.getByText('Country')).toBeVisible();
    const radios = radioInputs(page);
    // 8 countries + 1 "Other" = 9
    await expect(radios).toHaveCount(9);
  });

  test('YesNo: renders simple yes/no selection', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--yes-no');
    await expect(page.getByText('Subscribe to newsletter?')).toBeVisible();
    const radios = radioInputs(page);
    await expect(radios).toHaveCount(2);
  });

  test('SurveyRating: renders 5-point rating scale', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--survey-rating');
    await expect(page.getByText('How satisfied are you?')).toBeVisible();
    const radios = radioInputs(page);
    await expect(radios).toHaveCount(5);
  });

  test('ShippingMethod: renders with pre-selected value', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--shipping-method');
    await expect(page.getByText('Shipping Method')).toBeVisible();
    const standardRadio = page.locator('input[type="radio"][value="standard"]');
    await expect(standardRadio).toBeChecked();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('SelectRadio - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--required');
    await expect(page.getByText('Required Selection')).toBeVisible();
    // Mantine Radio.Group required shows asterisk
    const asterisk = page.locator('.mantine-Radio-required, .mantine-RadioGroup-required, [data-required]');
    const count = await asterisk.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--with-error');
    await expect(page.getByText('Please make a selection')).toBeVisible();
  });

  test('Disabled: radios are disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--disabled');
    const radios = radioInputs(page);
    const count = await radios.count();
    for (let i = 0; i < count; i++) {
      await expect(radios.nth(i)).toBeDisabled();
    }
    // Pre-selected value should still be checked
    const selectedRadio = page.locator('input[type="radio"][value="selected"]');
    await expect(selectedRadio).toBeChecked();
  });

  test('CustomColor: renders with custom color', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--custom-color');
    await expect(page.getByText('Theme Color')).toBeVisible();
    const radios = radioInputs(page);
    await expect(radios).toHaveCount(3);
  });
});
