/**
 * AutocompleteAPI Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces AutocompleteAPI component using Storybook.
 * Autocomplete input that fetches suggestions from an external API.
 * 
 * Note: These tests verify rendering only, not actual API calls (which require network).
 * 
 * Run: SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6005 npx playwright test --project=storybook-interfaces --reporter=line
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('AutocompleteAPI - Basic Rendering', () => {
  test('Default: renders autocomplete input with label', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--default');
    await expect(page.getByText('Search GitHub Repos')).toBeVisible();
    const input = page.locator('input').first();
    await expect(input).toBeVisible();
  });

  test('WithDescription: renders with description', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--with-description');
    await expect(page.getByText('GitHub Repository')).toBeVisible();
    await expect(page.getByText('Search for public repositories by name')).toBeVisible();
  });

  test('WithDebounce: renders with debounce config', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--with-debounce');
    await expect(page.getByText('Debounced Search')).toBeVisible();
    await expect(page.getByText('Waits 300ms after typing stops before searching')).toBeVisible();
  });

  test('WithThrottle: renders with throttle config', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--with-throttle');
    await expect(page.getByText('Searches at most every 500ms')).toBeVisible();
  });

  test('LimitedResults: renders with result limit', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--limited-results');
    await expect(page.getByText('Shows max 3 results')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('AutocompleteAPI - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--required');
    await expect(page.getByText('Required Repository')).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--with-error');
    await expect(page.getByText('Please select a valid repository')).toBeVisible();
  });

  test('Disabled: input is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--disabled');
    const input = page.locator('input').first();
    await expect(input).toBeDisabled();
  });

  test('ReadOnly: input is read-only', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--read-only');
    await expect(page.getByText('This field cannot be edited')).toBeVisible();
    const input = page.locator('[data-testid="autocomplete-api"]');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });

  test('Clearable: renders with clear button', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--clearable');
    await expect(page.getByText('Click the X to clear')).toBeVisible();
  });
});

// ============================================================================
// Variants
// ============================================================================

test.describe('AutocompleteAPI - Variants', () => {
  test('MonospaceFont: renders with monospace font', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--monospace-font');
    await expect(page.getByText('Code Repository')).toBeVisible();
  });

  test('RTLDirection: renders with RTL direction', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--rtl-direction');
    const input = page.locator('input').first();
    await expect(input).toBeVisible();
  });

  test('GitHubUserSearch: renders user search variant', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--git-hub-user-search');
    await expect(page.getByText('Search GitHub Users', { exact: true })).toBeVisible();
    await expect(page.getByText('Uses different API endpoint and result paths')).toBeVisible();
  });
});
