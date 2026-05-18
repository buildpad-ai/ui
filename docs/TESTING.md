# Testing Guide

Comprehensive testing guide for Buildpad UI Packages.

## Overview

Buildpad UI Packages uses a **two-tier testing strategy**:

1. **Storybook Component Tests** - Isolated component testing (no auth needed)
2. **DaaS E2E Tests** - Integration testing against the hosted DaaS application

This approach provides the best of both worlds: fast, isolated component testing for rapid development, and comprehensive E2E testing for validating real-world usage.

## Quick Start

```bash
# Install dependencies
pnpm install
pnpm exec playwright install chromium

# Option 1: Storybook Tests (Recommended for component development)
pnpm storybook:form          # Start VForm Storybook on port 6006
pnpm storybook:table         # Start VTable Storybook on port 6007
pnpm storybook:interfaces    # Start Interfaces Storybook on port 6005
pnpm test:storybook          # Run Playwright against VForm Storybook
pnpm test:storybook:table    # Run Playwright against VTable Storybook
pnpm test:storybook:interfaces # Run Playwright against Interfaces Storybook

# Option 2: DaaS E2E Tests (Full integration testing)
pnpm test:e2e                # Run against hosted DaaS
pnpm test:e2e:ui             # Interactive Playwright UI
```

## VForm Component Testing

The VForm component has extensive test coverage across both tiers:

### Storybook Stories

**Basic Stories** ([packages/ui-form/src/VForm.stories.tsx](../packages/ui-form/src/VForm.stories.tsx)):
- All field interface types (40+ types)
- Different layouts (full, half, fill widths)
- Form states (loading, disabled, validation errors)
- Create vs Edit modes
- Required fields and validation
- Accessibility features

**DaaS Playground** ([packages/ui-form/src/VForm.daas.stories.tsx](../packages/ui-form/src/VForm.daas.stories.tsx)):
- Connect to real DaaS instance via the storybook-host proxy app
- Fetch actual collection schemas from live API
- Test with real data and field configurations
- Test relational interfaces (M2O, O2M, M2M, M2A) with actual relations
- **Authentication proxy**: Credentials stored in encrypted httpOnly cookie
- **Permission enforcement**: Test field-level filtering based on user permissions

### DaaS Playground Authentication

The playground uses the **storybook-host** Next.js app as an authentication proxy:

1. **Static Tokens** - Enter DaaS URL and static token through the host app's landing page
2. **Encrypted Storage** - Credentials stored in AES-256-GCM encrypted httpOnly cookie
3. **Proxy Mode** - All `/api/*` requests proxied through the host app to DaaS backend

**Setup (Recommended):**

```bash
# Terminal 1: Start the host app (DaaS authentication proxy)
pnpm dev:host

# Terminal 2: Start Storybook
pnpm storybook:form

# 1. Open http://localhost:3000 and enter your DaaS URL + static token
# 2. Navigate to "Forms/VForm DaaS Playground" → "Playground" story
# 3. Select a collection from the dropdown and test
```

This mode forwards all `/api/*` requests from Storybook through Vite's dev proxy to the
Next.js host app, which then proxies to DaaS. No CORS issues in dev or production.

**Permission Enforcement:**
- Enable "Enforce Field Permissions" in the Permission Settings accordion
- Select form action: Create, Update, or Read
- Fields will be filtered based on your actual DaaS permissions

### Generating a Static Token

```bash
# 1. Log into your DaaS instance as admin
# 2. Go to Users → Edit your user
# 3. Scroll to Token field → Click "Generate Token"
# 4. Copy the token (it won't be shown again!)
# 5. Click Save
# 6. Enter the token in the storybook-host landing page
```

### Test Files Organization

```
tests/ui-form/
├── vform-storybook.spec.ts   # Storybook component tests (fast, isolated)
├── vform-daas.spec.ts        # DaaS integration tests (real API)
└── vform.spec.ts             # Full E2E workflow tests (create, edit, validate)

tests/ui-interfaces/
├── autocomplete-api-storybook.spec.ts  # AutocompleteAPI tests (13 tests)
├── boolean-storybook.spec.ts           # Boolean tests (15 tests)
├── collection-item-dropdown-storybook.spec.ts # CollectionItemDropdown tests (17 tests)
├── color-storybook.spec.ts             # Color tests (12 tests)
├── datetime-storybook.spec.ts          # DateTime tests (16 tests)
├── divider-storybook.spec.ts           # Divider tests (13 tests)
├── file-image-storybook.spec.ts        # FileImage tests (15 tests)
├── file-storybook.spec.ts              # File tests (12 tests)
├── files-storybook.spec.ts             # Files tests (12 tests)
├── group-accordion-storybook.spec.ts   # GroupAccordion tests (9 tests)
├── group-detail-storybook.spec.ts      # GroupDetail tests (12 tests)
├── group-raw-storybook.spec.ts         # GroupRaw tests (4 tests)
├── input-block-editor-storybook.spec.ts # InputBlockEditor tests (14 tests)
├── input-code-storybook.spec.ts        # InputCode tests (18 tests)
├── input-storybook.spec.ts             # Input tests (23 tests)
├── list-m2a-storybook.spec.ts          # ListM2A tests (22 tests)
├── list-m2m-storybook.spec.ts          # ListM2M tests (32 tests)
├── select-dropdown-m2o-storybook.spec.ts  # SelectDropdownM2O tests (14 tests)
├── list-o2m-storybook.spec.ts          # ListO2M tests (42 tests)
├── map-storybook.spec.ts               # Map tests (14 tests)
├── notice-storybook.spec.ts            # Notice tests (16 tests)
├── rich-text-html-storybook.spec.ts    # RichTextHTML tests (15 tests)
├── rich-text-markdown-storybook.spec.ts # RichTextMarkdown tests (13 tests)
├── select-dropdown-storybook.spec.ts   # SelectDropdown tests (15 tests)
├── select-icon-storybook.spec.ts       # SelectIcon tests (11 tests)
├── select-multiple-checkbox-storybook.spec.ts # SelectMultipleCheckbox tests (14 tests)
├── select-multiple-checkbox-tree-storybook.spec.ts # SelectMultipleCheckboxTree tests (14 tests)
├── select-multiple-dropdown-storybook.spec.ts # SelectMultipleDropdown tests (11 tests)
├── select-radio-storybook.spec.ts      # SelectRadio tests (12 tests)
├── slider-storybook.spec.ts            # Slider tests (19 tests)
├── tags-storybook.spec.ts              # Tags tests (19 tests)
├── textarea-storybook.spec.ts          # Textarea tests (15 tests)
├── toggle-storybook.spec.ts            # Toggle tests (21 tests)
└── upload-storybook.spec.ts            # Upload tests (14 tests)

tests/ui-table/
└── vtable-storybook.spec.ts  # VTable Storybook component tests (22 tests)

tests/helpers/
└── seed-test-data.ts         # Test data seeding utilities for E2E

tests/
└── auth.setup.ts             # Authentication setup (runs once before E2E)
```

## UI Interfaces Component Testing

The `@buildpad/ui-interfaces` package contains individual field interface components (Input, Textarea, InputCode, Slider, Tags). Each has comprehensive Storybook stories and Playwright tests covering all configuration options.

### Running Interfaces Tests

```bash
# Terminal 1: Start Interfaces Storybook
pnpm storybook:interfaces    # Runs on port 6005

# Terminal 2: Run Playwright tests
pnpm test:storybook:interfaces

# Or run manually
SKIP_WEBSERVER=true STORYBOOK_INTERFACES_URL=http://localhost:6005 \
  npx playwright test tests/ui-interfaces --project=storybook-interfaces
```

### Test Coverage (538 tests across 34 interfaces)

| Interface | Test File | Tests | Coverage |
|-----------|-----------|-------|----------|
| Input | `input-storybook.spec.ts` | 23 | Types, masked, slug, clear, trim, softLength, fonts, icons, states |
| Textarea | `textarea-storybook.spec.ts` | 15 | SoftLength, fonts, autosize, rows, RTL, trim, states |
| InputCode | `input-code-storybook.spec.ts` | 18 | Languages, line numbers, line wrapping, template, states |
| InputBlockEditor | `input-block-editor-storybook.spec.ts` | 14 | Block types, toolbar, content editing, states |
| Slider | `slider-storybook.spec.ts` | 19 | Types, ranges, marks, ticks, sizes, colors, states |
| Tags | `tags-storybook.spec.ts` | 19 | Presets, custom tags, transforms, alphabetize, states |
| Boolean | `boolean-storybook.spec.ts` | 15 | Toggle, labels, colors, default values, states |
| Toggle | `toggle-storybook.spec.ts` | 21 | Switch states, icons, labels, colors, states |
| DateTime | `datetime-storybook.spec.ts` | 16 | Date, time, datetime pickers, formats, states |
| Color | `color-storybook.spec.ts` | 12 | Picker, swatches, opacity, formats, states |
| SelectDropdown | `select-dropdown-storybook.spec.ts` | 15 | Search, custom options, presets, states |
| SelectRadio | `select-radio-storybook.spec.ts` | 12 | Layout, custom values, states |
| SelectMultipleCheckbox | `select-multiple-checkbox-storybook.spec.ts` | 14 | Checkbox groups, other option, states |
| SelectMultipleCheckboxTree | `select-multiple-checkbox-tree-storybook.spec.ts` | 14 | Hierarchical selection, expand/collapse, states |
| SelectMultipleDropdown | `select-multiple-dropdown-storybook.spec.ts` | 11 | Multi-select, search, tags, states |
| SelectIcon | `select-icon-storybook.spec.ts` | 11 | Icon categories, search, preview, states |
| AutocompleteAPI | `autocomplete-api-storybook.spec.ts` | 13 | API search, fonts, RTL, icons, states |
| CollectionItemDropdown | `collection-item-dropdown-storybook.spec.ts` | 17 | Collection selection, search, states |
| File | `file-storybook.spec.ts` | 12 | Upload, preview, remove, states |
| FileImage | `file-image-storybook.spec.ts` | 15 | Image upload, preview, focal point, states |
| Files | `files-storybook.spec.ts` | 12 | Multi-upload, drag & drop, states |
| Upload | `upload-storybook.spec.ts` | 14 | Dropzone, file types, size limits, states |
| Divider | `divider-storybook.spec.ts` | 13 | Horizontal/vertical, titles, icons, states |
| Notice | `notice-storybook.spec.ts` | 16 | Alert types, icons, dismissible, states |
| GroupDetail | `group-detail-storybook.spec.ts` | 12 | Collapsible sections, headers, states |
| GroupAccordion | `group-accordion-storybook.spec.ts` | 9 | Accordion expand/collapse, nested content |
| GroupRaw | `group-raw-storybook.spec.ts` | 4 | Transparent wrapper, inline children |
| Map | `map-storybook.spec.ts` | 14 | Geometry input, coordinates, states |
| RichTextHTML | `rich-text-html-storybook.spec.ts` | 15 | WYSIWYG toolbar, formatting, links, states |
| RichTextMarkdown | `rich-text-markdown-storybook.spec.ts` | 13 | Markdown editing, preview, syntax, states |
| ListM2M | `list-m2m-storybook.spec.ts` | 32 | M2M junction, inline editing, permissions, display templates |
| SelectDropdownM2O | `select-dropdown-m2o-storybook.spec.ts` | 14 | M2O selection, display, states |
| ListO2M | `list-o2m-storybook.spec.ts` | 42 | O2M management, changeset staging, permissions, batch edit, unique FK guard, singleton guard, sortable, nested templates, pagination, states |
| ListM2A | `list-m2a-storybook.spec.ts` | 22 | M2A polymorphic, collection selection, states |

## VTable Component Testing

The VTable component is based on DaaS v-table and includes comprehensive Storybook stories and Playwright tests.

### Storybook Stories

**VTable Stories** ([packages/ui-table/src/VTable.stories.tsx](../packages/ui-table/src/VTable.stories.tsx)) - 18 stories:
- Basic table rendering
- Column sorting (ascending/descending)
- Row selection (single/multiple)
- Column resizing
- Manual row sorting (drag-and-drop)
- Custom cell rendering
- Row actions
- Clickable rows
- Loading/empty states
- Fixed/sticky header
- Inline (bordered) styling
- Full-featured example

**DaaS Playground** ([packages/ui-table/src/VTable.daas.stories.tsx](../packages/ui-table/src/VTable.daas.stories.tsx)):
- Connect to real DaaS instance via the storybook-host proxy app
- Fetch actual collection data from live API
- Test with real columns, sorting, and selection on real data
- Works in production on Amplify (same-origin proxy)

### Running VTable Tests

```bash
# Terminal 1: Start VTable Storybook
pnpm storybook:table    # Runs on port 6007

# Terminal 2: Run Playwright tests
pnpm test:storybook:table

# Or run manually
SKIP_WEBSERVER=true STORYBOOK_TABLE_URL=http://localhost:6007 \\
  npx playwright test tests/ui-table --project=storybook-table
```

### VTable Test Files

| File | Purpose |
|------|---------|
| `tests/ui-table/vtable-storybook.spec.ts` | 22 Playwright tests for VTable Storybook stories |
| `packages/ui-table/src/VTable.stories.tsx` | 18 Storybook story definitions |

## Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Test Infrastructure                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    TIER 1: Storybook Component Tests                     │ │
│  │                       (Isolated, No Auth Required)                       │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │  ┌─────────────────────┐       ┌─────────────────────────────────────┐  │ │
│  │  │  Playwright Tests   │       │  Storybook (localhost:6006)         │  │ │
│  │  │  vform-storybook    │ ────► │  - VForm.stories.tsx                │  │ │
│  │  │  .spec.ts           │       │  - Mocked data/API                  │  │ │
│  │  │                     │       │  - All interface types              │  │ │
│  │  └─────────────────────┘       └─────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    TIER 2: DaaS E2E Tests                                │ │
│  │                   (Integration, Auth Required)                           │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │  ┌─────────────────────┐       ┌─────────────────────────────────────┐  │ │
│  │  │  Playwright Tests   │       │  DaaS Application                   │  │ │
│  │  │  vform-daas.spec.ts │ ────► │  - /users/[id] pages                │  │ │
│  │  │  auth.setup.ts      │       │  - Real Supabase backend            │  │ │
│  │  │                     │       │  - Actual permissions               │  │ │
│  │  └─────────────────────┘       └─────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Tier 1: Storybook Component Tests

### Why Storybook?

- ✅ **Isolated** - Test components without full app
- ✅ **No Auth** - Mocked data, no real API calls
- ✅ **Fast** - Quick iteration during development
- ✅ **All Interface Types** - Test any field configuration
- ✅ **Visual** - See component states visually
- ✅ **DaaS Playground** - Connect to real DaaS and test with actual schemas

### VForm Stories Available

| Story | Description |
|-------|-------------|
| `Basic` | Simple form with title, slug, status |
| `AllFieldTypes` | All interface types: input, textarea, boolean, datetime, select, slider, tags, code |
| `EditMode` | Form with existing values |
| `WithValidationErrors` | Showing validation messages |
| `Disabled` | All fields disabled |
| `Loading` | Loading skeleton state |
| `HalfWidthLayout` | Grid layout demonstration |
| `WithReadonlyFields` | System fields (id, date_created) |
| `RequiredFieldsOnly` | Required field indicators |
| `EmptyForm` | No visible fields message |
| **`Playground` (DaaS)** | **Connect to real DaaS, authenticate, and test permissions** |

### DaaS Playground Features

- **Authentication Display**: Shows current user info and admin badge
- **Login Form**: Authenticate with email/password (JWT)
- **Static Token**: Use environment variable token
- **Permission Settings**: Enable field-level permission filtering
- **Action Selection**: Test create/update/read permissions separately

### Running Storybook Tests

```bash
# Terminal 1: Start Storybook
cd packages/ui-form
pnpm storybook

# Terminal 2: Run tests
pnpm test:storybook

# Or use the root script
pnpm storybook:form    # Start Storybook
pnpm test:storybook    # Run Playwright tests
```

### Test Files

| File | Purpose |
|------|---------|
| `tests/ui-form/vform-storybook.spec.ts` | Playwright tests for Storybook stories |
| `packages/ui-form/src/VForm.stories.tsx` | Storybook story definitions |

## Tier 2: DaaS E2E Tests

### Why DaaS Tests?

- ✅ **Real Integration** - Actual API calls
- ✅ **Authentication** - Test with real users/roles
- ✅ **Permissions** - Verify field-level access
- ✅ **End-to-End** - Full user journey

### Prerequisites

1. **Hosted DaaS** configured in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.buildpad-supabase.xtremax.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_BUILDPAD_DAAS_URL=https://xxx.buildpad-daas.xtremax.com
   ```

2. **Test credentials** in `.env.local`:
   ```env
   TEST_ADMIN_EMAIL=admin@test.com
   TEST_ADMIN_PASSWORD=your-password
   ```

### Running DaaS Tests

```bash
# Run all DaaS E2E tests
pnpm test:e2e

# Run specific test file
pnpm exec playwright test tests/ui-form/vform-daas.spec.ts

# Interactive UI mode
pnpm test:e2e:ui
```

### Test Files

| File | Purpose |
|------|---------|
| `tests/auth.setup.ts` | Saves admin auth state (runs once before E2E) |
| `tests/helpers/seed-test-data.ts` | Test data seeding utilities for E2E tests |
| `tests/ui-form/vform-daas.spec.ts` | Tests VForm in DaaS /users pages (integration) |
| `tests/ui-form/vform.spec.ts` | Complete E2E workflow tests (create, edit, validate) |

## Playwright Configuration

The `playwright.config.ts` defines dual-mode testing with automatic Storybook startup:

```typescript
projects: [
  // Auth setup for DaaS tests
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  
  // DaaS E2E tests (requires auth)
  { 
    name: 'chromium', 
    testIgnore: /.*storybook.*/, 
    dependencies: ['setup'],
    use: { baseURL: DAAS_URL }
  },
  
  // VForm Storybook tests (no auth needed)
  { 
    name: 'storybook', 
    testMatch: /ui-form\/.*storybook.*/, 
    use: { baseURL: STORYBOOK_URL }
  },

  // VTable Storybook tests (no auth needed)
  { 
    name: 'storybook-table', 
    testMatch: /ui-table\/.*storybook.*/, 
    use: { baseURL: STORYBOOK_TABLE_URL }
  },
],

// Auto-start Storybooks for component tests
webServer: [
  {
    command: 'cd packages/ui-form && pnpm storybook --ci',
    url: 'http://localhost:6006',
    reuseExistingServer: !process.env.CI,
  },
  {
    command: 'cd packages/ui-table && pnpm storybook --ci',
    url: 'http://localhost:6007',
    reuseExistingServer: !process.env.CI,
  },
]
```

**Features:**
- ✅ Auto-starts Storybook when running `pnpm test:storybook`
- ✅ Auto-starts VTable Storybook when running `pnpm test:storybook:table`
- ✅ Separates DaaS and Storybook tests by project (4 projects total)
- ✅ Authentication setup runs once before DaaS tests
- ✅ Environment variable configuration for URLs

## Writing New Tests

### Storybook Story Example

```tsx
// packages/ui-form/src/MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { VForm } from './VForm';

const meta: Meta<typeof VForm> = {
  title: 'Forms/VForm',
  component: VForm,
};
export default meta;

export const MyStory: StoryObj<typeof VForm> = {
  render: () => <VForm fields={myFields} />,
};
```

### Storybook Test Example

```typescript
// tests/ui-form/vform-storybook.spec.ts
test('should render my story', async ({ page }) => {
  await page.goto('http://localhost:6006/iframe.html?id=forms-vform--my-story');
  await expect(page.locator('.v-form')).toBeVisible();
});
```

### DaaS Test Example

```typescript
// tests/ui-form/vform-daas.spec.ts
test.describe('VForm in Users', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });
  
  test('should render form', async ({ page }) => {
    await page.goto('/users/some-id');
    await expect(page.getByTestId('dynamic-form')).toBeVisible();
  });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  storybook-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm exec playwright install chromium
      - name: Run Storybook tests
        run: pnpm test:storybook
        # webServer auto-starts Storybook via playwright.config.ts

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm exec playwright install chromium
      - run: pnpm test:e2e
        env:
          NEXT_PUBLIC_BUILDPAD_DAAS_URL: ${{ secrets.DAAS_URL }}
          # Credentials are passed via environment variables
```

## Troubleshooting

### Storybook won't start
```bash
# Clear cache and reinstall
cd packages/ui-form
rm -rf node_modules/.cache storybook-static
pnpm install
pnpm storybook
```

### DaaS tests failing with 401
- Check `.env.local` has correct credentials
- Delete `playwright/.auth/admin.json` and re-run setup:
  ```bash
  rm -rf playwright/.auth
  pnpm exec playwright test tests/auth.setup.ts
  ```
- Verify admin user exists in DaaS with correct email/password

### DaaS Playground connection issues
- Ensure the storybook-host app is running: `pnpm dev:host`
- Check host app connection at `http://localhost:3000`
- Generate a fresh static token in DaaS (tokens may expire)
- Verify DaaS URL includes `https://` prefix
- Check browser console for errors

### Tests timing out
- Increase timeout in test: `test.setTimeout(60000)`
- Check network connection to DaaS
- Verify DaaS is not under heavy load
- For Storybook tests, ensure port 6006 is not in use
- Check network connectivity to DaaS
- Verify Storybook is running on port 6006

## Interface Types Coverage

The Storybook tests cover all major interface types:

| Interface | Story | Test |
|-----------|-------|------|
| `input` | AllFieldTypes | ✅ |
| `input-multiline` | AllFieldTypes | ✅ |
| `boolean` | AllFieldTypes | ✅ |
| `datetime` | AllFieldTypes | ✅ |
| `select-dropdown` | AllFieldTypes | ✅ |
| `slider` | AllFieldTypes | ✅ |
| `tags` | AllFieldTypes | ✅ |
| `input-code` | AllFieldTypes | ✅ |
| Validation errors | WithValidationErrors | ✅ |
| Disabled state | Disabled | ✅ |
| Loading state | Loading | ✅ |
| Field widths | HalfWidthLayout | ✅ |
| Readonly fields | WithReadonlyFields | ✅ |

## CLI Local Testing Guide (Pre-Commit)

Run these steps in order when making changes to the CLI versioning/upgrade infrastructure. Each one targets a specific part of the implementation.

### Step 1 — Unit test suite

```bash
pnpm --filter @buildpad/cli test
```

Expect: 110 tests passing across `checksum`, `transformer-determinism`, `changelog-parser`, `three-way-merge`, `resolver`, `upgrade`, `build-registry`.

### Step 2 — Typecheck + build

```bash
pnpm --filter @buildpad/cli build
pnpm --filter @buildpad/mcp-server build
```

Both must emit zero errors.

### Step 3 — Regenerate registry

```bash
pnpm build:registry
```

Confirm `packages/registry.json` has `"schemaVersion": 2`, a populated `packages` map with 8 entries, per-component `sourceSha256`, `version`, and `lastChangedIn` on each file.

### Step 4 — Create a throwaway consumer project

```bash
mkdir /tmp/bp-test && cd /tmp/bp-test
npm init -y
# Point CLI at the local build (not the published version)
node /path/to/buildpad-ui/packages/cli/dist/index.js init
```

After `init`, check `buildpad.json`:
- `schemaVersion: 2` present
- `components: {}`, `lib: {}`, `packageVersions: {}` all empty maps

### Step 5 — Install a component and verify sha256 recording

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js add input
```

Then inspect `buildpad.json`:
- `components.input.files[0].sha256` must be a 64-char hex string
- `components.input.version` must match `packages["@buildpad/ui-interfaces"].version` in `registry.json`
- `packageVersions["@buildpad/ui-interfaces"]` must be set

Also check the copied file has an `@buildpad-origin` header but **no** `@buildpad-date` line.

### Step 6 — Status (pristine path)

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js status
```

Every file must show `pristine`. Run twice — the result must be identical (regression test for the old volatile-date bug).

### Step 7 — Outdated (no-op path)

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js outdated
```

Should report nothing outdated (the component version == registry version). No crash.

### Step 8 — Simulate a package bump and test outdated

In the monorepo, temporarily bump `packages/ui-interfaces/package.json` version (e.g. `0.1.18` → `0.2.0`), rebuild registry:

```bash
pnpm build:registry
node /path/to/buildpad-ui/packages/cli/dist/index.js outdated
```

`input` should now appear as outdated. Revert the bump after verifying.

### Step 9 — Pristine upgrade (silent overwrite)

With the bumped registry in place:

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js upgrade input --strategy overwrite
```

- File on disk must contain the new content
- No `.new` sibling created
- `buildpad.json` `components.input.version` updated, sha256 refreshed

### Step 10 — Modified file upgrade (new-file path)

Reset, reinstall, then manually edit the copied `input.tsx` (add a comment). Then run:

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js upgrade input --strategy new-file
```

- Original file untouched (your comment still there)
- `input.tsx.new` created with upstream content

### Step 11 — Migration of a v1 consumer

Create a minimal v1 `buildpad.json` (no `schemaVersion`, uses `componentVersions`) then run:

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js migrate
```

Verify:
- `buildpad.json` gains `schemaVersion: 2`
- `components[name].files[].sha256` populated for each previously-installed component
- Consumer files on disk are **not touched**
- Running `status` afterwards shows `pristine`

### Step 12 — Changelog command

```bash
node /path/to/buildpad-ui/packages/cli/dist/index.js changelog @buildpad/ui-interfaces
```

Should fetch and print the `ui-interfaces/CHANGELOG.md` slice. (Requires network; skip if offline and verify the graceful error message instead.)

### Step 13 — MCP server smoke test (optional)

```bash
node /path/to/buildpad-ui/packages/mcp-server/dist/index.js
# In a second terminal, use an MCP client or curl-style test to call:
# list_outdated({ projectPath: "/tmp/bp-test" })
# get_upgrade_plan({ projectPath: "/tmp/bp-test" })
```

Verify JSON shapes match `outdated` CLI output.
