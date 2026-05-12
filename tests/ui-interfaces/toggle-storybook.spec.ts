/**
 * Toggle Interface Storybook E2E Tests
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

function switchRoot(page: import('@playwright/test').Page) {
  return page.locator('.mantine-Switch-root');
}

function switchInput(page: import('@playwright/test').Page) {
  return page.locator('input[role="switch"]');
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('Toggle - Basic Rendering', () => {
  test('Default: renders unchecked toggle with label', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--default');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeChecked();
    await expect(page.getByText('Enable feature', { exact: true })).toBeVisible();
  });

  test('Checked: renders checked toggle', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--checked');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).toBeChecked();
  });

  test('WithDescription: renders with description text', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--with-description');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Receive email notifications for important updates')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('Toggle - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--required');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Accept terms *', { exact: true })).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--with-error');
    await expect(page.getByText('You must accept the terms to continue')).toBeVisible();
  });

  test('Disabled: toggle is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--disabled');
    await expect(switchInput(page)).toBeDisabled();
    await expect(switchInput(page)).not.toBeChecked();
  });

  test('DisabledChecked: disabled toggle retains checked state', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--disabled-checked');
    await expect(switchInput(page)).toBeDisabled();
    await expect(switchInput(page)).toBeChecked();
  });

  test('ReadOnly: toggle is not disabled but non-interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--read-only');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeDisabled();
    await expect(switchInput(page)).toBeChecked();
    await expect(switchInput(page)).toHaveAttribute('aria-readonly', 'true');
  });
});

// ============================================================================
// Sizes
// ============================================================================

test.describe('Toggle - Sizes', () => {
  test('Sizes: renders all size variants', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--sizes');
    const toggles = switchInput(page);
    await expect(toggles).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(toggles.nth(i)).toBeChecked();
    }
  });
});


// ============================================================================
// State Labels
// ============================================================================

test.describe('Toggle - State Labels', () => {
  test('WithStateLabels: renders with off/on state labels', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--with-state-labels');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
  });

  test('StateLabelsEnabled: renders enabled state with labels', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--state-labels-enabled');
    await expect(switchInput(page)).toBeChecked();
    await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// Icon Variants
// ============================================================================

test.describe('Toggle - Icon Variants', () => {
  test('DarkModeToggle: renders with sun/moon icons', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--dark-mode-toggle');
    await expect(switchRoot(page)).toBeVisible();
    const svgs = page.locator('.mantine-Switch-track svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('NotificationToggle: renders with bell icons and custom color', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--notification-toggle');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).toBeChecked();
  });

  test('SecurityToggle: renders with lock icons and custom colors', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--security-toggle');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeChecked();
  });

  test('WithStringIconFromBackend: gracefully ignores string icons', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--with-string-icon-from-backend');
    await expect(switchRoot(page)).toBeVisible();
    const track = page.locator('.mantine-Switch-track');
    const trackText = await track.textContent();
    expect(trackText).not.toContain('sun');
    expect(trackText).not.toContain('moon');
    await expect(page.getByText('On', { exact: true })).toBeVisible();
    await expect(page.getByText('Off', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// Custom Colors
// ============================================================================

test.describe('Toggle - Custom Colors', () => {
  test('CustomColors: renders with custom color styling', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--custom-colors');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).not.toBeChecked();
  });

  test('GreenRedToggle: renders with green/red colors', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--green-red-toggle');
    await expect(switchRoot(page)).toBeVisible();
    await expect(switchInput(page)).toBeChecked();
  });
});

// ============================================================================
// Value States
// ============================================================================

test.describe('Toggle - Value States', () => {
  test('ValueStates: renders all value variants correctly', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--value-states');
    const toggles = switchInput(page);
    await expect(toggles).toHaveCount(4);
    await expect(toggles.nth(0)).toBeChecked();
    await expect(toggles.nth(1)).not.toBeChecked();
    await expect(toggles.nth(2)).not.toBeChecked();
    await expect(toggles.nth(3)).not.toBeChecked();
  });
});

// ============================================================================
// Complex Example
// ============================================================================

test.describe('Toggle - Complex Example', () => {
  test('CompleteExample: renders with all features combined', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--complete-example');
    await expect(switchRoot(page)).toBeVisible();
    await expect(page.getByText('Enable premium features for your account').first()).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// Comparison & Form Context
// ============================================================================

test.describe('Toggle - Comparison & Form Context', () => {
  test('ComparisonWithBoolean: renders comparison layout', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--comparison-with-boolean');
    await expect(page.getByText('Toggle vs Boolean', { exact: true })).toBeVisible();
    const toggles = switchInput(page);
    await expect(toggles).toHaveCount(4);
  });

  test('InFormContext: renders multiple toggles in form layout', async ({ page }) => {
    await goToStory(page, 'interfaces-toggle--in-form-context');
    await expect(page.getByText('System Settings', { exact: true })).toBeVisible();
    const toggles = switchInput(page);
    await expect(toggles).toHaveCount(5);
    await expect(page.getByText('Warning: This will take the site offline')).toBeVisible();
  });
});
