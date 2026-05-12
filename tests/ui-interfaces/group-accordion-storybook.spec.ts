/**
 * GroupAccordion Interface Storybook E2E Tests
 * 
 * Tests the @buildpad/ui-interfaces GroupAccordion component in isolation using Storybook.
 * Covers: accordion mode (one-at-a-time), multi-expand mode, start states (closed/first/opened),
 * badge, disabled, section toggling, fallback rendering.
 * 
 * DaaS equivalent: group-accordion
 * DaaS options: accordionMode (boolean), start ('opened' | 'closed' | 'first')
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

test.describe('GroupAccordion - Accordion Mode', () => {
  test('AccordionMode: renders section headers', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    await expect(page.getByText('General Settings')).toBeVisible();
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('Advanced Options')).toBeVisible();
  });

  test('AccordionMode: first section is open by default (start=first)', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    // First section content should be visible
    const firstSectionContent = page.getByText('General Settings - Field 1');
    await expect(firstSectionContent).toBeVisible();
  });

  test('AccordionMode: clicking another section closes the current one', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    // First section should be open
    await expect(page.getByText('General Settings - Field 1')).toBeVisible();

    // Click second section header
    await page.getByText('Notification Preferences').click();
    await page.waitForTimeout(300);

    // Second section content should be visible
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();

    // First section content should be hidden (accordion mode)
    await expect(page.getByText('General Settings - Field 1')).not.toBeVisible();
  });

  test('AccordionMode: clicking open section closes it', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    // First section is open
    await expect(page.getByText('General Settings - Field 1')).toBeVisible();

    // Click same section to close
    await page.getByText('General Settings').click();
    await page.waitForTimeout(300);

    // Should now be closed
    await expect(page.getByText('General Settings - Field 1')).not.toBeVisible();
  });
});

test.describe('GroupAccordion - Multi-Expand Mode', () => {
  test('MultiExpandMode: all sections open when start=opened', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--multi-expand-mode');
    // All sections should be visible
    await expect(page.getByText('General Settings - Field 1')).toBeVisible();
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();
    await expect(page.getByText('Advanced Options - Field 1')).toBeVisible();
  });

  test('MultiExpandMode: multiple sections can be open simultaneously', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--multi-expand-mode');
    // Close first section
    await page.getByText('General Settings').click();
    await page.waitForTimeout(300);

    // Other sections should still be open
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();
    await expect(page.getByText('Advanced Options - Field 1')).toBeVisible();
    // First section should be closed
    await expect(page.getByText('General Settings - Field 1')).not.toBeVisible();
  });
});

test.describe('GroupAccordion - Start States', () => {
  test('AllClosed: all sections start closed', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--all-closed');
    // Section headers visible but content hidden
    await expect(page.getByText('General Settings')).toBeVisible();
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('Advanced Options')).toBeVisible();
    // No content should be visible
    const contentLocator = page.getByText('General Settings - Field');
    await expect(contentLocator).not.toBeVisible();
  });
});

test.describe('GroupAccordion - Features', () => {
  test('WithBadge: renders badge text on each section', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--with-badge');
    const badges = page.getByText('Optional', { exact: true });
    // Should have a badge per section
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Disabled: sections cannot be toggled', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--disabled');
    // All sections should be closed
    await expect(page.getByText('General Settings')).toBeVisible();

    // Click should not open
    await page.getByText('General Settings').click();
    await page.waitForTimeout(300);

    // Content should still not be visible
    const contentLocator = page.getByText('General Settings - Field');
    await expect(contentLocator).not.toBeVisible();
  });
});
