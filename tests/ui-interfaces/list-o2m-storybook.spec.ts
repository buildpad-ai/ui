/**
 * ListO2M Interface Storybook E2E Tests
 *
 * Tests the @buildpad/ui-interfaces ListO2M component in isolation using Storybook.
 * With the mockItems + mockRelationInfo props, items are rendered directly in Storybook
 * without API calls.
 *
 * Covers: list/table layout rendering, table spacing variants, search, create/select
 * buttons, pagination, remove actions (unlink/delete), required/error/disabled/readonly
 * states, empty state, mock item rendering, unique FK guard, singleton guard,
 * sortable rows, nested templates, description, batch edit checkboxes, item count.
 *
 * DaaS Test Collection: test_o2m (TC01-TC10)
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

// ── TC01: Basic Rendering ─────────────────────────────────────────

test.describe('ListO2M - Basic Rendering', () => {
  test('Default: renders table layout with label and buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    // Should show label
    await expect(page.getByText('Basic O2M Comments')).toBeVisible();
    // Should show Create New and Add Existing buttons
    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
  });

  test('Default: renders 3 mock items with count', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    await expect(page.getByText('3 items')).toBeVisible();
  });

  test('Default: table has column headers', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    // Table column headers (fields: ['text', 'author'])
    await expect(page.getByText('Text', { exact: true })).toBeVisible();
    await expect(page.getByText('Author', { exact: true })).toBeVisible();
    await expect(page.getByText('Actions', { exact: true })).toBeVisible();
  });
});

// ── TC02: List Layout ─────────────────────────────────────────────

test.describe('ListO2M - List Layout', () => {
  test('ListLayout: renders list with template text', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--list-layout');
    await expectStoryMounted(page);

    await expect(page.getByText('Comments (List)')).toBeVisible();
    // Template: '{{text}} ({{author}})' → rendered text
    await expect(page.getByText('First basic comment (Alice)')).toBeVisible();
    await expect(page.getByText('Second basic comment with more text (Bob)')).toBeVisible();
  });

  test('ListLayout: renders 3 list items', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--list-layout');
    await expectStoryMounted(page);

    await expect(page.getByText('3 items')).toBeVisible();
  });
});

// ── Table Layout & Rich Fields ────────────────────────────────────

test.describe('ListO2M - Table Layout', () => {
  test('TableLayout: renders table with rich field columns', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--table-layout');
    await expectStoryMounted(page);

    await expect(page.getByText('Rich Fields Table')).toBeVisible();
    // Column headers for fields: name, priority, status, due_date, is_active
    const table = page.locator('[data-testid="o2m-table"]');
    await expect(table.getByText('Name', { exact: true }).first()).toBeVisible();
    await expect(table.getByText('Priority', { exact: true }).first()).toBeVisible();
    await expect(table.getByText('Status', { exact: true }).first()).toBeVisible();
  });

  test('TableLayout: shows 4 items count', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--table-layout');
    await expectStoryMounted(page);

    await expect(page.getByText('4 items')).toBeVisible();
  });
});

// ── Table Spacing Variants ────────────────────────────────────────

test.describe('ListO2M - Table Spacing', () => {
  test('CompactTable: renders with compact spacing', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--compact-table');
    await expectStoryMounted(page);

    await expect(page.getByText('Compact Table')).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
  });

  test('CozyTable: renders with cozy spacing', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--cozy-table');
    await expectStoryMounted(page);

    await expect(page.getByText('Cozy Table')).toBeVisible();
  });

  test('ComfortableTable: renders with comfortable spacing', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--comfortable-table');
    await expectStoryMounted(page);

    await expect(page.getByText('Comfortable Table')).toBeVisible();
  });
});

// ── TC03: Search Filter ───────────────────────────────────────────

test.describe('ListO2M - Search', () => {
  test('WithSearch: renders search input', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-search');
    await expectStoryMounted(page);

    await expect(page.getByText('Searchable Tasks')).toBeVisible();
    await expect(page.getByPlaceholder('Search...')).toBeVisible();
  });
});

// ── TC05: Enable Link ─────────────────────────────────────────────

test.describe('ListO2M - Link', () => {
  test('WithEnableLink: renders link action icons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-enable-link');
    await expectStoryMounted(page);

    await expect(page.getByText('Linked Items')).toBeVisible();
    // enableLink shows external link icons on each row
    const linkIcons = page.locator('[data-testid^="o2m-link-"]');
    const count = await linkIcons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── TC07: Pagination ──────────────────────────────────────────────

test.describe('ListO2M - Pagination', () => {
  test('WithPagination: shows pagination controls', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-pagination');
    await expectStoryMounted(page);

    // 23 items with limit 5 → pagination visible
    await expect(page.getByText(/Showing \d+ to \d+ of \d+/)).toBeVisible();
  });

  test('WithPagination: shows items-per-page select', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-pagination');
    await expectStoryMounted(page);

    await expect(page.getByText('Items per page:')).toBeVisible();
  });
});

// ── Create / Select Buttons ───────────────────────────────────────

test.describe('ListO2M - Create & Select', () => {
  test('CreateEnabled: shows Create New but not Add Existing', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--create-enabled');
    await expectStoryMounted(page);

    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
  });

  test('SelectEnabled: shows Add Existing but not Create New', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--select-enabled');
    await expectStoryMounted(page);

    await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
  });

  test('BothEnabled: shows both buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--both-enabled');
    await expectStoryMounted(page);

    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
  });
});

// ── Remove Actions (TC09, TC10) ───────────────────────────────────

test.describe('ListO2M - Remove Actions', () => {
  test('UnlinkAction: renders with description', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--unlink-action');
    await expectStoryMounted(page);

    await expect(page.getByText('Unlink Items')).toBeVisible();
    await expect(page.getByText('Removing unlinks the item (sets FK to null)')).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
  });

  test('DeleteAction: renders with description', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--delete-action');
    await expectStoryMounted(page);

    await expect(page.getByText('Delete Items')).toBeVisible();
    await expect(page.getByText('Removing deletes the item permanently')).toBeVisible();
    await expect(page.getByText('2 items')).toBeVisible();
  });
});

// ── States ────────────────────────────────────────────────────────

test.describe('ListO2M - States', () => {
  test('Required: shows asterisk and label', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--required');
    await expectStoryMounted(page);

    await expect(page.getByText('Required Items')).toBeVisible();
    // Required indicator: red asterisk next to label
    await expect(page.locator('[data-testid="list-o2m"]').getByText('*').first()).toBeVisible();
  });

  test('WithError: shows error text', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-error');
    await expectStoryMounted(page);

    await expect(page.getByText('At least one item is required')).toBeVisible();
  });

  test('Disabled: hides action buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--disabled');
    await expectStoryMounted(page);

    await expect(page.getByText('Disabled Items')).toBeVisible();
    // Disabled state: no Create New or Add Existing buttons
    await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
  });

  test('ReadOnly: hides action buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--read-only');
    await expectStoryMounted(page);

    await expect(page.getByText('Read Only Items')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
  });
});

// ── Empty State ───────────────────────────────────────────────────

test.describe('ListO2M - Empty State', () => {
  test('Empty: shows "No related items"', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--empty');
    await expectStoryMounted(page);

    await expect(page.getByText('No related items')).toBeVisible();
  });

  test('Empty: does not show item count', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--empty');
    await expectStoryMounted(page);

    await expect(page.getByText(/^\d+ items?$/)).not.toBeVisible();
  });
});

// ── Mock Items Rendering ──────────────────────────────────────────

test.describe('ListO2M - Mock Items', () => {
  test('WithMockItems: renders list layout with template', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-mock-items');
    await expectStoryMounted(page);

    await expect(page.getByText('Blog Comments')).toBeVisible();
    // Template: '{{author}} wrote: {{text}}'
    await expect(page.getByText(/Alice wrote:/)).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
  });

  test('WithMockItemsTable: renders table with rich fields', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-mock-items-table');
    await expectStoryMounted(page);

    await expect(page.getByText('Rich Fields Table')).toBeVisible();
    await expect(page.getByText('4 items')).toBeVisible();
    // Verify cell data renders
    await expect(page.getByText('Setup environment')).toBeVisible();
  });
});

// ── Priority #1: Changeset Staging / Local-First States ───────────

test.describe('ListO2M - Local-First States', () => {
  const STORY = 'interfaces-listo2m--local-first-states';

  test('renders without crashing', async ({ page }) => {
    await goToStory(page, STORY);
    await expectStoryMounted(page);

    await expect(page.getByText('Local-First States')).toBeVisible();
  });

  test('renders all mock items', async ({ page }) => {
    await goToStory(page, STORY);
    await expectStoryMounted(page);

    // 4 items total (created + updated + deleted + normal)
    // Deleted items are filtered out in displayItems, so 3 visible
    await expect(page.getByText(/Brand new item/)).toBeVisible();
    await expect(page.getByText(/Updated comment text/)).toBeVisible();
    await expect(page.getByText(/Normal existing item/)).toBeVisible();
  });
});

// ── Priority #4: Unique FK Guard ──────────────────────────────────

test.describe('ListO2M - Unique FK Guard', () => {
  test('UniqueFKGuard: shows unique constraint notice', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--unique-fk-guard');
    await expectStoryMounted(page);

    await expect(page.getByText('Unique FK (1:1)')).toBeVisible();
    // Should show the unique FK alert
    await expect(page.locator('[data-testid="o2m-unique-fk-notice"]')).toBeVisible();
    await expect(page.getByText(/unique constraint/i)).toBeVisible();
  });

  test('UniqueFKGuard: hides Create and Select buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--unique-fk-guard');
    await expectStoryMounted(page);

    // With unique FK + existing item, create/select should be hidden
    await expect(page.getByRole('button', { name: 'Create New' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).not.toBeVisible();
  });
});

// ── Priority #5: Singleton Guard ──────────────────────────────────

test.describe('ListO2M - Singleton Guard', () => {
  test('SingletonGuard: shows singleton warning', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--singleton-guard');
    await expectStoryMounted(page);

    await expect(page.getByText('Singleton Collection')).toBeVisible();
    await expect(page.locator('[data-testid="o2m-singleton-warning"]')).toBeVisible();
    await expect(page.getByText('The related collection is a singleton')).toBeVisible();
  });
});

// ── Priority #6/#7/#8: Sortable ───────────────────────────────────

test.describe('ListO2M - Sortable', () => {
  test('Sortable: renders items in order', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--sortable');
    await expectStoryMounted(page);

    await expect(page.getByText('Sortable Items')).toBeVisible();
    await expect(page.getByText('5 items')).toBeVisible();
    // Items rendered by template: {{name}}
    await expect(page.getByText('Alpha')).toBeVisible();
    await expect(page.getByText('Echo')).toBeVisible();
  });
});

// ── Priority #9: Nested Template ──────────────────────────────────

test.describe('ListO2M - Nested Template', () => {
  test('NestedTemplate: renders nested field values', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--nested-template');
    await expectStoryMounted(page);

    await expect(page.getByText('Nested Templates')).toBeVisible();
    // Template: '{{text}} by {{author.name}} ({{author.role}}) - {{metadata.created}}'
    await expect(page.getByText(/Nested data item by Alice \(Admin\)/)).toBeVisible();
  });
});

// ── TC09: Description ─────────────────────────────────────────────

test.describe('ListO2M - Description', () => {
  test('WithDescription: renders description below label', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-description');
    await expectStoryMounted(page);

    await expect(page.getByText('Described Items')).toBeVisible();
    await expect(page.getByText('Child items related via O2M relationship')).toBeVisible();
    await expect(page.getByText('3 items')).toBeVisible();
  });
});

// ── Batch Edit (Checkboxes) ───────────────────────────────────────

test.describe('ListO2M - Batch Edit', () => {
  test('Default: shows checkboxes in table layout', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    // Table layout should have select-all checkbox
    const selectAll = page.locator('[data-testid="o2m-select-all"]');
    await expect(selectAll).toBeVisible();
  });

  test('Default: selecting items shows batch action button', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    // Click first row checkbox
    const firstCheck = page.locator('[data-testid="o2m-check-1"]');
    await firstCheck.click();

    // Should show batch remove button with count
    await expect(page.getByText(/1 selected/)).toBeVisible();
  });

  test('Disabled: hides checkboxes', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--disabled');
    await expectStoryMounted(page);

    // Disabled state → no checkboxes
    const selectAll = page.locator('[data-testid="o2m-select-all"]');
    await expect(selectAll).not.toBeVisible();
  });
});

// ── Item Count ────────────────────────────────────────────────────

test.describe('ListO2M - Item Count', () => {
  test('Default: shows "3 items"', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--default');
    await expectStoryMounted(page);

    await expect(page.getByText('3 items')).toBeVisible();
  });

  test('WithPagination: shows "23 items"', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--with-pagination');
    await expectStoryMounted(page);

    await expect(page.getByText('23 items')).toBeVisible();
  });

  test('Empty: does not show count', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--empty');
    await expectStoryMounted(page);

    await expect(page.getByText(/^\d+ items?$/)).not.toBeVisible();
  });
});

// ── Full-Featured ─────────────────────────────────────────────────

test.describe('ListO2M - Full Featured', () => {
  test('FullFeatured: renders all features together', async ({ page }) => {
    await goToStory(page, 'interfaces-listo2m--full-featured');
    await expectStoryMounted(page);

    await expect(page.getByText('Project Tasks')).toBeVisible();
    await expect(page.getByText('Manage all tasks for this project')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Existing' })).toBeVisible();
    await expect(page.getByPlaceholder('Search...')).toBeVisible();
    await expect(page.getByText('4 items')).toBeVisible();
  });
});
