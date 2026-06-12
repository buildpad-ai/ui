# Requirements Document

## Introduction

The downstream app `buildpad-daas` found and fixed three rendering bugs in its vendored buildpad components (spec: `buildpad-daas/.kiro/specs/fix-content-detail-empty-fields/`). Those vendored files carry `@buildpad-origin` headers and were generated from this repository's package sources, so the next `npx @buildpad/cli add --overwrite` would revert the downstream fixes. This spec upstreams the fixes into the package sources here so the registry distributes the corrected components.

The three defects, verified to exist identically in this repository's sources:

1. **Numeric fields render blank** — for fields with an explicit `meta.interface: "input"` and a numeric type (`integer`, `bigInteger`, `float`, `decimal`), `getExplicitInterface` in `packages/utils/src/field-interface-mapper.ts` hardcodes `props.type: "string"`, which overrides the `type: field.type` that `FormFieldInterface` passes, routing numeric values into the `Input` component's TextInput branch where `value={typeof value === 'string' ? value : ''}` discards them.
2. **M2O relations targeting a non-PK column render blank and save the wrong value** — `useRelationM2OItem.loadItem` in `packages/hooks/src/useRelationM2O.ts` always builds the by-id path route `/api/items/<collection>/<value>`, which fails for relations whose `one_primary` is a unique non-PK column (values like a `uri_path` contain unencoded `/` and `:`). `SelectDropdownM2O.tsx` additionally emits `item.id` on selection regardless of the relation's target column.
3. **input-code crashes on non-string values** — `InputCode.tsx` types `value` as `string | null`, but `json`/`csv` fields return real arrays/objects from the API; the line-number computation `(internalValue || '').split('\n')` throws `.split is not a function` and the interface error boundary replaces the editor with a warning. The save side always emits the raw textarea string, so a `json` field would persist as a string.

The downstream fixes are staged (uncommitted) in `buildpad-daas` and serve as the reference diffs. This spec ports them verbatim (adjusted for upstream file layout), extends test coverage, and refreshes the registry artifact so consumers receive the fixes.

## Requirements

### Requirement 1: Numeric values display in input fields

**User Story:** As a consumer-app admin editing a collection item, I want numeric fields rendered by the `input` interface to display their stored values, so that data does not appear lost.

#### Acceptance Criteria

1. WHEN a field has an explicit `meta.interface: "input"` and a numeric type (`integer`, `bigInteger`, `float`, `decimal`) THEN the system SHALL render it as a number input pre-filled with the stored value.
2. WHEN `getExplicitInterface` resolves the explicit `"input"` interface THEN the system SHALL NOT inject a hardcoded `type: "string"` prop, so `FormFieldInterface`'s `type: field.type` survives; field options SHALL still be able to override `type` via the options spread.
3. WHEN a non-null, non-string primitive value reaches the TextInput branch of the `Input` component THEN the system SHALL render its string representation instead of an empty string.
4. WHEN a field's value is `null` or `undefined` THEN the system SHALL render an empty input (existing behavior preserved).
5. WHEN a field has a genuinely string type THEN the type fallback in `getInterfaceForType` SHALL continue to return `type: "string"` (no change to the default fallback path).

### Requirement 2: M2O fields referencing a non-PK column display their selected item

**User Story:** As a consumer-app admin viewing an item whose M2O relation targets a unique non-PK column (e.g. `daas_scope_items.uri_path`), I want the current related item shown in the dropdown, so that I can see which record is linked.

#### Acceptance Criteria

1. WHEN an M2O relation's target field (`relatedPrimaryKeyField.field`) is not `"id"` THEN `useRelationM2OItem.loadItem` SHALL load the selected item via a filter query (`filter={"<targetField>":{"_eq":<value>}}&limit=1`) instead of the `/api/items/<collection>/<id>` path route.
2. WHEN the FK value contains URL-unsafe characters (e.g. `/`, `:`) THEN the system SHALL URL-encode the value in the request (via `URLSearchParams`).
3. WHEN the relation targets the conventional `id` primary key THEN the system SHALL use the existing path lookup unchanged (no regression for id-based M2O fields).
4. WHEN the filter lookup returns zero rows THEN the system SHALL treat the item as not found (`null`), matching today's dangling-FK behavior.

### Requirement 3: M2O selection emits the relation's target column value

**User Story:** As a consumer-app admin assigning a relation via the M2O dropdown, I want the selection to store the relation's target column value, so that FK constraints on non-PK target columns keep working.

#### Acceptance Criteria

1. WHEN a user selects an item in the M2O dropdown (inline or modal layout) THEN the system SHALL emit the value of the relation's target field, not unconditionally `item.id`.
2. WHEN the dropdown renders its options and the modal renders its rows THEN the system SHALL key, compare, and highlight the active option using the relation's target field value.
3. WHEN the relation targets `id` THEN the system SHALL behave identically to the current implementation.

### Requirement 4: input-code interface renders and round-trips non-string values

**User Story:** As a consumer-app admin editing a `json`/`csv` field rendered by the input-code interface, I want the stored value displayed as editable text and saved with its type preserved, so that structured data can be edited without the interface crashing.

#### Acceptance Criteria

1. WHEN a non-string value (array, object, number, boolean) reaches `InputCode` THEN the system SHALL render it as editable text — pretty-printed JSON for arrays/objects — instead of crashing into the error boundary.
2. WHEN the field's value is `null` or `undefined` THEN the system SHALL render an empty editor.
3. WHEN the field is structured (`type` is `json`/`csv`, or `language === 'json'`) and the editor content is valid JSON THEN the system SHALL emit the parsed value so the stored type is preserved on save.
4. WHEN the editor content is invalid JSON mid-edit THEN the system SHALL keep the raw string in the editor without crashing and emit the raw string.
5. WHEN the field is a plain string/text code field THEN the system SHALL emit strings exactly as before.

### Requirement 5: Distribution artifacts stay consistent

**User Story:** As a maintainer, I want the registry artifact and package versions to reflect the changed sources, so that consumers pulling components via the CLI receive the fixes and CI checks pass.

#### Acceptance Criteria

1. WHEN the source files change THEN `packages/registry.json` SHALL be regenerated (`pnpm build:registry`) so per-file `sourceSha256` values match, and `pnpm registry:check` SHALL pass.
2. WHEN the fixes land THEN a changeset SHALL record a patch bump for `@buildpad/ui-interfaces`, `@buildpad/hooks`, and `@buildpad/utils`.
3. WHEN the changed packages build (`pnpm --filter './packages/**' build`) THEN type-checking SHALL pass with the widened `InputCodeProps` types.

### Requirement 6: No regressions in existing behavior

**User Story:** As a maintainer, I want existing component behavior preserved, so that consumers upgrading components see only the bug fixes.

#### Acceptance Criteria

1. WHEN the `Input` component renders password fields THEN the PasswordInput branch SHALL keep its existing string-only value handling.
2. WHEN existing unit tests run (`InputCode`, utils interface tests) THEN they SHALL pass unchanged or be extended — not weakened — to cover the new behavior.
3. WHEN the ported hunks are compared against the downstream staged diffs THEN they SHALL be semantically identical (parity check).
