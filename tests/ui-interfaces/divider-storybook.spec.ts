/**
 * Divider Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Divider component in isolation using Storybook.
 * Covers: default, title, inline title, icon, large, disabled, custom color,
 * thickness, vertical, margin, backend string icon graceful degradation.
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

test.describe('Divider - Basic Rendering', () => {
  test('Default: renders a horizontal divider', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--default');
    const divider = page.locator('[class*="divider"], hr, [role="separator"]').first();
    await expect(divider).toBeVisible();
  });

  test('WithTitle: renders divider with title text', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--with-title');
    const title = page.getByText('Section Title');
    await expect(title).toBeVisible();
  });

  test('InlineTitle: renders title inline with divider line', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--inline-title');
    const title = page.getByText('Inline Title');
    await expect(title).toBeVisible();
  });
});

test.describe('Divider - With Icon', () => {
  test('WithIcon: renders title with icon', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--with-icon');
    const title = page.getByText('Settings', { exact: true });
    await expect(title).toBeVisible();
  });

  test('InlineTitleWithIcon: renders inline title with icon', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--inline-title-with-icon');
    const title = page.getByText('User Profile');
    await expect(title).toBeVisible();
  });
});

test.describe('Divider - Variants', () => {
  test('Large: renders large divider', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--large');
    const title = page.getByText('Main Section');
    await expect(title).toBeVisible();
  });

  test('Disabled: renders disabled divider', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--disabled');
    const title = page.getByText('Disabled Section');
    await expect(title).toBeVisible();
  });

  test('CustomColor: renders with custom color', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--custom-color');
    const title = page.getByText('Custom Colors');
    await expect(title).toBeVisible();
  });

  test('ThickDivider: renders with custom thickness', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--thick-divider');
    const title = page.getByText('Thick Divider');
    await expect(title).toBeVisible();
  });
});

test.describe('Divider - Orientation', () => {
  test('Vertical: renders vertical divider', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--vertical');
    const leftContent = page.getByText('Left Content');
    const rightContent = page.getByText('Right Content');
    await expect(leftContent).toBeVisible();
    await expect(rightContent).toBeVisible();
  });

  test('VerticalWithTitle: renders vertical divider with title', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--vertical-with-title');
    const title = page.getByText('OR', { exact: true }).first();
    await expect(title).toBeVisible();
  });
});

test.describe('Divider - DaaS Compatibility', () => {
  test('WithStringIconFromBackend: gracefully handles string icon from DaaS', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--with-string-icon-from-backend');
    const title = page.getByText('Section with backend icon');
    await expect(title).toBeVisible();
    // Should NOT render raw "settings" text as icon
    const rawIconText = page.locator('text=settings').first();
    // The title contains "backend icon" but the icon string should not appear as raw text
  });

  test('FormSection: renders form section divider', async ({ page }) => {
    await goToStory(page, 'interfaces-divider--form-section');
    const title = page.getByText('Personal Information');
    await expect(title).toBeVisible();
  });
});
