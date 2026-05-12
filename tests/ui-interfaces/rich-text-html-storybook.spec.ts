/**
 * RichTextHTML Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces RichTextHTML component using Storybook.
 * WYSIWYG HTML editor powered by TipTap with Mantine styling.
 * 
 * Run: SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6005 npx playwright test --project=storybook-interfaces --reporter=line
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

// ============================================================================
// Basic Rendering
// ============================================================================

test.describe('RichTextHTML - Basic Rendering', () => {
  test('Default: renders editor with label and placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--default');
    await expect(page.getByText('Content')).toBeVisible();
    // TipTap editor renders a contenteditable div via Mantine RichTextEditor
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
  });

  test('WithValue: renders with pre-populated HTML content', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-value');
    await expect(page.getByText('Article Content')).toBeVisible();
    await expect(page.getByText('Welcome')).toBeVisible();
    await expect(page.getByText('rich text')).toBeVisible();
  });

  test('WithDescription: renders with description', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-description');
    await expect(page.getByText('Blog Post')).toBeVisible();
  });

  test('FormattedContent: renders complex formatted content', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--formatted-content');
    await expect(page.getByText('Formatted Article')).toBeVisible();
    await expect(page.getByText('Main Title')).toBeVisible();
    await expect(page.getByText('Section Heading')).toBeVisible();
  });
});

// ============================================================================
// Toolbar Variants
// ============================================================================

test.describe('RichTextHTML - Toolbar', () => {
  test('MinimalToolbar: renders with minimal toolbar', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--minimal-toolbar');
    await expect(page.getByText('Simple Editor')).toBeVisible();
    // Minimal mode hides the toolbar
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toHaveCount(0);
  });

  test('CustomToolbar: renders with custom toolbar items', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--custom-toolbar');
    await expect(page.getByText('Custom Toolbar')).toBeVisible();
    // Should have toolbar visible
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toBeVisible();
  });
});

// ============================================================================
// Font Variants
// ============================================================================

test.describe('RichTextHTML - Fonts', () => {
  test('SerifFont: renders with serif font', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--serif-font');
    await expect(page.getByText('Literary Content')).toBeVisible();
    await expect(page.getByText('The quick brown fox')).toBeVisible();
  });

  test('MonospaceFont: renders with monospace font', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--monospace-font');
    await expect(page.getByText('Technical Documentation')).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('RichTextHTML - Features', () => {
  test('WithSoftLength: renders with character count', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-soft-length');
    await expect(page.getByText('Summary', { exact: true })).toBeVisible();
    // Character count element should be present
    const charCount = page.locator('.rich-text-html-char-count');
    await expect(charCount).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('RichTextHTML - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--required');
    await expect(page.getByText('Required Content')).toBeVisible();
    // Required asterisk
    const asterisk = page.locator('.rich-text-html-required');
    await expect(asterisk).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-error');
    await expect(page.getByText('Content is required')).toBeVisible();
  });

  test('Disabled: editor is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--disabled');
    await expect(page.getByText('Disabled Editor')).toBeVisible();
    await expect(page.getByText('This content cannot be edited.')).toBeVisible();
    // TipTap disabled editor has contenteditable=false
    const content = page.locator('.tiptap, .ProseMirror');
    await expect(content).toHaveAttribute('contenteditable', 'false');
  });
});

// ============================================================================
// Use Cases
// ============================================================================

test.describe('RichTextHTML - Use Cases', () => {
  test('BlogEditor: blog post configuration', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--blog-editor');
    await expect(page.getByText('Blog Post Content')).toBeVisible();
  });

  test('EmailTemplate: email composition toolbar', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--email-template');
    await expect(page.getByText('Email Body')).toBeVisible();
  });

  test('ProductDescription: product description editor', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--product-description');
    await expect(page.getByText('Product Description')).toBeVisible();
    await expect(page.getByText('Product Features')).toBeVisible();
  });
});
