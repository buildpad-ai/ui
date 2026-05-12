/**
 * GroupRaw Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces GroupRaw component in isolation using Storybook.
 * Covers: transparent rendering, inline children, no visual container.
 * 
 * DaaS equivalent: group-raw (no options, pass-through wrapper)
 * 
 * Run: pnpm test:storybook:interfaces
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

test.describe('GroupRaw - Basic Rendering', () => {
  test('Default: renders children inline without visual container', async ({ page }) => {
    await goToStory(page, 'interfaces-groupraw--default');
    // Child fields should be visible
    await expect(page.getByText('First Name')).toBeVisible();
    await expect(page.getByText('Last Name')).toBeVisible();
    await expect(page.getByText('Bio')).toBeVisible();
    // The group-raw container should exist
    const container = page.locator('.group-raw');
    await expect(container).toBeVisible();
  });

  test('Default: all child inputs are interactive', async ({ page }) => {
    await goToStory(page, 'interfaces-groupraw--default');
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    // Should have at least the 3 fields (First Name, Last Name, Bio)
    expect(count).toBeGreaterThanOrEqual(3);
    // First input should be enabled
    await expect(inputs.first()).toBeEnabled();
  });
});

test.describe('GroupRaw - Transparent Wrapper', () => {
  test('TransparentWrapper: fields before, inside, and after group all render inline', async ({ page }) => {
    await goToStory(page, 'interfaces-groupraw--transparent-wrapper');
    // Fields outside the group
    await expect(page.getByText('Field Before Group')).toBeVisible();
    await expect(page.getByText('Field After Group')).toBeVisible();
    // Fields inside the group
    await expect(page.getByText('Grouped Field 1')).toBeVisible();
    await expect(page.getByText('Grouped Field 2')).toBeVisible();
  });

  test('TransparentWrapper: no collapsible behavior exists', async ({ page }) => {
    await goToStory(page, 'interfaces-groupraw--transparent-wrapper');
    // There should be no expand/collapse buttons or chevrons
    const chevrons = page.locator('[data-testid="expand-icon"], [class*="chevron"]');
    await expect(chevrons).toHaveCount(0);
    // No toggle buttons
    const toggleBtns = page.locator('button[aria-expanded]');
    await expect(toggleBtns).toHaveCount(0);
  });
});
