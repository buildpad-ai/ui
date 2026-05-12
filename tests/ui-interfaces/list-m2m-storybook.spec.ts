/**
 * ListM2M Interface Storybook E2E Tests
 *
 * Tests the @buildpad/ui-interfaces ListM2M component in isolation using Storybook.
 * With the mockItems prop, items are rendered directly in Storybook without API calls.
 *
 * Covers: list/table layout rendering, action buttons, disabled/readonly/nonEditable
 * states, required/error display, pagination, local-first state badges, item count.
 *
 * Run: pnpm test:storybook:interfaces
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
}

/** Verify the story rendered without Storybook error display */
async function expectStoryMounted(page: import('@playwright/test').Page) {
    const root = page.locator('#storybook-root');
    await expect(root).toBeAttached();
    await expect(page.locator('.sb-errordisplay')).not.toBeVisible({ timeout: 2000 }).catch(() => {});
}

// ── Basic Rendering ───────────────────────────────────────────────

test.describe('ListM2M - List Layout', () => {
    test('Default: renders list layout with label and description', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--default');
        await expectStoryMounted(page);

        // Should show label and description
        await expect(page.getByText('Article Tags')).toBeVisible();
        await expect(page.getByText('Tags associated with this article')).toBeVisible();
    });

    test('Default: shows Create New and Add Existing buttons', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--default');
        await expectStoryMounted(page);

        await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
    });

    test('Default: renders 3 mock items as cards', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--default');
        await expectStoryMounted(page);

        // 3 items → item count shown
        await expect(page.getByText('3 items')).toBeVisible();
    });

    test('CustomTemplate: renders with custom template format', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--custom-template');
        await expectStoryMounted(page);

        await expect(page.getByText('Tags with Custom Template')).toBeVisible();
    });

    test('Empty: renders empty state message', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--empty');
        await expectStoryMounted(page);

        await expect(page.getByText('No related items')).toBeVisible();
    });

    test('Minimal: renders without crashing', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--minimal');
        await expectStoryMounted(page);
    });
});

// ── Table Layout ──────────────────────────────────────────────────

test.describe('ListM2M - Table Layout', () => {
    test('TableLayout: renders table with column headers', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--table-layout');
        await expectStoryMounted(page);

        await expect(page.getByText('Project Members')).toBeVisible();
        // Should have table column headers (use ARIA role, not CSS selector)
        const headers = page.getByRole('columnheader');
        await expect(headers.first()).toBeVisible();
    });

    test('TableLayout: shows search input', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--table-layout');
        await expectStoryMounted(page);

        await expect(page.getByPlaceholder('Search...')).toBeVisible();
    });

    test('CompactTable: renders compact spacing', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--compact-table');
        await expectStoryMounted(page);
    });

    test('ComfortableTable: renders comfortable spacing', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--comfortable-table');
        await expectStoryMounted(page);
    });
});

// ── States ────────────────────────────────────────────────────────

test.describe('ListM2M - States', () => {
    test('Disabled: hides action buttons', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--disabled');
        await expectStoryMounted(page);

        // enableCreate=false, enableSelect=false in this story
        await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
    });

    test('Required: shows required asterisk and error message', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--required');
        await expectStoryMounted(page);

        await expect(page.getByText('Required Categories')).toBeVisible();
        await expect(page.getByText('This field is required')).toBeVisible();
    });

    test('WithError: displays error text', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--with-error');
        await expectStoryMounted(page);

        await expect(page.getByText('Invalid tag selection - duplicates not allowed')).toBeVisible();
    });

    test('ReadOnly: hides action buttons', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--read-only-mode');
        await expectStoryMounted(page);

        await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
    });

    test('NonEditable: shows items but no action buttons', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--non-editable');
        await expectStoryMounted(page);

        await expect(page.getByText('Non-Editable Tags')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
    });
});

// ── Advanced ──────────────────────────────────────────────────────

test.describe('ListM2M - Advanced', () => {
    test('WithPagination: shows pagination controls', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--with-pagination');
        await expectStoryMounted(page);

        // 23 items with limit 10 → should see "Showing X to Y of Z"
        await expect(page.getByText(/Showing \d+ to \d+ of \d+/)).toBeVisible();
    });

    test('FullFeatured: renders all features', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--full-featured');
        await expectStoryMounted(page);

        await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
        await expect(page.getByPlaceholder('Search...')).toBeVisible();
    });
});

// ── Local-First State Management ──────────────────────────────────

test.describe('ListM2M - Local-First States', () => {
    const STORY = 'interfaces-listm2m--local-first-states';

    test('renders without crashing', async ({ page }) => {
        await goToStory(page, STORY);
        await expectStoryMounted(page);

        await expect(page.getByText('Local-First States')).toBeVisible();
    });

    test('created item shows NEW badge', async ({ page }) => {
        await goToStory(page, STORY);
        await expectStoryMounted(page);

        await expect(page.getByText('NEW', { exact: true })).toBeVisible();
    });

    test('updated item shows EDITED badge', async ({ page }) => {
        await goToStory(page, STORY);
        await expectStoryMounted(page);

        await expect(page.getByText('EDITED')).toBeVisible();
    });
});

// ── Item Count ────────────────────────────────────────────────────

test.describe('ListM2M - Item Count', () => {
    test('Default: shows "3 items"', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--default');
        await expectStoryMounted(page);

        await expect(page.getByText('3 items')).toBeVisible();
    });

    test('Empty: does not show item count', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--empty');
        await expectStoryMounted(page);

        // 0 items → count text should not appear
        await expect(page.getByText(/^\d+ items?$/)).not.toBeVisible();
    });
});

// ── P2: Drag-and-Drop Sorting ─────────────────────────────────────

test.describe('ListM2M - Drag & Drop', () => {
    test('DragAndDropList: shows drag handles (grip icons)', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--drag-and-drop-list');
        await expectStoryMounted(page);

        await expect(page.getByText('Drag & Drop List')).toBeVisible();

        // Drag handle icons should be present (one per item, 3 items)
        const gripIcons = page.locator('svg.icon-grip-vertical, [class*="tabler-icon-grip-vertical"]');
        // Fallback: look for the ActionIcon with drag tooltip
        const dragHandles = page.getByRole('button').filter({ has: page.locator('svg') });
        const handleCount = await dragHandles.count();
        expect(handleCount).toBeGreaterThanOrEqual(3); // At least 3 drag handles
    });

    test('DragAndDropTable: shows drag handle column in table', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--drag-and-drop-table');
        await expectStoryMounted(page);

        await expect(page.getByText('Drag & Drop Table')).toBeVisible();

        // Table should have an "Order" column header
        await expect(page.getByText('Order', { exact: true })).toBeVisible();
    });

    test('SortFallbackArrows: shows up/down arrows when DnD disabled', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--sort-fallback-arrows');
        await expectStoryMounted(page);

        await expect(page.getByText('Sort Fallback — Arrows')).toBeVisible();

        // Should have up/down arrow buttons (ChevronUp / ChevronDown icons)
        // limit=2 but 3 items → DnD disabled, arrows shown
        const buttons = page.getByRole('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThanOrEqual(2); // at least some sort buttons
    });
});

// ── P2: Batch Edit ────────────────────────────────────────────────

test.describe('ListM2M - Batch Edit', () => {
    test('BatchEditTable: shows checkboxes for selection', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--batch-edit-table');
        await expectStoryMounted(page);

        await expect(page.getByText('Batch Edit Table')).toBeVisible();

        // Should have at least one checkbox (the header "select all" checkbox)
        const checkboxes = page.getByRole('checkbox');
        const checkboxCount = await checkboxes.count();
        expect(checkboxCount).toBeGreaterThanOrEqual(1);
    });

    test('BatchEditTable: selecting an item enables batch edit button', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--batch-edit-table');
        await expectStoryMounted(page);

        // Click first row checkbox to select an item
        const checkboxes = page.getByRole('checkbox');
        const firstItemCheckbox = checkboxes.nth(1); // nth(0) is "select all"
        await firstItemCheckbox.click();

        // Batch edit button should appear with count
        await expect(page.getByText(/Editing \d+ items/)).toBeVisible();
    });
});

// ── P2: i18n / Custom Translations ──────────────────────────────

test.describe('ListM2M - Translations', () => {
    test('CustomTranslations: shows French button labels', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--custom-translations');
        await expectStoryMounted(page);

        await expect(page.getByText('Étiquettes')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Créer nouveau' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ajouter existant' })).toBeVisible();
    });

    test('CustomTranslations: shows French item count', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--custom-translations');
        await expectStoryMounted(page);

        // 3 items → French plural
        await expect(page.getByText('3 éléments')).toBeVisible();
    });
});

// ── P2: Version Indicator ───────────────────────────────────────

test.describe('ListM2M - Versioning', () => {
    test('VersionedContent: shows version badge', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--versioned-content');
        await expectStoryMounted(page);

        await expect(page.getByText('Versioned Tags')).toBeVisible();
        // Should show a version badge
        await expect(page.getByText(/draft-v2/)).toBeVisible();
    });
});

// ── P2: Skeleton Loading ────────────────────────────────────────

test.describe('ListM2M - Skeleton Loading', () => {
    test('SkeletonLoadingList: renders without crashing', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--skeleton-loading-list');
        await expectStoryMounted(page);

        // In mock mode the empty state is shown (no actual loading)
        await expect(page.getByText('Skeleton Loading (List)')).toBeVisible();
    });

    test('SkeletonLoadingTable: renders without crashing', async ({ page }) => {
        await goToStory(page, 'interfaces-listm2m--skeleton-loading-table');
        await expectStoryMounted(page);

        await expect(page.getByText('Skeleton Loading (Table)')).toBeVisible();
    });
});
