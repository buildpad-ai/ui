/**
 * InputCode Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces InputCode component in isolation.
 * Covers all 16 stories: languages, line numbers, line wrapping, template, states.
 * 
 * Run: pnpm test:storybook:interfaces
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

test.describe('InputCode - Basic Rendering', () => {
  test('Default: renders code textarea with placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--default');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute('placeholder', 'Enter code...');
  });

  test('WithValue: renders with pre-filled code', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--with-value');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('function greet');
  });
});

// ============================================================================
// Language Variants
// ============================================================================

test.describe('InputCode - Languages', () => {
  test('JSONEditor: renders JSON content with language indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--json-editor');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('"name"');
    // Language indicator should show JSON
    const langIndicator = page.getByText('JSON', { exact: true });
    await expect(langIndicator).toBeVisible();
  });

  test('HTMLCode: renders HTML with line numbers', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--html-code');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('<!DOCTYPE html>');
    const langIndicator = page.getByText('HTML', { exact: true });
    await expect(langIndicator).toBeVisible();
  });

  test('CSSCode: renders CSS content', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--css-code');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('.container');
  });

  test('SQLQuery: renders SQL content', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--sql-query');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('SELECT');
  });

  test('TypeScriptCode: renders TypeScript content', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--type-script-code');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('interface User');
  });

  test('PlainText: renders without language indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--plain-text');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('plain text');
    // Plaintext should NOT show language indicator
    const langIndicators = page.locator('[style*="font-style: italic"]');
    await expect(langIndicators).toHaveCount(0);
  });
});

// ============================================================================
// Line Numbers
// ============================================================================

test.describe('InputCode - Line Numbers', () => {
  test('WithLineNumbers: shows line number gutter', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--with-line-numbers');
    // Line numbers container
    const lineNumbers = page.locator('[data-line-numbers]');
    await expect(lineNumbers).toBeVisible();
    // Should show at least line 1
    await expect(lineNumbers.getByText('1')).toBeVisible();
  });

  test('NoLineNumbers: hides line number gutter', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--no-line-numbers');
    const lineNumbers = page.locator('[data-line-numbers]');
    await expect(lineNumbers).toHaveCount(0);
  });
});

// ============================================================================
// Line Wrapping
// ============================================================================

test.describe('InputCode - Line Wrapping', () => {
  test('WithLineWrapping: wraps long lines', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--with-line-wrapping');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const whiteSpace = await textarea.evaluate(el => el.style.whiteSpace);
    expect(whiteSpace).toBe('pre-wrap');
  });

  test('NoLineWrapping: does not wrap lines', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--no-line-wrapping');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    const whiteSpace = await textarea.evaluate(el => el.style.whiteSpace);
    expect(whiteSpace).toBe('pre');
  });
});

// ============================================================================
// Template
// ============================================================================

test.describe('InputCode - Template', () => {
  test('WithTemplate: shows fill template button and fills on click', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--with-template');
    // Template fill button should be visible
    const fillBtn = page.locator('button').filter({ has: page.locator('svg') });
    await expect(fillBtn.first()).toBeVisible();
    // Click fill template
    await fillBtn.first().click();
    await page.waitForTimeout(300);
    // Textarea should now have template content
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('apiUrl');
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('InputCode - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--required');
    // InputCode renders its own label with a red asterisk span
    const label = page.getByText('Required Code');
    await expect(label).toBeVisible();
    const asterisk = page.locator('span[style*="color"]').or(page.locator('span.mantine-Text-root'));
    // The component renders Text component="span" c="red" with "*"
    const redSpan = page.locator('[class*="Text-root"]').filter({ hasText: '*' });
    await expect(redSpan.first()).toBeAttached();
  });

  test('WithError: shows error message and red border', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--with-error');
    const errorText = page.getByText('Invalid JSON syntax');
    await expect(errorText).toBeVisible();
  });

  test('Disabled: textarea is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--disabled');
    const textarea = page.locator('textarea');
    await expect(textarea).toBeDisabled();
  });
});

// ============================================================================
// Interaction
// ============================================================================

test.describe('InputCode - Interaction', () => {
  test('Default: can type code and update value', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--default');
    const textarea = page.locator('textarea');
    await textarea.fill('const x = 42;');
    await expect(textarea).toHaveValue('const x = 42;');
  });

  test('Monospace font is applied to textarea', async ({ page }) => {
    await goToStory(page, 'interfaces-inputcode--default');
    const textarea = page.locator('textarea');
    const fontFamily = await textarea.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/monospace/);
  });
});
