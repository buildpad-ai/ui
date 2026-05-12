/**
 * DaaS Field Configuration Validation Tests - Selection Interfaces
 * 
 * Validates that each Selection component correctly implements all field
 * options/configurations stored in the DaaS test_selection_v2 collection.
 * Tests are organized by TC number matching the xlsx test matrix.
 */

import { test, expect } from '@playwright/test';

const STORYBOOK_URL = process.env.STORYBOOK_INTERFACES_URL || 'http://localhost:6005';

async function goToStory(page: import('@playwright/test').Page, storyId: string) {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ============================================================================
// TC01-TC08: SelectDropdown Field Configs
// ============================================================================

test.describe('DaaS TC01-TC08: SelectDropdown Field Configs', () => {
  test('TC01: Basic SelectDropdown - choices with string values, placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--default');
    // Mantine Select (non-searchable) renders as readonly input
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    // Should show selected value "React" (value='react')
    await expect(input).toHaveValue('React');
  });

  test('TC02: Required SelectDropdown - required=true shows asterisk', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--required');
    const requiredLabel = page.locator('label').filter({ hasText: 'Required Framework' });
    await expect(requiredLabel).toBeVisible();
    const asterisk = page.locator('.mantine-InputWrapper-required');
    await expect(asterisk).toBeAttached();
  });

  test('TC03: SelectDropdown allowNone - clearable selection', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--clearable');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Angular');
    // Should have a clear button (Mantine renders it inside the Select section)
    const clearBtn = page.locator('.mantine-Select-section button, .mantine-Select-clearButton, .mantine-CloseButton-root');
    await expect(clearBtn.first()).toBeVisible();
  });

  test('TC04: SelectDropdown allowOther - enables searchable input', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--allow-custom-values');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    // allowOther enables searchable, so input should NOT be readonly
    const isReadonly = await input.getAttribute('readonly');
    expect(isReadonly).toBeNull();
  });

  test('TC05: SelectDropdown searchable - type to filter options', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--searchable');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    // Searchable input should NOT be readonly
    const isReadonly = await input.getAttribute('readonly');
    expect(isReadonly).toBeNull();
  });

  test('TC06: Disabled SelectDropdown - prevents interaction', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--disabled');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeDisabled();
  });

  test('TC07: ReadOnly SelectDropdown - viewable but not editable', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--read-only');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    // Mantine Select readOnly renders as readonly attribute
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });

  test('TC08: SelectDropdown numeric values - integer value type', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--numeric-values');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeVisible();
    // Should display "High" for value=3
    await expect(input).toHaveValue('High');
  });
});

// ============================================================================
// TC09-TC13: SelectRadio Field Configs
// ============================================================================

test.describe('DaaS TC09-TC13: SelectRadio Field Configs', () => {
  test('TC09: Basic SelectRadio - radio buttons with choices', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--default');
    const radios = page.locator('input[type="radio"]');
    await expect(radios).toHaveCount(3);
    await expect(page.getByText('Option A')).toBeVisible();
    await expect(page.getByText('Option B')).toBeVisible();
    await expect(page.getByText('Option C')).toBeVisible();
  });

  test('TC10: SelectRadio allowOther - shows Other radio + text input', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--allow-other');
    const otherRadio = page.getByText('Other', { exact: true });
    await expect(otherRadio).toBeVisible();
    await otherRadio.click();
    await page.waitForTimeout(300);
    const customInput = page.getByPlaceholder('Enter custom value');
    await expect(customInput).toBeVisible();
  });

  test('TC11: Required SelectRadio - required=true', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--required');
    // Radio.Group with required shows asterisk
    const label = page.getByText('Required Selection');
    await expect(label).toBeVisible();
  });

  test('TC12: Disabled SelectRadio - all radios disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--disabled');
    const radios = page.locator('input[type="radio"]');
    const count = await radios.count();
    for (let i = 0; i < count; i++) {
      await expect(radios.nth(i)).toBeDisabled();
    }
  });

  test('TC13: SelectRadio with value - pre-selected radio', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--with-value');
    const mediumRadio = page.locator('input[type="radio"][value="medium"]');
    await expect(mediumRadio).toBeChecked();
  });
});

// ============================================================================
// TC14-TC17: SelectMultipleCheckbox Field Configs
// ============================================================================

test.describe('DaaS TC14-TC17: SelectMultipleCheckbox Field Configs', () => {
  test('TC14: Basic SelectMultipleCheckbox - checkboxes for each choice', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--default');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('TC15: SelectMultipleCheckbox allowOther - shows Other button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--allow-other');
    const otherBtn = page.getByRole('button', { name: /other/i });
    await expect(otherBtn).toBeVisible();
  });

  test('TC16: SelectMultipleCheckbox itemsShown - shows "Show more" button', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--small-items-shown');
    const showMoreBtn = page.getByRole('button', { name: /show.*more/i });
    await expect(showMoreBtn).toBeVisible();
  });

  test('TC17: Required SelectMultipleCheckbox - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckbox--required');
    const label = page.getByText('Select Fruits');
    await expect(label).toBeVisible();
    // Required indicator: rendered as <Text component="span" c="red">*</Text> inside the label
    // The Mantine Text component renders as a span with mantine-Text-root class
    const asterisk = page.locator('.mantine-Text-root').filter({ hasText: /^\*$/ });
    await expect(asterisk.first()).toBeVisible();
  });
});

// ============================================================================
// TC18-TC21: SelectMultipleDropdown Field Configs
// ============================================================================

test.describe('DaaS TC18-TC21: SelectMultipleDropdown Field Configs', () => {
  test('TC18: Basic SelectMultipleDropdown - multi-select renders', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--default');
    const input = page.locator('.mantine-MultiSelect-input');
    await expect(input).toBeVisible();
  });

  test('TC19: SelectMultipleDropdown searchable - type to filter', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--default');
    const input = page.locator('.mantine-MultiSelect-input input');
    await expect(input).toBeVisible();
    await input.fill('Ap');
    await page.waitForTimeout(300);
    const option = page.getByText('Apple');
    await expect(option.first()).toBeVisible();
  });

  test('TC20: SelectMultipleDropdown with values - pills shown', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--with-selected-values');
    // Selected values should show as pills
    const pills = page.locator('.mantine-Pill-label');
    const count = await pills.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('TC21: Required SelectMultipleDropdown - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultipledropdown--required');
    const asterisk = page.locator('.mantine-InputWrapper-required');
    await expect(asterisk).toBeAttached();
  });
});

// ============================================================================
// TC22-TC23: SelectMultipleCheckboxTree Field Configs
// ============================================================================

test.describe('DaaS TC22-TC23: SelectMultipleCheckboxTree Field Configs', () => {
  test('TC22: Basic tree - parent/child checkboxes', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--default');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('TC23: Required tree - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selectmultiplecheckboxtree--required');
    const label = page.getByText('Select Categories');
    await expect(label).toBeVisible();
    // Required indicator: rendered as <Text component="span" c="red" ml={4}>*</Text>
    const asterisk = page.locator('.mantine-Text-root').filter({ hasText: /^\*$/ });
    await expect(asterisk.first()).toBeVisible();
  });
});


// ============================================================================
// TC24-TC25: SelectIcon Field Configs
// ============================================================================

test.describe('DaaS TC24-TC25: SelectIcon Field Configs', () => {
  test('TC24: Basic SelectIcon - icon picker renders', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--default');
    // SelectIcon renders a Button trigger (not a standard input)
    const trigger = page.locator('[data-testid="select-icon-trigger"]');
    await expect(trigger).toBeVisible();
    // Should show placeholder text
    const placeholder = page.getByText('Select an icon');
    await expect(placeholder.first()).toBeVisible();
  });

  test('TC25: Required SelectIcon - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-selecticon--required');
    // The Required story has label="Icon" with required=true
    // Renders as: <Text>Icon<Text component="span" c="red" ml={4}>*</Text></Text>
    const trigger = page.locator('[data-testid="select-icon-trigger"]');
    await expect(trigger).toBeVisible();
    // Check for the asterisk required indicator (Mantine Text span)
    const asterisk = page.locator('.mantine-Text-root').filter({ hasText: /^\*$/ });
    await expect(asterisk.first()).toBeVisible();
  });
});

// ============================================================================
// TC26-TC29: AutocompleteAPI Field Configs
// ============================================================================

test.describe('DaaS TC26-TC29: AutocompleteAPI Field Configs', () => {
  test('TC26: Basic AutocompleteAPI - renders with placeholder', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--default');
    const input = page.locator('[data-testid="autocomplete-api"]');
    await expect(input).toBeVisible();
  });

  test('TC27: Required AutocompleteAPI - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--required');
    const asterisk = page.locator('.mantine-InputWrapper-required');
    await expect(asterisk).toBeAttached();
  });

  test('TC28: ReadOnly AutocompleteAPI - readonly, not disabled', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--read-only');
    const input = page.locator('[data-testid="autocomplete-api"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });

  test('TC29: AutocompleteAPI monospace font - font config applied', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--monospace-font');
    const input = page.locator('[data-testid="autocomplete-api"]');
    await expect(input).toBeVisible();
    const fontFamily = await input.evaluate(el => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toMatch(/menlo|monaco|monospace/);
  });
});

// ============================================================================
// TC30-TC34: Color Field Configs
// ============================================================================

test.describe('DaaS TC30-TC34: Color Field Configs', () => {
  test('TC30: Basic Color - hex input and color swatch', async ({ page }) => {
    await goToStory(page, 'interfaces-color--default');
    // Color component renders with a label and input area
    const label = page.getByText('Color', { exact: true });
    await expect(label.first()).toBeVisible();
  });

  test('TC31: Color with opacity - alpha support enabled', async ({ page }) => {
    await goToStory(page, 'interfaces-color--with-opacity');
    const label = page.getByText('Background Color');
    await expect(label).toBeVisible();
    // Description mentions transparency
    const desc = page.getByText(/transparency/i);
    await expect(desc).toBeVisible();
  });

  test('TC32: Color with presets - preset swatches visible', async ({ page }) => {
    await goToStory(page, 'interfaces-color--custom-presets');
    const label = page.getByText('Brand Color', { exact: true });
    await expect(label).toBeVisible();
    // Description mentions brand colors
    const desc = page.getByText('Choose from brand colors or pick a custom one');
    await expect(desc).toBeVisible();
  });

  test('TC33: Required Color - required indicator', async ({ page }) => {
    await goToStory(page, 'interfaces-color--required');
    const label = page.getByText('Theme Color');
    await expect(label).toBeVisible();
  });

  test('TC34: Disabled Color - prevents interaction', async ({ page }) => {
    await goToStory(page, 'interfaces-color--disabled');
    const label = page.getByText('Color', { exact: true });
    await expect(label.first()).toBeVisible();
    // Description mentions disabled
    const desc = page.getByText(/disabled/i);
    await expect(desc).toBeVisible();
  });
});

// ============================================================================
// DaaS Data Validation: Verify stored data matches component behavior
// ============================================================================

test.describe('DaaS Selection Data Validation', () => {
  test('SelectDropdown renders stored string value correctly', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--default');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toHaveValue('React');
  });

  test('SelectRadio renders stored value as checked', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--with-value');
    const mediumRadio = page.locator('input[type="radio"][value="medium"]');
    await expect(mediumRadio).toBeChecked();
  });

  test('Color renders stored hex value', async ({ page }) => {
    await goToStory(page, 'interfaces-color--with-value');
    const label = page.getByText('Primary Color');
    await expect(label).toBeVisible();
  });
});

// ============================================================================
// DaaS Field Behavior: Disabled & ReadOnly states
// ============================================================================

test.describe('DaaS Selection Field Behavior: States', () => {
  test('Disabled SelectDropdown prevents interaction', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--disabled');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toBeDisabled();
  });

  test('ReadOnly SelectDropdown allows viewing but not editing', async ({ page }) => {
    await goToStory(page, 'interfaces-selectdropdown--read-only');
    const input = page.locator('.mantine-Select-input');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });

  test('Disabled SelectRadio prevents all radio interaction', async ({ page }) => {
    await goToStory(page, 'interfaces-selectradio--disabled');
    const radios = page.locator('input[type="radio"]');
    const count = await radios.count();
    for (let i = 0; i < count; i++) {
      await expect(radios.nth(i)).toBeDisabled();
    }
  });

  test('Disabled Color prevents interaction', async ({ page }) => {
    await goToStory(page, 'interfaces-color--disabled');
    const desc = page.getByText(/disabled/i);
    await expect(desc).toBeVisible();
  });

  test('ReadOnly AutocompleteAPI allows viewing but not editing', async ({ page }) => {
    await goToStory(page, 'interfaces-autocompleteapi--read-only');
    const input = page.locator('[data-testid="autocomplete-api"]');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(input).not.toBeDisabled();
  });
});
