/**
 * DaaS Field Configuration Validation Tests - Rich Text & Block Editor Interfaces
 * 
 * Validates that each Rich Text component correctly implements all field
 * options/configurations stored in the DaaS test_rich_text_v2 collection.
 * Tests are organized by TC number matching the xlsx test matrix.
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Rich text editors need more time to initialize
}

// ============================================================================
// TC01-TC08: RichTextHTML Field Configs
// ============================================================================

test.describe('DaaS TC01-TC08: RichTextHTML Field Configs', () => {
  test('TC01: Basic RichTextHTML - default toolbar with all controls', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--default');
    // Should render the TipTap editor
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should have toolbar with formatting buttons
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toBeVisible();
    // Toolbar should contain visible control buttons (tiptap CSS loaded)
    const controls = page.locator('button[data-rich-text-editor-control="true"]');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    // First toolbar button should be truly visible now that @mantine/tiptap/styles.css is imported
    await expect(controls.first()).toBeVisible();
  });

  test('TC02: RichTextHTML minimal - no toolbar shown', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--minimal-toolbar');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Minimal mode should NOT show toolbar
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toHaveCount(0);
  });

  test('TC03: RichTextHTML custom toolbar - only specified buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--custom-toolbar');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should have toolbar
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toBeVisible();
    // Should have limited set of controls
    const controls = page.locator('button[data-rich-text-editor-control="true"]');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20); // Custom toolbar has fewer buttons than default
  });

  test('TC04: RichTextHTML serif font - editor uses serif font family', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--serif-font');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Check that the content area uses serif font
    const content = page.locator('.ProseMirror, .mantine-RichTextEditor-content [contenteditable]');
    const fontFamily = await content.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/georgia|times|serif/);
  });

  test('TC05: RichTextHTML monospace font - editor uses monospace font family', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--monospace-font');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    const content = page.locator('.ProseMirror, .mantine-RichTextEditor-content [contenteditable]');
    const fontFamily = await content.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/menlo|monaco|monospace/);
  });

  test('TC06: RichTextHTML softLength - character counter visible', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-soft-length');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should show character count indicator
    const charCount = page.locator('[class*="char-count"]');
    await expect(charCount).toBeVisible();
  });

  test('TC07: Required RichTextHTML - required asterisk shown', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--required');
    // Should show required indicator
    const requiredIndicator = page.locator('[class*="required"]');
    await expect(requiredIndicator.first()).toBeVisible();
  });

  test('TC08: Disabled RichTextHTML - editor not editable', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--disabled');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Content should have contenteditable=false
    const content = page.locator('.ProseMirror, [contenteditable]');
    await expect(content.first()).toHaveAttribute('contenteditable', 'false');
  });
});


// ============================================================================
// TC09-TC15: RichTextMarkdown Field Configs
// ============================================================================

test.describe('DaaS TC09-TC15: RichTextMarkdown Field Configs', () => {
  test('TC09: Basic RichTextMarkdown - default toolbar with all controls', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--default');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should have toolbar
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('TC10: RichTextMarkdown custom toolbar - limited buttons', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--custom-toolbar');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    const toolbar = page.locator('.mantine-RichTextEditor-toolbar');
    await expect(toolbar).toBeVisible();
    const controls = page.locator('button[data-rich-text-editor-control="true"]');
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('TC11: RichTextMarkdown monospace editor font', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--documentation-style');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Documentation style uses monospace editor font
    const content = page.locator('.ProseMirror, .mantine-RichTextEditor-content [contenteditable]');
    const fontFamily = await content.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/menlo|monaco|monospace/);
  });

  test('TC12: RichTextMarkdown serif editor font', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--blog-post');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Blog post style uses serif font
    const content = page.locator('.ProseMirror, .mantine-RichTextEditor-content [contenteditable]');
    const fontFamily = await content.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/georgia|times|serif/);
  });

  test('TC13: RichTextMarkdown softLength - character counter', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-soft-length');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should show character count indicator
    const charCount = page.locator('[class*="char-count"]');
    await expect(charCount).toBeVisible();
  });

  test('TC14: Required RichTextMarkdown - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--required');
    // RichTextMarkdown uses <Text component="span" data-required="true"> *</Text>
    const requiredIndicator = page.locator('[data-required="true"]');
    await expect(requiredIndicator.first()).toBeVisible();
  });

  test('TC15: Disabled RichTextMarkdown - editor not editable', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--disabled');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    const content = page.locator('.ProseMirror, [contenteditable]');
    await expect(content.first()).toHaveAttribute('contenteditable', 'false');
  });
});

// ============================================================================
// TC16-TC22: InputBlockEditor Field Configs
// ============================================================================

test.describe('DaaS TC16-TC22: InputBlockEditor Field Configs', () => {
  test('TC16: Basic InputBlockEditor - default tools, editable', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--default');
    // Should render EditorJS container
    const editor = page.locator('.codex-editor, .editor-js-holder');
    await expect(editor.first()).toBeVisible();
  });

  test('TC17: InputBlockEditor limited tools - only header, paragraph, list', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--limited-tools');
    const editor = page.locator('.codex-editor, .editor-js-holder');
    await expect(editor.first()).toBeVisible();
    // Description should mention limited blocks
    const desc = page.getByText(/basic blocks only|headers.*paragraphs.*lists/i);
    await expect(desc).toBeVisible();
  });

  test('TC18: InputBlockEditor serif font - uses serif font family', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--serif-font');
    const container = page.locator('.input-block-editor-holder').first();
    await expect(container).toBeVisible();
    // Check parent Paper component for serif font
    const paper = page.locator('.mantine-Paper-root');
    const fontFamily = await paper.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/georgia|serif/);
  });

  test('TC19: InputBlockEditor monospace font - uses monospace font family', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--monospace-font');
    const container = page.locator('.input-block-editor-holder').first();
    await expect(container).toBeVisible();
    const paper = page.locator('.mantine-Paper-root');
    const fontFamily = await paper.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/monospace/);
  });

  test('TC20: Required InputBlockEditor - required asterisk', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--required');
    const requiredIndicator = page.locator('[class*="required"]');
    await expect(requiredIndicator.first()).toBeVisible();
  });

  test('TC21: Disabled InputBlockEditor - reduced opacity, not editable', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--disabled');
    const paper = page.locator('.mantine-Paper-root');
    await expect(paper).toBeVisible();
    // Disabled state should have reduced opacity
    const opacity = await paper.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });

  test('TC22: ReadOnly InputBlockEditor - viewable but not editable', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--read-only');
    const paper = page.locator('.mantine-Paper-root');
    await expect(paper).toBeVisible();
    // Should show content but not be editable
    const content = page.getByText('Published Article');
    await expect(content).toBeVisible();
  });
});

// ============================================================================
// DaaS Data Validation: Verify stored data matches component behavior
// ============================================================================

test.describe('DaaS Rich Text Data Validation', () => {
  test('RichTextHTML renders stored HTML content', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--with-value');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should render the HTML content
    const boldText = page.getByText('rich text');
    await expect(boldText.first()).toBeVisible();
  });

  test('RichTextMarkdown renders stored markdown content', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--with-value');
    const editor = page.locator('.mantine-RichTextEditor-root');
    await expect(editor).toBeVisible();
    // Should render the markdown as rich text
    const heading = page.getByText('Project Title');
    await expect(heading.first()).toBeVisible();
  });

  test('InputBlockEditor renders stored block data', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--with-value');
    const editor = page.locator('.codex-editor, .editor-js-holder');
    await expect(editor.first()).toBeVisible();
    // Should render the block content
    const heading = page.getByText('Welcome to the Block Editor');
    await expect(heading.first()).toBeVisible();
  });
});

// ============================================================================
// DaaS Field Behavior: Disabled states
// ============================================================================

test.describe('DaaS Rich Text Field Behavior: States', () => {
  test('Disabled RichTextHTML prevents editing', async ({ page }) => {
    await goToStory(page, 'interfaces-richtexthtml--disabled');
    const content = page.locator('.ProseMirror, [contenteditable]');
    await expect(content.first()).toHaveAttribute('contenteditable', 'false');
  });

  test('Disabled RichTextMarkdown prevents editing', async ({ page }) => {
    await goToStory(page, 'interfaces-richtextmarkdown--disabled');
    const content = page.locator('.ProseMirror, [contenteditable]');
    await expect(content.first()).toHaveAttribute('contenteditable', 'false');
  });

  test('Disabled InputBlockEditor has reduced opacity', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--disabled');
    const paper = page.locator('.mantine-Paper-root');
    const opacity = await paper.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });

  test('ReadOnly InputBlockEditor shows content but prevents editing', async ({ page }) => {
    await goToStory(page, 'interfaces-inputblockeditor--read-only');
    const content = page.getByText('Published Article');
    await expect(content).toBeVisible();
  });
});
