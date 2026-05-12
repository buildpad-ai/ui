/**
 * Boolean Interface Storybook E2E Tests
 * 
 * Mantine Switch uses a visually hidden input[role="switch"]. We use
 * .mantine-Switch-root for visibility and input[role="switch"] for state checks.
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

/** Get the visible Switch root element */
function switchRoot(page: import('@playwright/test').Page) {
  return page.locator('.mantine-Switch-root');
}

/** Get the hidden switch input for state checks */
function switchInput(page: import('@playwright/test').Page) {
  return page.locator('input[role="switch"]');
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('Boolean - Basic Rendering', () => {
  test('Default: renders unchecked switch with label', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--default');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeChecked();
    await expect(page.getByText('Enable feature', { exact: true })).toBeVisible();
  });

  test('Checked: renders checked switch', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--checked');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).toBeChecked();
  });

  test('WithDescription: renders with description text', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--with-description');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Receive email notifications for important updates')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('Boolean - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--required');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Accept terms *', { exact: true })).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--with-error');
    await expect(page.getByText('You must accept the terms to continue')).toBeVisible();
  });

  test('Disabled: switch is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--disabled');
    await expect(switchInput(page)).toBeDisabled();
  });

  test('ReadOnly: switch is not disabled but non-interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--read-only');
    await expect(switchRoot(page)).toBeVisible();
    // After fix: readOnly should NOT make it disabled
    await expect(switchInput(page)).not.toBeDisabled();
    await expect(switchInput(page)).toBeChecked();
    // Should have aria-readonly
    await expect(switchInput(page)).toHaveAttribute('aria-readonly', 'true');
  });
});

// ============================================================================
// Sizes
// ============================================================================

test.describe('Boolean - Sizes', () => {
  test('Sizes: renders all size variants', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--sizes');
    const switches = switchInput(page);
    await expect(switches).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(switches.nth(i)).toBeChecked();
    }
  });
});

// ============================================================================
// Icons
// ============================================================================

test.describe('Boolean - Icons', () => {
  test('WithIcons: renders with custom on/off icons', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--with-icons');
    await expect(switchRoot(page)).toBeVisible();
    const svgs = page.locator('.mantine-Switch-track svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('WithCheckIcons: renders with check/x icons', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--with-check-icons');
    await expect(switchRoot(page)).toBeVisible();
    const svgs = page.locator('.mantine-Switch-track svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('WithStringIconFromBackend: gracefully ignores string icons', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--with-string-icon-from-backend');
    await expect(switchRoot(page)).toBeVisible();
    const track = page.locator('.mantine-Switch-track');
    const trackText = await track.textContent();
    expect(trackText).not.toContain('check');
    expect(trackText).not.toContain('close');
  });
});

// ============================================================================
// Custom Colors
// ============================================================================

test.describe('Boolean - Custom Colors', () => {
  test('CustomColors: renders with custom color styling', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--custom-colors');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeChecked();
  });
});

// ============================================================================
// Value States
// ============================================================================

test.describe('Boolean - Value States', () => {
  test('ValueStates: renders all value variants correctly', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--value-states');
    const switches = switchInput(page);
    await expect(switches).toHaveCount(4);
    await expect(switches.nth(0)).toBeChecked();
    await expect(switches.nth(1)).not.toBeChecked();
    await expect(switches.nth(2)).not.toBeChecked();
    await expect(switches.nth(3)).not.toBeChecked();
  });
});

// ============================================================================
// Complex Example
// ============================================================================

test.describe('Boolean - Complex Example', () => {
  test('ComplexExample: renders with all features combined', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--complex-example');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Receive promotional emails and product updates')).toBeVisible();
    const svgs = page.locator('.mantine-Switch-track svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Form Context
// ============================================================================

test.describe('Boolean - Form Context', () => {
  test('InFormContext: renders multiple switches in form layout', async ({ page }) => {
    await goToStory(page, 'interfaces-boolean--in-form-context');
    const switches = switchInput(page);
    await expect(switches).toHaveCount(4);
    await expect(page.getByText('Account Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('This setting is required for the service to function')).toBeVisible();
  });
});
