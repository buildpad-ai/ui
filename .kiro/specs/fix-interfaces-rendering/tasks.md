# Implementation Plan

- [x] 1. Fix numeric value rendering in the input interface
  - [x] 1.1 Remove hardcoded `type: "string"` from the explicit `"input"` interface mapping
    - In `packages/utils/src/field-interface-mapper.ts` (`getExplicitInterface`, `case "input"` ~line 121), drop the `type: "string"` entry from `props` so `FormFieldInterface`'s `type: field.type` is no longer overridden; keep the `...options` spread; leave the string fallback in `getInterfaceForType` (~line 750) unchanged
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 1.2 Coerce primitives in the Input TextInput branch
    - In `packages/ui-interfaces/src/input/Input.tsx` (~line 227), change `value={typeof value === 'string' ? value : ''}` to `value={value == null ? '' : String(value)}`; leave the PasswordInput branch (~line 212) unchanged
    - _Requirements: 1.3, 1.4, 6.1_
  - [x] 1.3 Add mapper unit test
    - In `packages/utils/tests/`, add a vitest case (style of `interface-registry.test.ts`): explicit `"input"` interface with `type: "integer"` yields no `props.type` override; `meta.options.type` can still override
    - _Requirements: 1.2, 6.2_

- [x] 2. Fix M2O selected-item loading for non-PK target columns
  - [x] 2.1 Add filter-based lookup in `useRelationM2OItem.loadItem`
    - In `packages/hooks/src/useRelationM2O.ts` (~lines 332–342), branch on `pkField` (already derived at line 310): keep the path lookup when `pkField === "id"`; otherwise set `filter={"<pkField>":{"_eq":<value>}}` and `limit=1` on the existing `URLSearchParams` and take `data[0] ?? null` from `/api/items/<col>?<qs>`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Fix M2O option selection to emit the relation target value
  - [x] 3.1 Use the relation key field in `SelectDropdownM2O.tsx`
    - In `packages/ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx`, derive `relationKeyField = relationInfo?.relatedPrimaryKeyField.field ?? "id"` after the combined `loading` state; replace all 8 hardcoded `item.id` usages with `item[relationKeyField]` — Combobox option `key`/`value`/`active` (~lines 432–434) and modal table row key / background comparison / `handleSelect` calls / Selected-button comparisons (~lines 664–692)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Fix input-code crash on non-string values
  - [x] 4.1 Normalize incoming values in `InputCode.tsx`
    - In `packages/ui-interfaces/src/input-code/InputCode.tsx`, add the module-level `toEditorString` helper (null → `''`, string as-is, object/array → `JSON.stringify(v, null, 2)`, other primitives → `String(v)`); use it in the `useState` initializer (~line 78) and the value-sync effect (~line 82)
    - _Requirements: 4.1, 4.2_
  - [x] 4.2 Emit parsed JSON for structured fields in `handleChange`
    - Widen `InputCodeProps` to `value?: unknown` / `onChange?: (value: unknown) => void`, add and destructure a `type?: string` prop; in `handleChange`, when `type === 'json' || type === 'csv' || language === 'json'`, `try { onChange?.(JSON.parse(newValue)) } catch { onChange?.(newValue || null) }`; otherwise keep emitting `newValue || null`
    - _Requirements: 4.3, 4.4, 4.5_
  - [x] 4.3 Extend InputCode unit tests
    - In `packages/ui-interfaces/src/__tests__/InputCode.test.tsx` (jest): array/object value renders pretty-printed JSON without crashing; null renders empty; with `type="json"` valid JSON emits parsed value and invalid JSON emits the raw string; plain string fields still emit strings
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2_

- [x] 5. Verify parity with the downstream reference diffs
  - [x] 5.1 Compare each ported hunk against `git diff --cached` in `/Users/macbook/Documents/DAAS/buildpad-daas` for the five vendored files; confirm semantic identity (only import paths / line positions may differ)
    - _Requirements: 6.3_

- [x] 6. Refresh distribution artifacts and validate
  - [x] 6.1 Rebuild the registry
    - Run `pnpm build:registry` to regenerate `packages/registry.json` (new `sourceSha256` values); confirm `pnpm registry:check` passes; commit the regenerated artifact with the source changes
    - _Requirements: 5.1_
  - [x] 6.2 Add a changeset
    - Add a `.changeset/` entry with a `patch` bump for `@buildpad/ui-interfaces`, `@buildpad/hooks`, and `@buildpad/utils` describing the three fixes
    - _Requirements: 5.2_
  - [x] 6.3 Run tests and builds
    - `pnpm --filter @buildpad/ui-interfaces test` (jest), `pnpm --filter @buildpad/utils test` (vitest), and `pnpm --filter './packages/**' build` all pass
    - _Requirements: 5.3, 6.2_

- [ ] 7. Post-release follow-up (downstream, out of this repo's scope)
  - After the next release, run `npx @buildpad/cli add --overwrite` in `buildpad-daas` for `input`, `input-code`, `select-dropdown-m2o` (and their `hooks`/`utils` internal dependencies) and confirm the vendored files match the fixes — the downstream staged changes can then be reconciled
  - _Requirements: 5.1, 6.3_
