/**
 * GroupDetail Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces GroupDetail component in isolation using Storybook.
 * Covers: collapsible sections, open/closed states, icon, badge, custom color,
 * validation errors, disabled, loading, RTL, form sections, multiple groups.
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

test.describe('GroupDetail - Basic Rendering', () => {
  test('Default: renders group with title', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--default');
    await expect(page.getByText('Details')).toBeVisible();
  });

  test('StartOpen: renders expanded with form fields', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--start-open');
    await expect(page.getByText('Personal Information')).toBeVisible();
    // Content should be visible when open
    const firstNameInput = page.getByText('First Name');
    await expect(firstNameInput).toBeVisible();
  });

  test('StartClosed: renders collapsed', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--start-closed');
    await expect(page.getByText('Advanced Settings')).toBeVisible();
  });
});

test.describe('GroupDetail - Features', () => {
  test('WithIcon: renders with header icon', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--with-icon');
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
  });

  test('WithBadge: renders with badge text', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--with-badge');
    await expect(page.getByText('Optional Fields')).toBeVisible();
    await expect(page.getByText('Optional', { exact: true })).toBeVisible();
  });

  test('CustomColor: renders with custom header color', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--custom-color');
    await expect(page.getByText('Important Section')).toBeVisible();
  });
});

test.describe('GroupDetail - States', () => {
  test('WithValidationErrors: shows validation errors', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--with-validation-errors');
    await expect(page.getByText('User Details')).toBeVisible();
    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  test('Disabled: renders disabled group', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--disabled');
    await expect(page.getByText('Locked Section')).toBeVisible();
  });

  test('Loading: renders loading state', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--loading');
    await expect(page.getByText('Loading Section')).toBeVisible();
  });

  test('RTLDirection: renders RTL layout', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--rtl-direction');
    await expect(page.getByText('قسم التفاصيل')).toBeVisible();
  });
});

test.describe('GroupDetail - Complex', () => {
  test('FormSection: renders form section with fields', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--form-section');
    await expect(page.getByText('Contact Information')).toBeVisible();
    await expect(page.getByText('Full Name')).toBeVisible();
  });

  test('MultipleGroups: renders multiple collapsible groups', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--multiple-groups');
    await expect(page.getByText('Basic Info')).toBeVisible();
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('Advanced')).toBeVisible();
  });
});
