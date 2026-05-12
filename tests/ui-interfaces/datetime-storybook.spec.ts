/**
 * DateTime Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces DateTime component in isolation using Storybook.
 * Mantine DateTimePicker renders as a button[data-dates-input], not a textbox.
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

/** Mantine DateTimePicker renders as a button with data-dates-input attribute */
function dateInput(page: import('@playwright/test').Page) {
  return page.locator('button[data-dates-input]');
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('DateTime - Basic Rendering', () => {
  test('Default: renders datetime picker with label and placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--default');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    // Placeholder is rendered as a span inside the button
    const placeholder = page.locator('.mantine-DateTimePicker-placeholder');
    await expect(placeholder).toHaveText('Pick date and time');
    const label = page.getByText('Select date and time', { exact: true });
    await expect(label).toBeVisible();
  });

  test('WithValue: renders with pre-selected datetime value', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--with-value');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    // Value "2024-12-25T10:30:00" formatted as "25 Dec 2024 HH:mm"
    const text = await input.textContent();
    expect(text).toContain('25');
    expect(text).toContain('Dec');
    expect(text).toContain('2024');
    const desc = page.getByText('A datetime with a pre-selected value');
    await expect(desc).toBeVisible();
  });
});

// ============================================================================
// Type Variants
// ============================================================================

test.describe('DateTime - Type Variants', () => {
  test('DateOnly: renders date-only picker without time', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--date-only');
    // DatePickerInput also uses data-dates-input
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const placeholder = input.locator('span').first();
    await expect(placeholder).toContainText('Pick a date');
  });

  test('TimeOnly: renders time-only picker', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--time-only');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const placeholder = input.locator('span').first();
    await expect(placeholder).toContainText('Pick a time');
  });

  test('Timestamp: renders timestamp with value', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--timestamp');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    expect(text).toBeTruthy();
    expect(text).toContain('2024');
    const desc = page.getByText('Timestamp format with timezone');
    await expect(desc).toBeVisible();
  });
});


// ============================================================================
// Time Format Options
// ============================================================================

test.describe('DateTime - Time Format Options', () => {
  test('WithSeconds: displays seconds in the format', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--with-seconds');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    // includeSeconds=true → format includes seconds (HH:mm:ss)
    expect(text).toBeTruthy();
    expect(text!).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test('TwelveHourFormat: displays AM/PM format', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--twelve-hour-format');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    // use24=false → should show AM or PM
    expect(text!).toMatch(/AM|PM/i);
  });

  test('TwentyFourHourFormat: displays 24-hour format', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--twenty-four-hour-format');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    // use24=true, value "2024-12-25T14:30:00" → should show 14:30
    expect(text!).toContain('14:30');
    expect(text!).not.toMatch(/AM|PM/i);
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('DateTime - States', () => {
  test('Required: shows required indicator (asterisk in label)', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--required');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    // Component appends " *" to label text for required
    const label = page.getByText('Required field *', { exact: true });
    await expect(label).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--with-error');
    const errorText = page.getByText('Please select a valid date');
    await expect(errorText).toBeVisible();
  });

  test('Disabled: input is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--disabled');
    const input = dateInput(page);
    await expect(input).toBeDisabled();
    // Should still show the value
    const text = await input.textContent();
    expect(text).toBeTruthy();
  });

  test('ReadOnly: input is not disabled but non-interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--read-only');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    // After fix: readOnly should NOT make it disabled
    await expect(input).not.toBeDisabled();
    // Should have a value displayed
    const text = await input.textContent();
    expect(text).toBeTruthy();
    expect(text!).toContain('2024');
  });
});

// ============================================================================
// Configuration Options
// ============================================================================

test.describe('DateTime - Configuration Options', () => {
  test('WithDateRange: renders date picker with description', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--with-date-range');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const desc = page.getByText('Select a date in 2024');
    await expect(desc).toBeVisible();
  });

  test('NotClearable: renders with value and no clear button', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--not-clearable');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    expect(text).toBeTruthy();
    // clearable=false — the CloseButton should not be present in the input wrapper
    const closeBtn = page.locator('.mantine-DateTimePicker-wrapper button[aria-label="Clear"], .mantine-DatePickerInput-wrapper button[aria-label="Clear"]');
    await expect(closeBtn).toHaveCount(0);
  });

  test('CustomFormat: displays date in custom format', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--custom-format');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    // valueFormat="DD MMMM YYYY", value="2024-12-25" → "25 December 2024"
    expect(text!).toContain('December');
    expect(text!).toContain('2024');
  });

  test('AllOptions: renders with all features combined', async ({ page }) => {
    await goToStory(page, 'interfaces-datetime--all-options');
    const input = dateInput(page);
    await expect(input).toBeVisible();
    const text = await input.textContent();
    // includeSeconds=true → format includes seconds
    expect(text!).toMatch(/\d{2}:\d{2}:\d{2}/);
    // required=true → label should have asterisk
    const label = page.getByText('Full options example *', { exact: true });
    await expect(label).toBeVisible();
  });
});
