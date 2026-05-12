/**
 * Map Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Map component in isolation using Storybook.
 * Covers: default, geometry types (Point, LineString, Polygon, MultiPoint),
 * formats (geometry, json, csv, string), states (disabled, readonly, required, error),
 * compact height, basemap selector.
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

test.describe('Map - Basic Rendering', () => {
  test('Default: renders map interface', async ({ page }) => {
    await goToStory(page, 'interfaces-map--default');
    await expect(page.getByText('Location', { exact: true })).toBeVisible();
  });
});

test.describe('Map - Geometry Types', () => {
  test('Point: renders point geometry', async ({ page }) => {
    await goToStory(page, 'interfaces-map--point');
    await expect(page.getByText('Point Location', { exact: true })).toBeVisible();
  });

  test('LineString: renders line geometry', async ({ page }) => {
    await goToStory(page, 'interfaces-map--line-string');
    await expect(page.getByText('Route', { exact: true })).toBeVisible();
  });

  test('Polygon: renders polygon geometry', async ({ page }) => {
    await goToStory(page, 'interfaces-map--polygon');
    await expect(page.getByText('Area', { exact: true })).toBeVisible();
  });

  test('MultiPoint: renders multi-point geometry', async ({ page }) => {
    await goToStory(page, 'interfaces-map--multi-point');
    await expect(page.getByText('Multiple Points')).toBeVisible();
  });

  test('AnyGeometry: renders any geometry type', async ({ page }) => {
    await goToStory(page, 'interfaces-map--any-geometry');
    await expect(page.getByText('Any Geometry')).toBeVisible();
  });
});

test.describe('Map - Formats', () => {
  test('JSONFormat: renders JSON format', async ({ page }) => {
    await goToStory(page, 'interfaces-map--json-format');
    await expect(page.getByText('GeoJSON Data')).toBeVisible();
  });

  test('StringFormat: renders string format', async ({ page }) => {
    await goToStory(page, 'interfaces-map--string-format');
    await expect(page.getByText('Geometry String')).toBeVisible();
  });
});

test.describe('Map - States', () => {
  test('Disabled: renders disabled map', async ({ page }) => {
    await goToStory(page, 'interfaces-map--disabled');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('ReadOnly: renders read-only map', async ({ page }) => {
    await goToStory(page, 'interfaces-map--read-only');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('Required: renders required map field', async ({ page }) => {
    await goToStory(page, 'interfaces-map--required');
    const root = page.locator('#storybook-root');
    await expect(root).not.toBeEmpty();
  });

  test('WithError: renders error state', async ({ page }) => {
    await goToStory(page, 'interfaces-map--with-error');
    await expect(page.getByText(/invalid geometry/i)).toBeVisible();
  });
});

test.describe('Map - Configuration', () => {
  test('CompactHeight: renders with reduced height', async ({ page }) => {
    await goToStory(page, 'interfaces-map--compact-height');
    await expect(page.getByText('Compact Map')).toBeVisible();
  });

  test('NoBasemapSelector: renders without basemap selector', async ({ page }) => {
    await goToStory(page, 'interfaces-map--no-basemap-selector');
    await expect(page.getByText('Fixed Basemap')).toBeVisible();
  });
});
