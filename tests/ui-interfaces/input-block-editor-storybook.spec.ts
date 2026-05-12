/**
 * InputBlockEditor Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces InputBlockEditor component using Storybook.
 * Block-based content editor using EditorJS.
 * 
 * Run: SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6005 npx playwright test --project=storybook-interfaces --reporter=line
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // EditorJS needs more time to initialize
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('InputBlockEditor - Basic Rendering', () => {
  test('Default: renders editor with label', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--default');
    await expect(page.getByText('Content')).toBeVisible();
    // EditorJS renders in a holder div
    const holder = page.locator('.codex-editor');
    await expect(holder).toBeVisible();
  });

  test('WithValue: renders with pre-populated blocks', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-value');
    await expect(page.getByText('Article Content')).toBeVisible();
    await expect(page.getByText('Welcome to the Block Editor')).toBeVisible();
    await expect(page.getByText('Features')).toBeVisible();
  });

  test('WithDescription: renders with description text', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-description');
    await expect(page.getByText('Page Content')).toBeVisible();
    await expect(page.getByText('Build your page using content blocks')).toBeVisible();
  });
});

// ============================================================================
// Content Types
// ============================================================================

test.describe('InputBlockEditor - Content Types', () => {
  test('BlogPost: renders blog post with blocks', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--blog-post');
    await expect(page.getByText('Blog Post', { exact: true })).toBeVisible();
    await expect(page.getByText('My First Blog Post')).toBeVisible();
  });

  test('WithCode: renders code blocks', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-code');
    await expect(page.getByText('Technical Documentation')).toBeVisible();
    await expect(page.getByText('Installation Guide')).toBeVisible();
  });

  test('WithChecklist: renders checklist blocks', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-checklist');
    await expect(page.getByText('Task List')).toBeVisible();
    await expect(page.getByText('Project Checklist')).toBeVisible();
  });

  test('PageBuilder: renders landing page content', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--page-builder');
    await expect(page.getByText('Landing Page', { exact: true })).toBeVisible();
    await expect(page.getByText('Welcome to Our Product')).toBeVisible();
  });
});

// ============================================================================
// Font Variants
// ============================================================================

test.describe('InputBlockEditor - Fonts', () => {
  test('SerifFont: renders with serif font', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--serif-font');
    await expect(page.getByText('Literary Content')).toBeVisible();
  });

  test('MonospaceFont: renders with monospace font', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--monospace-font');
    await expect(page.getByText('Technical Content')).toBeVisible();
  });
});

// ============================================================================
// Configuration
// ============================================================================

test.describe('InputBlockEditor - Configuration', () => {
  test('LimitedTools: renders with limited block types', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--limited-tools');
    await expect(page.getByText('Simple Editor')).toBeVisible();
    await expect(page.getByText('Only headers, paragraphs, and lists available')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('InputBlockEditor - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--required');
    await expect(page.getByText('Required Content')).toBeVisible();
    const asterisk = page.locator('.input-block-editor-required');
    await expect(asterisk).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-error');
    await expect(page.getByText('Content cannot be empty')).toBeVisible();
  });

  test('Disabled: editor is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--disabled');
    await expect(page.getByText('Disabled Editor')).toBeVisible();
    await expect(page.getByText('This content is not editable.')).toBeVisible();
  });

  test('ReadOnly: editor is read-only', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--read-only');
    await expect(page.getByText('Published Content')).toBeVisible();
    await expect(page.getByText('Published Article')).toBeVisible();
  });
});
