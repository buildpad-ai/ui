/**
 * SystemPermissions Interface Storybook E2E Tests
 *
 * Tests the @buildpad/ui-interfaces SystemPermissions component using Storybook.
 * Permission management table with CRUD+share toggles, Add Collection modal,
 * All/None shortcuts, admin notice, and app access reset controls.
 *
 * Run: SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6008 npx playwright test --project=storybook-interfaces tests/ui-interfaces/system-permissions-storybook.spec.ts --reporter=line
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6008';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ============================================================================
// Basic Rendering — Default (Empty State)
// ============================================================================

test.describe('SystemPermissions - Default (Empty)', () => {
  test('renders label and description', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible();
    await expect(page.getByText('Configure collection access for this policy')).toBeVisible();
  });

  test('shows empty state message when no permissions', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await expect(page.getByTestId('sp-empty')).toBeVisible();
  });

  test('has add collection button', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await expect(page.getByTestId('sp-add-btn')).toBeVisible();
  });

  test('opens add collection modal on button click', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.waitForTimeout(300);
    // Mantine Modal renders a dialog element when opened
    await expect(page.getByRole('dialog', { name: 'Add Collection' })).toBeVisible();
  });

  test('modal has search input', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.waitForTimeout(300);
    const searchInput = page.getByPlaceholder('Search collections...');
    await expect(searchInput).toBeVisible();
  });

  test('modal lists available collections', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.waitForTimeout(300);
    // Should see at least some collection items
    await expect(page.getByTestId('sp-add-item-articles')).toBeVisible();
    await expect(page.getByTestId('sp-add-item-products')).toBeVisible();
  });
});

// ============================================================================
// Add Collection Flow
// ============================================================================

test.describe('SystemPermissions - Add Collection', () => {
  test('clicking a collection adds it and closes modal', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.getByTestId('sp-add-item-articles').click();

    // Modal should close and row should appear
    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
  });

  test('added collection shows 5 action badges', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.getByTestId('sp-add-item-articles').click();

    // 5 action badges: C, R, U, D, S
    for (const action of ['create', 'read', 'update', 'delete', 'share']) {
      await expect(page.getByTestId(`sp-toggle-articles-${action}`)).toBeVisible();
    }
  });

  test('newly added collection has read enabled, others gray', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    await page.waitForTimeout(300);
    await page.getByTestId('sp-add-item-articles').click();

    // handleAddCollection sets read to full access
    await expect(page.getByTestId('sp-toggle-articles-read')).toHaveAttribute('data-level', 'all');
    // Other actions should be none
    for (const action of ['create', 'update', 'delete', 'share']) {
      const badge = page.getByTestId(`sp-toggle-articles-${action}`);
      await expect(badge).toHaveAttribute('data-level', 'none');
    }
  });

  test('modal search filters collections', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    const search = page.getByPlaceholder('Search collections');
    await search.fill('art');
    // articles should remain visible
    await expect(page.getByTestId('sp-add-item-articles')).toBeVisible();
    // products should be hidden
    await expect(page.getByTestId('sp-add-item-products')).not.toBeVisible();
  });
});

// ============================================================================
// WithExistingPermissions
// ============================================================================

test.describe('SystemPermissions - Existing Permissions', () => {
  test('renders rows for collections with permissions', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
    await expect(page.getByTestId('sp-row-products')).toBeVisible();
  });

  test('articles: create and read are green (all access)', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-toggle-articles-create')).toHaveAttribute('data-level', 'all');
    await expect(page.getByTestId('sp-toggle-articles-read')).toHaveAttribute('data-level', 'all');
  });

  test('articles: update is blue (custom access)', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-toggle-articles-update')).toHaveAttribute('data-level', 'custom');
  });

  test('articles: delete and share are gray (none)', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-toggle-articles-delete')).toHaveAttribute('data-level', 'none');
    await expect(page.getByTestId('sp-toggle-articles-share')).toHaveAttribute('data-level', 'none');
  });

  test('products: read is all, others are none', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-toggle-products-read')).toHaveAttribute('data-level', 'all');
    await expect(page.getByTestId('sp-toggle-products-create')).toHaveAttribute('data-level', 'none');
    await expect(page.getByTestId('sp-toggle-products-update')).toHaveAttribute('data-level', 'none');
    await expect(page.getByTestId('sp-toggle-products-delete')).toHaveAttribute('data-level', 'none');
    await expect(page.getByTestId('sp-toggle-products-share')).toHaveAttribute('data-level', 'none');
  });

  test('has all/none shortcuts per row', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-all-articles')).toBeVisible();
    await expect(page.getByTestId('sp-none-articles')).toBeVisible();
  });

  test('has remove button per row', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByTestId('sp-remove-articles')).toBeVisible();
    await expect(page.getByTestId('sp-remove-products')).toBeVisible();
  });
});

// ============================================================================
// All / None Shortcuts
// ============================================================================

test.describe('SystemPermissions - All/None Shortcuts', () => {
  test('clicking "all" turns all badges green', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    // Click "all" for articles
    await page.getByTestId('sp-all-articles').click();

    // All 5 action badges should become "all" (green)
    for (const action of ['create', 'read', 'update', 'delete', 'share']) {
      await expect(page.getByTestId(`sp-toggle-articles-${action}`)).toHaveAttribute('data-level', 'all');
    }
  });

  test('clicking "none" removes all permissions for that row', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    // Click "none" for articles — this removes all permissions
    await page.getByTestId('sp-none-articles').click();

    // After removing all permissions, the row may be removed or all badges gray
    // When all created items are removed via setNoAccessAll, the row disappears
    // since there are no more permissions for that collection
    await expect(page.getByTestId('sp-row-articles')).not.toBeVisible();
  });

  test('clicking "all" sets all badges to green', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    await page.getByTestId('sp-all-articles').click();
    // Verify all green
    for (const action of ['create', 'read', 'update', 'delete', 'share']) {
      await expect(page.getByTestId(`sp-toggle-articles-${action}`)).toHaveAttribute('data-level', 'all');
    }
  });
});

// ============================================================================
// Remove Collection
// ============================================================================

test.describe('SystemPermissions - Remove Collection', () => {
  test('remove button removes the row', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
    await page.getByTestId('sp-remove-articles').click();
    await expect(page.getByTestId('sp-row-articles')).not.toBeVisible();
  });

  test('removing all collections shows empty state', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    await page.getByTestId('sp-remove-articles').click();
    await page.getByTestId('sp-remove-products').click();
    await expect(page.getByTestId('sp-empty')).toBeVisible();
  });
});

// ============================================================================
// Admin Access
// ============================================================================

test.describe('SystemPermissions - Admin Access', () => {
  test('shows admin notice', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--admin-access');
    await expect(page.getByTestId('sp-admin-notice')).toBeVisible();
  });

  test('does not show add button or table', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--admin-access');
    await expect(page.getByTestId('sp-add-btn')).not.toBeVisible();
  });
});

// ============================================================================
// Disabled State
// ============================================================================

test.describe('SystemPermissions - Disabled', () => {
  test('renders badges but no all/none shortcuts', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--disabled');
    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
    // Badges should be visible
    await expect(page.getByTestId('sp-toggle-articles-read')).toBeVisible();
    // All/None shortcuts should not be visible when disabled
    await expect(page.getByTestId('sp-all-articles')).not.toBeVisible();
    await expect(page.getByTestId('sp-none-articles')).not.toBeVisible();
  });

  test('does not show remove buttons', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--disabled');
    await expect(page.getByTestId('sp-remove-articles')).not.toBeVisible();
  });

  test('does not show add collection button', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--disabled');
    await expect(page.getByTestId('sp-add-btn')).not.toBeVisible();
  });
});

// ============================================================================
// Mixed Collections
// ============================================================================

test.describe('SystemPermissions - Mixed Collections', () => {
  test('shows both regular and system collection rows', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--mixed-collections');
    // Regular collection
    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
    // System collections
    await expect(page.getByTestId('sp-row-daas_users')).toBeVisible();
    await expect(page.getByTestId('sp-row-daas_files')).toBeVisible();
  });

  test('articles has full access (all green)', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--mixed-collections');
    for (const action of ['create', 'read', 'update', 'delete', 'share']) {
      await expect(page.getByTestId(`sp-toggle-articles-${action}`)).toHaveAttribute('data-level', 'all');
    }
  });

  test('system divider separates regular from system collections', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--mixed-collections');
    // Should have a "System Collections" divider visible
    await expect(page.getByText('System Collections', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// Custom Permissions
// ============================================================================

test.describe('SystemPermissions - Custom Permissions', () => {
  test('renders articles row with mixed badge states', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--custom-permissions');
    await expect(page.getByTestId('sp-row-articles')).toBeVisible();
  });

  test('custom fields show as custom (blue) badge', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--custom-permissions');
    // articles create has restricted fields → custom
    await expect(page.getByTestId('sp-toggle-articles-create')).toHaveAttribute('data-level', 'custom');
    // articles read has permissions filter → custom
    await expect(page.getByTestId('sp-toggle-articles-read')).toHaveAttribute('data-level', 'custom');
    // articles update has restricted fields + permissions → custom
    await expect(page.getByTestId('sp-toggle-articles-update')).toHaveAttribute('data-level', 'custom');
  });

  test('unconfigured actions show as none (gray)', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--custom-permissions');
    await expect(page.getByTestId('sp-toggle-articles-delete')).toHaveAttribute('data-level', 'none');
    await expect(page.getByTestId('sp-toggle-articles-share')).toHaveAttribute('data-level', 'none');
  });
});

// ============================================================================
// With App Access
// ============================================================================

test.describe('SystemPermissions - App Access', () => {
  test('renders reset controls', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-app-access');
    await expect(page.getByTestId('sp-reset-minimum')).toBeVisible();
    await expect(page.getByTestId('sp-reset-recommended')).toBeVisible();
  });

  test('shows system collection rows', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-app-access');
    await expect(page.getByTestId('sp-row-daas_users')).toBeVisible();
    await expect(page.getByTestId('sp-row-daas_files')).toBeVisible();
  });
});

// ============================================================================
// Disabled Actions (daas_extensions)
// ============================================================================

test.describe('SystemPermissions - Disabled Actions', () => {
  test('daas_extensions shows disabled markers for create and delete', async ({ page }) => {
    // Add daas_extensions via default story
    await goToStory(page, 'system-systempermissions--default');
    await page.getByTestId('sp-add-btn').click();
    // Scroll or search for daas_extensions
    const search = page.getByPlaceholder('Search collections');
    await search.fill('daas_extensions');
    await page.getByTestId('sp-add-item-daas_extensions').click();

    // create and delete should be disabled (showing "—")
    await expect(page.getByTestId('sp-disabled-daas_extensions-create')).toBeVisible();
    await expect(page.getByTestId('sp-disabled-daas_extensions-delete')).toBeVisible();
    // read, update, share should be normal toggles
    await expect(page.getByTestId('sp-toggle-daas_extensions-read')).toBeVisible();
    await expect(page.getByTestId('sp-toggle-daas_extensions-update')).toBeVisible();
    await expect(page.getByTestId('sp-toggle-daas_extensions-share')).toBeVisible();
  });
});

// ============================================================================
// With Error
// ============================================================================

test.describe('SystemPermissions - Error', () => {
  test('shows error message', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-error');
    await expect(page.getByText('Failed to save permissions. Please try again.')).toBeVisible();
  });
});

// ============================================================================
// Permission Toggle Interaction
// ============================================================================

test.describe('SystemPermissions - Toggle Interaction', () => {
  test('clicking badge opens dropdown menu', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    // Click on articles-create badge (already "all")
    await page.getByTestId('sp-toggle-articles-create').click();

    // Menu should appear with All Access, No Access, Use Custom options
    await expect(page.getByText('All Access')).toBeVisible();
    await expect(page.getByText('No Access')).toBeVisible();
    await expect(page.getByText('Use Custom')).toBeVisible();
  });

  test('selecting No Access from menu turns badge gray', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    // Click on articles-create badge (currently "all")
    await page.getByTestId('sp-toggle-articles-create').click();

    // Select "No Access"
    await page.getByText('No Access').click();

    // Badge should now be "none"
    await expect(page.getByTestId('sp-toggle-articles-create')).toHaveAttribute('data-level', 'none');
  });

  test('selecting All Access from menu turns badge green', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');

    // Click on articles-delete badge (currently "none")
    await page.getByTestId('sp-toggle-articles-delete').click();

    // Select "All Access"
    await page.getByText('All Access').click();

    // Badge should now be "all"
    await expect(page.getByTestId('sp-toggle-articles-delete')).toHaveAttribute('data-level', 'all');
  });
});

// ============================================================================
// Table Header
// ============================================================================

test.describe('SystemPermissions - Table Header', () => {
  test('shows action header labels', async ({ page }) => {
    await goToStory(page, 'system-systempermissions--with-existing-permissions');
    await expect(page.getByText('Collection', { exact: true })).toBeVisible();

    // Column headers
    for (const header of ['Create', 'Read', 'Update', 'Delete', 'Share']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
  });
});
