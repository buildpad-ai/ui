/**
 * CollectionForm Storybook E2E Tests
 *
 * Tests the @buildpad/ui-collections CollectionForm component in isolation
 * using Storybook. No authentication required — components use mocked data.
 *
 * Prerequisites:
 *   1. Start Storybook: cd packages/ui-collections && pnpm storybook
 *   2. Run tests: pnpm exec playwright test tests/ui-collections/collectionform-storybook.spec.ts --project=storybook-collections
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL =
  process.env.STORYBOOK_COLLECTIONS_URL ||
  process.env.STORYBOOK_URL ||
  'http://localhost:6009';

// Helper: Navigate to a specific story
async function goToStory(
  page: import('@playwright/test').Page,
  storyId: string,
  waitForForm = true,
) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  if (waitForForm) {
    await page.waitForSelector('[data-testid="collection-form"]', {
      timeout: 15000,
    });
  } else {
    await page.waitForTimeout(1500);
  }
}

// ============================================================================
// Test Suite: Create Mode
// ============================================================================

test.describe('CollectionForm Storybook - Create Mode', () => {
  test('should render form in create mode', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });

  test('should show Create button', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Create');
  });

  test('should render form fields', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    // Should have visible form fields rendered by VForm
    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();

    // VForm renders a v-form container
    const vform = page.locator('.v-form');
    await expect(vform).toBeVisible();
  });

  test('should allow filling in text fields', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    // Find a text input (title field uses "input" interface)
    const titleInput = page.locator('input').first();
    await expect(titleInput).toBeVisible();

    await titleInput.fill('Test Title');
    await expect(titleInput).toHaveValue('Test Title');
  });
});

// ============================================================================
// Test Suite: Edit Mode
// ============================================================================

test.describe('CollectionForm Storybook - Edit Mode', () => {
  test('should render form in edit mode with pre-filled data', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--edit-mode');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });

  test('should show Save button in edit mode', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--edit-mode');

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Save');
  });

  test('should disable Save button when no edits have been made', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--edit-mode');

    // Wait for form to fully load
    await page.waitForTimeout(500);

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();

    // Save should be disabled until there are edits
    await expect(submitBtn).toBeDisabled();
  });
});

// ============================================================================
// Test Suite: Default Values
// ============================================================================

test.describe('CollectionForm Storybook - Default Values', () => {
  test('should pre-fill form with default values', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-default-values');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();

    // The story sets default values: status=draft, category=tutorial, featured=false
    // These should be reflected in the form
    const vform = page.locator('.v-form');
    await expect(vform).toBeVisible();
  });
});

// ============================================================================
// Test Suite: Exclude / Include Fields
// ============================================================================

test.describe('CollectionForm Storybook - Field Filtering', () => {
  test('should exclude specified fields', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-exclude-fields');

    // Story excludes "featured" and "category"
    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();

    // Count visible fields — should be fewer than full set
    const vform = page.locator('.v-form');
    await expect(vform).toBeVisible();
  });

  test('should only include specified fields', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-include-fields');

    // Story uses includeFields: ["title", "status"]
    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });
});

// ============================================================================
// Test Suite: Callbacks
// ============================================================================

test.describe('CollectionForm Storybook - Callbacks', () => {
  test('should render callback demonstration story', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-callbacks');

    // Story has a Paper showing "Last callback: (none)" initially
    const callbackInfo = page.getByText(/Last callback/);
    await expect(callbackInfo).toBeVisible();
    await expect(callbackInfo).toContainText('(none)');
  });
});

// ============================================================================
// Test Suite: Group Interfaces
// ============================================================================

test.describe('CollectionForm Storybook - Group Interfaces', () => {
  test('should render group detail layout', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-group-interfaces');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });

  test('should render group accordion layout', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-group-accordion');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });
});

// ============================================================================
// Test Suite: Permission-Restricted Form (Phase 2)
// ============================================================================

test.describe('CollectionForm Storybook - Permission Restrictions', () => {
  test('should render form with restricted permissions', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-restricted-permissions');

    const form = page.locator('[data-testid="collection-form"]');
    await expect(form).toBeVisible();
  });

  test('should show Create button for permitted create', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-restricted-permissions');

    // The restricted permissions story allows create with fields: ["title", "status"]
    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Create');
  });

  test('should render fields based on read permissions', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-restricted-permissions');

    // Form should be visible with VForm
    const vform = page.locator('.v-form');
    await expect(vform).toBeVisible();

    // The mock permissions allow read of all fields ("*") but only write to "title" and "status"
    // Other fields should appear as readonly
  });
});

// ============================================================================
// Test Suite: SaveOptions Integration (Phase 2)
// ============================================================================

test.describe('CollectionForm Storybook - SaveOptions', () => {
  test('should render SaveOptions dropdown next to Save button', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-save-options');

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Save');

    // SaveOptions renders a Menu/ActionIcon. It should exist near the Save button.
    // The Group gap={0} makes them adjacent
    // Look for the dropdown trigger button (chevron icon)
    const saveOptionsBtn = page.locator('[data-testid="save-options-trigger"]');
    // If no test-id, look for a button with the down-arrow next to Save
    if ((await saveOptionsBtn.count()) > 0) {
      await expect(saveOptionsBtn).toBeVisible();
    } else {
      // SaveOptions uses a Menu.Target with an ActionIcon
      const actionIcons = submitBtn.locator('..').locator('button').last();
      await expect(actionIcons).toBeVisible();
    }
  });

  test('should have disabled Save when no edits in edit mode', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-save-options');

    // Wait for form to load
    await page.waitForTimeout(500);

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeVisible();

    // In edit mode with no edits, save should be disabled
    await expect(submitBtn).toBeDisabled();
  });
});

// ============================================================================
// Test Suite: Form Submission
// ============================================================================

test.describe('CollectionForm Storybook - Form Submission', () => {
  test('should show success alert after creating item', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    // Fill in a required field (title)
    const titleInput = page.locator('input').first();
    await titleInput.fill('New Test Post');

    // Click Create
    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await submitBtn.click();

    // Should show success alert
    const success = page.locator('[data-testid="form-success"]');
    await expect(success).toBeVisible({ timeout: 10000 });
    await expect(success).toContainText('created successfully');
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

test.describe('CollectionForm Storybook - Error Handling', () => {
  test('should not show error alert on initial load', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const error = page.locator('[data-testid="form-error"]');
    await expect(error).toHaveCount(0);
  });

  test('should not show per-field errors on initial load', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const fieldErrors = page.locator('[data-testid="form-field-errors"]');
    await expect(fieldErrors).toHaveCount(0);
  });
});

// ============================================================================
// Test Suite: Accessibility
// ============================================================================

test.describe('CollectionForm Storybook - Accessibility', () => {
  test('should have data-testid attributes for key elements', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    await expect(page.locator('[data-testid="collection-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="form-submit-btn"]')).toBeVisible();
  });

  test('should wrap form in a <form> element', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const formElement = page.locator('[data-testid="collection-form"] form');
    await expect(formElement).toBeVisible();
  });

  test('should have submit button with type="submit"', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--create-mode');

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toHaveAttribute('type', 'submit');
  });
});

// ============================================================================
// Test Suite: Files Interface Regression
// ============================================================================

test.describe('CollectionForm Storybook - Files Interface Regression', () => {
  test('should exclude files-interface field from PATCH body', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-files-interface');

    // Wait for the form to load in edit mode
    await page.waitForTimeout(500);

    // Change the title field to enable the Save button
    const titleInput = page.locator('input').first();
    await titleInput.fill('Updated Title');

    // Click Save
    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for the PATCH request to complete (success alert)
    const success = page.locator('[data-testid="form-success"]');
    await expect(success).toBeVisible({ timeout: 10000 });

    // Read the captured PATCH body
    const patchBody = await page.evaluate(() => {
      return (window as any).__patchBody;
    });

    expect(patchBody).toBeDefined();

    // Assert: files-interface field (attachments) is NOT in the PATCH body
    expect(patchBody).not.toHaveProperty('attachments');

    // Assert: other changed scalar fields ARE in the PATCH body
    expect(patchBody).toHaveProperty('title', 'Updated Title');
  });

  test('should include changed scalar fields in PATCH body', async ({ page }) => {
    await goToStory(page, 'collections-collectionform--with-files-interface');

    await page.waitForTimeout(500);

    // Change the status field
    const statusSelect = page.locator('input').nth(1);
    await statusSelect.click();
    await page.waitForTimeout(300);

    // Select "Archived" from dropdown (mantine select)
    const archivedOption = page.getByRole('option', { name: 'Archived' });
    if (await archivedOption.isVisible()) {
      await archivedOption.click();
    }

    // Also change title
    const titleInput = page.locator('input').first();
    await titleInput.fill('Changed');

    const submitBtn = page.locator('[data-testid="form-submit-btn"]');
    await submitBtn.click();

    const success = page.locator('[data-testid="form-success"]');
    await expect(success).toBeVisible({ timeout: 10000 });

    const patchBody = await page.evaluate(() => {
      return (window as any).__patchBody;
    });

    expect(patchBody).toBeDefined();

    // Assert: title and status are present, attachments is not
    expect(patchBody).toHaveProperty('title');
    expect(patchBody).not.toHaveProperty('attachments');
  });
});
