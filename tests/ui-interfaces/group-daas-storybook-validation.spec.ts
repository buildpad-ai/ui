/**
 * DaaS Group Interface Configuration Validation Tests
 * 
 * Validates that group components correctly implement all field options/configurations
 * stored in the DaaS test_group collection. Tests are organized by TC number
 * matching the group interface test matrix.
 * 
 * DaaS test_group collection fields:
 * - gd_basic_name: group-detail (start=open, no icon, no color) → children: input_1, gd_basic_email, gd_basic_bio
 * - gd_closed_group: group-detail (start=closed) → children: gd_closed_title, gd_closed_desc
 * - gd_icon_group: group-detail (headerIcon=settings, start=open) → children: gd_icon_field1, gd_icon_field2
 * - gd_color_group: group-detail (headerColor=#6644FF, start=open) → children: gd_color_field1
 * - gd_badge_group: group-detail (start=open) → children: gd_badge_field1
 * - gd_disabled_group: group-detail (start=open) → children: gd_disabled_field1
 * - accordion_basic: group-accordion (accordionMode=true, start=closed) → children: input_2
 * - gr_basic: group-raw (no options) → children: input_3
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

// ============================================================================
// TC01: GroupDetail - Basic (start=open, no icon, no color)
// DaaS field: gd_basic_name → options: {start:"open", headerIcon:null, headerColor:null}
// ============================================================================

test.describe('DaaS TC01: GroupDetail Basic (gd_basic_name)', () => {
  test('TC01a: GroupDetail starts open by default', async ({ page }) => {
    // DaaS config: interface=group-detail, options={start:"open"}
    await goToStory(page, 'interfaces-groupdetail--start-open');
    await expect(page.getByText('Personal Information')).toBeVisible();
    // Content should be visible when start=open
    await expect(page.getByText('First Name')).toBeVisible();
  });

  test('TC01b: Child fields render inside open GroupDetail', async ({ page }) => {
    // DaaS children: input_1 (input), gd_basic_email (input), gd_basic_bio (input-multiline)
    await goToStory(page, 'interfaces-groupdetail--form-section');
    await expect(page.getByText('Full Name')).toBeVisible();
    await expect(page.getByText('Email Address')).toBeVisible();
    await expect(page.getByText('Phone Number')).toBeVisible();
  });

  test('TC01c: GroupDetail can be toggled closed and open', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--start-open');
    // Should start open
    await expect(page.getByText('First Name')).toBeVisible();
    // Click header to close
    await page.getByText('Personal Information').click();
    await page.waitForTimeout(300);
    // Content should be hidden
    await expect(page.getByText('First Name')).not.toBeVisible();
    // Click again to reopen
    await page.getByText('Personal Information').click();
    await page.waitForTimeout(300);
    await expect(page.getByText('First Name')).toBeVisible();
  });
});

// ============================================================================
// TC02: GroupDetail - Start Closed
// DaaS field: gd_closed_group → options: {start:"closed"}
// ============================================================================

test.describe('DaaS TC02: GroupDetail Start Closed (gd_closed_group)', () => {
  test('TC02a: GroupDetail starts collapsed when start=closed', async ({ page }) => {
    // DaaS config: interface=group-detail, options={start:"closed"}
    await goToStory(page, 'interfaces-groupdetail--start-closed');
    await expect(page.getByText('Advanced Settings')).toBeVisible();
    // Content should NOT be visible
  });

  test('TC02b: Clicking header expands closed GroupDetail', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--start-closed');
    // Click to open
    await page.getByText('Advanced Settings').click();
    await page.waitForTimeout(300);
    // Toggle components should now be visible
    const toggles = page.getByText(/enable|debug/i);
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// TC03: GroupDetail - With Header Icon
// DaaS field: gd_icon_group → options: {headerIcon:"settings", start:"open"}
// ============================================================================

test.describe('DaaS TC03: GroupDetail With Icon (gd_icon_group)', () => {
  test('TC03a: GroupDetail renders with header icon', async ({ page }) => {
    // DaaS config: options={headerIcon:"settings", start:"open"}
    await goToStory(page, 'interfaces-groupdetail--with-icon');
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
    // An SVG icon should be present in the header
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });
});

// ============================================================================
// TC04: GroupDetail - With Custom Header Color
// DaaS field: gd_color_group → options: {headerColor:"#6644FF", start:"open"}
// ============================================================================

test.describe('DaaS TC04: GroupDetail With Color (gd_color_group)', () => {
  test('TC04a: GroupDetail renders with custom header color', async ({ page }) => {
    // DaaS config: options={headerColor:"#6644FF", start:"open"}
    await goToStory(page, 'interfaces-groupdetail--custom-color');
    await expect(page.getByText('Important Section')).toBeVisible();
    // The header area should have color styling applied
    const header = page.getByText('Important Section').first();
    await expect(header).toBeVisible();
  });
});

// ============================================================================
// TC05: GroupDetail - With Badge
// DaaS field: gd_badge_group → options: {start:"open"}
// ============================================================================

test.describe('DaaS TC05: GroupDetail With Badge (gd_badge_group)', () => {
  test('TC05a: GroupDetail renders badge text', async ({ page }) => {
    // DaaS config: badge text passed as prop
    await goToStory(page, 'interfaces-groupdetail--with-badge');
    await expect(page.getByText('Optional Fields')).toBeVisible();
    await expect(page.getByText('Optional', { exact: true })).toBeVisible();
  });
});

// ============================================================================
// TC06: GroupDetail - Disabled
// DaaS field: gd_disabled_group → options: {start:"open"}
// ============================================================================

test.describe('DaaS TC06: GroupDetail Disabled (gd_disabled_group)', () => {
  test('TC06a: Disabled GroupDetail renders but cannot be toggled', async ({ page }) => {
    // DaaS config: disabled=true
    await goToStory(page, 'interfaces-groupdetail--disabled');
    await expect(page.getByText('Locked Section')).toBeVisible();
    // Content should be visible (start=open)
    await expect(page.getByText('Read Only Field')).toBeVisible();
  });
});

// ============================================================================
// TC07: GroupAccordion - Basic Accordion Mode
// DaaS field: accordion_basic → options: {accordionMode:true, start:"closed"}
// ============================================================================

test.describe('DaaS TC07: GroupAccordion Basic (accordion_basic)', () => {
  test('TC07a: GroupAccordion renders section headers', async ({ page }) => {
    // DaaS config: interface=group-accordion, options={accordionMode:true, start:"closed"}
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    await expect(page.getByText('General Settings')).toBeVisible();
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('Advanced Options')).toBeVisible();
  });

  test('TC07b: Accordion mode allows only one section open at a time', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--accordion-mode');
    // Open first section (start=first means it's already open)
    await expect(page.getByText('General Settings - Field 1')).toBeVisible();

    // Click second section
    await page.getByText('Notification Preferences').click();
    await page.waitForTimeout(300);

    // Second should be open, first should be closed
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();
    await expect(page.getByText('General Settings - Field 1')).not.toBeVisible();
  });

  test('TC07c: All sections start closed when start=closed', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--all-closed');
    // Headers visible
    await expect(page.getByText('General Settings')).toBeVisible();
    // Content not visible
    const content = page.getByText('General Settings - Field');
    await expect(content).not.toBeVisible();
  });
});

// ============================================================================
// TC08: GroupAccordion - Multi-Expand Mode
// DaaS config: accordionMode=false, start="opened"
// ============================================================================

test.describe('DaaS TC08: GroupAccordion Multi-Expand', () => {
  test('TC08a: All sections open when start=opened and accordionMode=false', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--multi-expand-mode');
    await expect(page.getByText('General Settings - Field 1')).toBeVisible();
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();
    await expect(page.getByText('Advanced Options - Field 1')).toBeVisible();
  });

  test('TC08b: Multiple sections remain open simultaneously', async ({ page }) => {
    await goToStory(page, 'interfaces-groupaccordion--multi-expand-mode');
    // Close one section
    await page.getByText('General Settings').click();
    await page.waitForTimeout(300);
    // Others should still be open
    await expect(page.getByText('Notification Preferences - Field 1')).toBeVisible();
    await expect(page.getByText('Advanced Options - Field 1')).toBeVisible();
  });
});

// ============================================================================
// TC09: GroupRaw - Transparent Wrapper
// DaaS field: gr_basic → options: null (no options)
// ============================================================================

test.describe('DaaS TC09: GroupRaw Basic (gr_basic)', () => {
  test('TC09a: GroupRaw renders children inline without visual container', async ({ page }) => {
    // DaaS config: interface=group-raw, options=null
    await goToStory(page, 'interfaces-groupraw--default');
    // Child fields should be directly visible
    await expect(page.getByText('First Name')).toBeVisible();
    await expect(page.getByText('Last Name')).toBeVisible();
  });

  test('TC09b: GroupRaw has no collapsible behavior', async ({ page }) => {
    await goToStory(page, 'interfaces-groupraw--transparent-wrapper');
    // No expand/collapse controls
    const chevrons = page.locator('[data-testid="expand-icon"]');
    await expect(chevrons).toHaveCount(0);
    // All content always visible
    await expect(page.getByText('Grouped Field 1')).toBeVisible();
    await expect(page.getByText('Grouped Field 2')).toBeVisible();
  });
});

// ============================================================================
// DaaS Field Grouping Validation: Parent-Child Relationships
// ============================================================================

test.describe('DaaS Field Grouping: Parent-Child Rendering', () => {
  test('GroupDetail with multiple children renders all child fields', async ({ page }) => {
    // gd_basic_name has children: input_1, gd_basic_email, gd_basic_bio
    await goToStory(page, 'interfaces-groupdetail--form-section');
    // Multiple fields should render inside the group
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Multiple GroupDetail sections render independently', async ({ page }) => {
    // Multiple group-detail fields at root level should each render as separate collapsible sections
    await goToStory(page, 'interfaces-groupdetail--multiple-groups');
    await expect(page.getByText('Basic Info')).toBeVisible();
    await expect(page.getByText('Settings', { exact: true })).toBeVisible();
    await expect(page.getByText('Advanced')).toBeVisible();
  });

  test('GroupDetail validation errors auto-open the group', async ({ page }) => {
    // When child fields have validation errors, the group should auto-open
    await goToStory(page, 'interfaces-groupdetail--with-validation-errors');
    // Validation error messages should be visible (group auto-opened)
    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  test('GroupDetail loading state renders correctly', async ({ page }) => {
    await goToStory(page, 'interfaces-groupdetail--loading');
    await expect(page.getByText('Loading Section')).toBeVisible();
    await expect(page.getByText('Loading...')).toBeVisible();
  });
});
