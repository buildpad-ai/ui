/**
 * Files Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Files component in isolation using Storybook.
 * Covers: default, label, upload/select modes, folder, pagination,
 * disabled, readonly, mock files, image gallery, document manager.
 * 
 * Run: pnpm test:storybook:interfaces
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6008';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

test.describe('Files - Basic Rendering', () => {
  test('Default: renders files interface', async ({ page }) => {
    await goToStory(page, 'interfaces-files--default');
    await expect(page.getByText('Files')).toBeVisible();
  });

  test('WithLabel: renders with label and placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-files--with-label');
    await expect(page.getByText('Attachments')).toBeVisible();
  });
});

test.describe('Files - Source Options', () => {
  test('EnableUploadOnly: renders upload-only mode', async ({ page }) => {
    await goToStory(page, 'interfaces-files--enable-upload-only');
    await expect(page.getByText('Upload Files')).toBeVisible();
  });

  test('EnableSelectOnly: renders select-only mode', async ({ page }) => {
    await goToStory(page, 'interfaces-files--enable-select-only');
    await expect(page.getByText('Select Files')).toBeVisible();
  });

  test('BothEnabled: renders with both upload and select', async ({ page }) => {
    await goToStory(page, 'interfaces-files--both-enabled');
    await expect(page.getByText('Documents')).toBeVisible();
  });
});

test.describe('Files - Configuration', () => {
  test('WithFolder: renders with target folder', async ({ page }) => {
    await goToStory(page, 'interfaces-files--with-folder');
    await expect(page.getByText('Project Files')).toBeVisible();
  });

  test('CustomLimit: renders with custom pagination limit', async ({ page }) => {
    await goToStory(page, 'interfaces-files--custom-limit');
    await expect(page.getByText('Gallery')).toBeVisible();
  });
});

test.describe('Files - States', () => {
  test('Disabled: renders disabled state', async ({ page }) => {
    await goToStory(page, 'interfaces-files--disabled');
    await expect(page.getByText('Disabled', { exact: true }).first()).toBeVisible();
  });

  test('ReadOnly: renders read-only state', async ({ page }) => {
    await goToStory(page, 'interfaces-files--read-only');
    await expect(page.getByText('Read Only', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Files - With Data', () => {
  test('WithMockFiles: renders with pre-populated files', async ({ page }) => {
    await goToStory(page, 'interfaces-files--with-mock-files');
    await expect(page.getByText('Project Documents')).toBeVisible();
    // Should show file names from mock data
    await expect(page.getByText('Project Proposal')).toBeVisible();
  });

  test('ImageGallery: renders image gallery use case', async ({ page }) => {
    await goToStory(page, 'interfaces-files--image-gallery');
    await expect(page.getByText('Product Gallery')).toBeVisible();
  });

  test('DocumentManager: renders document manager use case', async ({ page }) => {
    await goToStory(page, 'interfaces-files--document-manager');
    await expect(page.getByText('Legal Documents')).toBeVisible();
  });
});

// ============================================================================
// Test Suite: Junction Creation Regression
// ============================================================================

test.describe('Files - Junction Creation Regression', () => {
  test('should not include sort field in junction creation POST body', async ({ page }) => {
    await goToStory(page, 'interfaces-files--with-edit-mode-primary-key');

    // Wait for the component to finish loading / permission checks
    await page.waitForTimeout(500);

    // Upload a file via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    // Wait for the upload + junction creation to complete
    // The mock returns instantly, but React needs a tick to process
    await page.waitForTimeout(500);

    // Read the captured junction creation body
    const junctionBody = await page.evaluate(() => {
      return (window as any).__junctionCreateBody;
    });

    expect(junctionBody).toBeDefined();

    // Assert: sort field must NOT be present (the original bug)
    expect(junctionBody).not.toHaveProperty('sort');

    // Assert: required junction keys are present
    expect(junctionBody).toHaveProperty('tasks_id');
    expect(junctionBody).toHaveProperty('daas_files_id');
  });

  test('should include correct junction field values in POST body', async ({ page }) => {
    await goToStory(page, 'interfaces-files--with-edit-mode-primary-key');

    await page.waitForTimeout(500);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    });

    await page.waitForTimeout(500);

    const junctionBody = await page.evaluate(() => {
      return (window as any).__junctionCreateBody;
    });

    expect(junctionBody).toBeDefined();

    // Assert: tasks_id matches the primaryKey prop value
    expect(junctionBody).toHaveProperty('tasks_id', '123');

    // Assert: daas_files_id matches the uploaded file ID
    expect(junctionBody).toHaveProperty('daas_files_id', 'uploaded-file-1');
  });
});
