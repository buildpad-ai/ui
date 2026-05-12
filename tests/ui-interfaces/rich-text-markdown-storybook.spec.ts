/**
 * RichTextMarkdown Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces RichTextMarkdown component using Storybook.
 * Markdown editor with WYSIWYG editing and preview modes.
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

test.describe('RichTextMarkdown - Basic Rendering', () => {
  test('Default: renders editor with label', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--default');
    await expect(page.getByText('Content')).toBeVisible();
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
  });

  test('WithValue: renders with pre-populated markdown', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-value');
    await expect(page.getByText('README')).toBeVisible();
    await expect(page.getByText('Project Title')).toBeVisible();
  });

  test('DocumentationStyle: renders documentation with monospace', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--documentation-style');
    await expect(page.getByText('Documentation', { exact: true })).toBeVisible();
    await expect(page.getByText('API Reference')).toBeVisible();
  });

  test('BlogPost: renders blog post with serif font', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--blog-post');
    await expect(page.getByText('Blog Post', { exact: true })).toBeVisible();
    await expect(page.getByText('My First Blog Post')).toBeVisible();
  });
});

// ============================================================================
// Features
// ============================================================================

test.describe('RichTextMarkdown - Features', () => {
  test('WithCodeBlocks: renders code blocks', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-code-blocks');
    await expect(page.getByText('Technical Note')).toBeVisible();
    await expect(page.getByText('Code Examples')).toBeVisible();
  });

  test('CustomToolbar: renders with custom toolbar', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--custom-toolbar');
    await expect(page.getByText('Simple Notes')).toBeVisible();
  });

  test('WithSoftLength: renders with character count', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-soft-length');
    await expect(page.getByText('Summary', { exact: true })).toBeVisible();
  });

  test('TableExample: renders with table content', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--table-example');
    await expect(page.getByText('With Tables')).toBeVisible();
    await expect(page.getByText('Data Table')).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('RichTextMarkdown - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--required');
    await expect(page.getByText('Required Field')).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-error');
    await expect(page.getByText('Please enter valid Markdown content')).toBeVisible();
  });

  test('Disabled: editor is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--disabled');
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();
    // TipTap disabled editor has contenteditable=false
    const content = page.locator('.tiptap, .ProseMirror');
    await expect(content).toHaveAttribute('contenteditable', 'false');
  });
});

// ============================================================================
// Use Cases
// ============================================================================

test.describe('RichTextMarkdown - Use Cases', () => {
  test('ChangelogStyle: renders changelog format', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--changelog-style');
    await expect(page.getByText('Changelog', { exact: true })).toBeVisible();
  });

  test('READMETemplate: renders README template', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--readme-template');
    await expect(page.getByText('README.md')).toBeVisible();
  });
});
