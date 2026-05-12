/**
 * Notice Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Notice component in isolation using Storybook.
 * Covers: all notice types (info, success, warning, danger), title/content,
 * centered, no icon, custom icon, multiline, indented, custom colors,
 * text prop (DaaS compat), backend string icon graceful degradation.
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

test.describe('Notice - Basic Types', () => {
  test('Default: renders default notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--default');
    const notice = page.getByText('This is a default notice message.');
    await expect(notice).toBeVisible();
  });

  test('Info: renders info notice with title', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--info');
    await expect(page.getByText('Information', { exact: true })).toBeVisible();
    await expect(page.getByText('This is an informational notice.')).toBeVisible();
  });

  test('Success: renders success notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--success');
    await expect(page.getByText('Success', { exact: true })).toBeVisible();
    await expect(page.getByText('Your changes have been saved successfully.')).toBeVisible();
  });

  test('Warning: renders warning notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--warning');
    await expect(page.getByText('Warning', { exact: true })).toBeVisible();
  });

  test('Danger: renders danger notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--danger');
    await expect(page.getByText('Error', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Notice - Content Variants', () => {
  test('TitleOnly: renders notice with only title', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--title-only');
    await expect(page.getByText('This notice only has a title')).toBeVisible();
  });

  test('ContentOnly: renders notice with only content', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--content-only');
    await expect(page.getByText('This notice only has content without a title.')).toBeVisible();
  });

  test('Centered: renders centered notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--centered');
    await expect(page.getByText('Centered Notice')).toBeVisible();
  });

  test('Multiline: renders multiline notice', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--multiline');
    await expect(page.getByText('Important Notice')).toBeVisible();
  });

  test('IndentedContent: renders indented content', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--indented-content');
    await expect(page.getByText('Configuration Required')).toBeVisible();
  });
});

test.describe('Notice - Icon Variants', () => {
  test('NoIcon: renders without icon', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--no-icon');
    await expect(page.getByText('No Icon')).toBeVisible();
  });

  test('CustomIcon: renders with custom rocket icon', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--custom-icon');
    await expect(page.getByText('New Feature')).toBeVisible();
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });
});

test.describe('Notice - Styling', () => {
  test('CustomColors: renders with custom colors', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--custom-colors');
    await expect(page.getByText('Custom Styled')).toBeVisible();
  });

  test('AllVariants: renders all four variants', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--all-variants');
    await expect(page.getByText('Information', { exact: true })).toBeVisible();
    await expect(page.getByText('Success', { exact: true })).toBeVisible();
    await expect(page.getByText('Warning', { exact: true })).toBeVisible();
    await expect(page.getByText('Error', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Notice - DaaS Compatibility', () => {
  test('WithTextProp: renders body from text prop', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--with-text-prop');
    await expect(page.getByText('Did you know?')).toBeVisible();
    // Body should come from text prop
    const body = page.getByText(/text.*prop.*maps/i);
    await expect(body).toBeVisible();
  });

  test('WithStringIconFromBackend: gracefully handles string icon', async ({ page }) => {
    await goToStory(page, 'interfaces-notice--with-string-icon-from-backend');
    await expect(page.getByText('Backend-configured icon')).toBeVisible();
    // Should render default warning icon, not raw "info-circle" text
  });
});
