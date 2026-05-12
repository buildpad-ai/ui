/**
 * Upload Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Upload component in isolation using Storybook.
 * Covers: default, single/multiple, source options (device/url/library),
 * file type filters, folder targeting, presets, auto-open library.
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

test.describe('Upload - Basic Rendering', () => {
  test('Default: renders upload interface with all sources', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--default');
    // Upload component should render buttons or dropzone
    await page.waitForTimeout(300);
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('SingleFileUpload: renders single file mode', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--single-file-upload');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('MultipleFileUpload: renders multiple file mode', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--multiple-file-upload');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });
});

test.describe('Upload - Source Options', () => {
  test('DeviceUploadOnly: renders device upload only', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--device-upload-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('URLImportOnly: renders URL import only', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--url-import-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('LibraryOnly: renders library selection only', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--library-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });
});

test.describe('Upload - File Type Filters', () => {
  test('ImagesOnly: renders with image filter', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--images-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('DocumentsOnly: renders with document filter', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--documents-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('VideoFiles: renders with video filter', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--video-files');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });
});

test.describe('Upload - Configuration', () => {
  test('WithTargetFolder: renders with folder target', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--with-target-folder');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('WithPreset: renders with upload preset', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--with-preset');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });
});

test.describe('Upload - Use Cases', () => {
  test('ProfilePicture: renders profile picture config', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--profile-picture');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('AttachmentUpload: renders attachment config', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--attachment-upload');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('MediaGallery: renders media gallery config', async ({ page }) => {
    await goToStory(page, 'interfaces-upload--media-gallery');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });
});
