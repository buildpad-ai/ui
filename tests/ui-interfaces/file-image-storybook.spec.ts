/**
 * FileImage Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces FileImage component in isolation using Storybook.
 * Covers: default, label, upload/select modes, crop/contain, letterbox,
 * width modes, disabled, readonly, mock image, product/avatar use cases.
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

test.describe('FileImage - Basic Rendering', () => {
  test('Default: renders image picker', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--default');
    // "Image" label appears but getByText('Image') matches multiple elements
    // (label + "Accepts: image/*" text). Use exact match on the label.
    await expect(page.getByText('Image', { exact: true }).first()).toBeVisible();
  });

  test('WithLabel: renders with label and placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--with-label');
    await expect(page.getByText('Profile Picture')).toBeVisible();
  });
});

test.describe('FileImage - Source Options', () => {
  test('EnableUploadOnly: renders upload-only mode', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--enable-upload-only');
    await expect(page.getByText('Upload Image')).toBeVisible();
  });

  test('EnableSelectOnly: renders select-only mode', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--enable-select-only');
    await expect(page.getByText('Select Image')).toBeVisible();
  });

  test('BothEnabled: renders with both upload and select', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--both-enabled');
    await expect(page.getByText('Image', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Upload or select from library')).toBeVisible();
  });
});

test.describe('FileImage - Display Modes', () => {
  test('CropMode: renders with crop (cover) display', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--crop-mode');
    await expect(page.getByText('Cover Image')).toBeVisible();
  });

  test('ContainMode: renders with contain display', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--contain-mode');
    await expect(page.getByText('Logo')).toBeVisible();
  });

  test('Letterbox: renders with letterbox padding', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--letterbox');
    await expect(page.getByText('Thumbnail')).toBeVisible();
  });

  test('FullWidth: renders full width', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--full-width');
    await expect(page.getByText('Banner')).toBeVisible();
  });

  test('HalfWidth: renders half width', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--half-width');
    await expect(page.getByText('Side Image')).toBeVisible();
  });
});

test.describe('FileImage - States', () => {
  test('Disabled: renders disabled state', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--disabled');
    await expect(page.getByText('Disabled Image')).toBeVisible();
  });

  test('ReadOnly: renders read-only state', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--read-only');
    await expect(page.getByText('Read Only', { exact: true }).first()).toBeVisible();
  });

  test('WithMockImage: renders with mock file object', async ({ page }) => {
    // This story triggers a network fetch for the mock image that never completes,
    // so we use domcontentloaded (already in goToStory) and verify the label renders.
    await goToStory(page, 'interfaces-fileimage--with-mock-image');
    await expect(page.getByText('Profile Picture')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('FileImage - Use Cases', () => {
  test('ProductImage: renders product image picker', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--product-image');
    // "Product Image" matches both label and placeholder "Add product image" (substring).
    // Use the test ID for the label element.
    await expect(page.getByTestId('file-image-label')).toBeVisible();
    await expect(page.getByTestId('file-image-label')).toHaveText('Product Image');
  });

  test('AvatarUpload: renders avatar upload', async ({ page }) => {
    await goToStory(page, 'interfaces-fileimage--avatar-upload');
    await expect(page.getByText('Avatar', { exact: true }).first()).toBeVisible();
  });
});
