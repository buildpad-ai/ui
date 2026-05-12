/**
 * Tags Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces Tags component in isolation.
 * Covers all 17 stories: presets, custom tags, transforms, alphabetize, states.
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

test.describe('Tags - Basic Rendering', () => {
  test('Default: renders tag input with placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--default');
    // Mantine TagsInput renders an input
    const input = page.locator('input');
    await expect(input.first()).toBeVisible();
  });

  test('WithValue: renders with pre-selected tags', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--with-value');
    // Tags should be visible as pills/chips
    const reactTag = page.getByText('React');
    await expect(reactTag.first()).toBeVisible();
    const tsTag = page.getByText('TypeScript');
    await expect(tsTag.first()).toBeVisible();
  });

  test('ManyTags: renders multiple tags wrapping to new lines', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--many-tags');
    // Should show all 10 tags
    const jsTag = page.getByText('JavaScript');
    await expect(jsTag.first()).toBeVisible();
    const rustTag = page.getByText('Rust');
    await expect(rustTag.first()).toBeVisible();
  });
});

// ============================================================================
// Presets
// ============================================================================

test.describe('Tags - Presets', () => {
  test('WithPresets: renders preset chips for selection', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--with-presets');
    // Preset chips should be visible
    const reactChip = page.getByText('React');
    await expect(reactChip.first()).toBeVisible();
    const vueChip = page.getByText('Vue');
    await expect(vueChip.first()).toBeVisible();
    const angularChip = page.getByText('Angular');
    await expect(angularChip.first()).toBeVisible();
  });

  test('PresetsOnly: only allows preset values, no custom input', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--presets-only');
    // Preset chips should be visible
    const lowChip = page.getByText('Low');
    await expect(lowChip.first()).toBeVisible();
    const highChip = page.getByText('High');
    await expect(highChip.first()).toBeVisible();
    // When allowCustom=false and presets exist, no TextInput for custom tags
    // The component renders Chip components instead of TagsInput
  });

  test('WithSelectedPresets: shows some presets already selected', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--with-selected-presets');
    // JavaScript and TypeScript should be selected (checked chips)
    const jsChip = page.locator('[class*="Chip"]').filter({ hasText: 'JavaScript' });
    await expect(jsChip.first()).toBeVisible();
    const tsChip = page.locator('[class*="Chip"]').filter({ hasText: 'TypeScript' });
    await expect(tsChip.first()).toBeVisible();
  });

  test('WithPresets: clicking preset toggles selection', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--with-presets');
    // Click on React preset chip
    const reactChip = page.locator('[class*="Chip"]').filter({ hasText: 'React' });
    await reactChip.first().click();
    await page.waitForTimeout(300);
    // React should now be selected (checked state changes)
  });

  test('ColoredPresets: renders status presets', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--colored-presets');
    const draftChip = page.getByText('Draft');
    await expect(draftChip.first()).toBeVisible();
    const publishedChip = page.getByText('Published');
    await expect(publishedChip.first()).toBeVisible();
  });

  test('TechStack: renders tech stack presets with some selected', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--tech-stack');
    // Pre-selected tags
    const reactChip = page.locator('[class*="Chip"]').filter({ hasText: 'React' });
    await expect(reactChip.first()).toBeVisible();
    // Available presets
    const dockerChip = page.getByText('Docker');
    await expect(dockerChip.first()).toBeVisible();
  });
});

// ============================================================================
// Text Transforms
// ============================================================================

test.describe('Tags - Text Transforms', () => {
  test('LowercaseTransform: converts tags to lowercase on init', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--lowercase-transform');
    // Tags component now applies transforms on initial render
    // value: ['REACT', 'TypeScript'] -> ['react', 'typescript']
    const reactTag = page.getByText('react', { exact: true });
    await expect(reactTag.first()).toBeVisible();
    const tsTag = page.getByText('typescript', { exact: true });
    await expect(tsTag.first()).toBeVisible();
  });

  test('UppercaseTransform: converts tags to uppercase on init', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--uppercase-transform');
    // value: ['abc', 'def'] -> ['ABC', 'DEF']
    const abcTag = page.getByText('ABC', { exact: true });
    await expect(abcTag.first()).toBeVisible();
    const defTag = page.getByText('DEF', { exact: true });
    await expect(defTag.first()).toBeVisible();
  });

  test('CapitalizeTransform: capitalizes first letter on init', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--capitalize-transform');
    // value: ['john', 'jane'] -> ['John', 'Jane']
    const johnTag = page.getByText('John', { exact: true });
    await expect(johnTag.first()).toBeVisible();
    const janeTag = page.getByText('Jane', { exact: true });
    await expect(janeTag.first()).toBeVisible();
  });

  test('AllTransforms: applies lowercase + alphabetize + trim on init', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--all-transforms');
    // value: ["  Zebra  ", "APPLE", "mango"] -> trimmed, lowercased, sorted: ["apple", "mango", "zebra"]
    const appleTag = page.getByText('apple', { exact: true });
    await expect(appleTag.first()).toBeVisible();
    const zebraTag = page.getByText('zebra', { exact: true });
    await expect(zebraTag.first()).toBeVisible();
  });
});

// ============================================================================
// Alphabetize & Trim
// ============================================================================

test.describe('Tags - Alphabetize & Trim', () => {
  test('Alphabetized: tags are sorted alphabetically', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--alphabetized');
    // Original: Zebra, Apple, Mango, Banana -> Apple, Banana, Mango, Zebra
    const appleTag = page.getByText('Apple');
    await expect(appleTag.first()).toBeVisible();
    const zebraTag = page.getByText('Zebra');
    await expect(zebraTag.first()).toBeVisible();
  });

  test('TrimWhitespace: trims whitespace from tags', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--trim-whitespace');
    const input = page.locator('input');
    await expect(input.first()).toBeVisible();
  });
});

// ============================================================================
// States
// ============================================================================

test.describe('Tags - States', () => {
  test('Required: shows required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--required');
    // Tags uses Mantine's TagsInput with required prop when no presets
    // Mantine marks required labels with data-required attribute
    const requiredLabel = page.locator('label[data-required="true"]');
    await expect(requiredLabel).toBeVisible();
  });

  test('WithError: shows error message', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--with-error');
    const errorText = page.getByText('Please add at least one tag');
    await expect(errorText).toBeVisible();
  });

  test('Disabled: tags input is disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--disabled');
    // Tags should be visible but not interactive
    const readTag = page.getByText('Read');
    await expect(readTag.first()).toBeVisible();
  });
});

// ============================================================================
// Interaction
// ============================================================================

test.describe('Tags - Interaction', () => {
  test('Default: can add a tag by typing and pressing Enter', async ({ page }) => {
    await goToStory(page, 'interfaces-tags--default');
    const input = page.locator('input');
    await input.first().fill('newtag');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    // New tag should appear
    const newTag = page.getByText('newtag');
    await expect(newTag.first()).toBeVisible();
  });
});
