# Design Document

## Overview

This change ports three verified bug fixes from the downstream `buildpad-daas` app into this repository's package sources. The downstream fixes are staged (uncommitted) in `buildpad-daas` and were verified end-to-end there against a live DaaS instance; the reference diffs are available via:

```sh
cd /Users/macbook/Documents/DAAS/buildpad-daas
git diff --cached -- lib/buildpad/field-interface-mapper.ts components/ui/input.tsx \
  components/ui/input-code.tsx lib/buildpad/hooks/useRelationM2O.ts components/ui/select-dropdown-m2o.tsx
```

All five upstream files contain the identical pre-fix code (same hunks, shifted line numbers), so the diffs port directly.

## Architecture

### File mapping (downstream vendored target → upstream source)

| Downstream (fixed, reference) | Upstream (to fix) |
|---|---|
| `lib/buildpad/field-interface-mapper.ts` | `packages/utils/src/field-interface-mapper.ts` |
| `components/ui/input.tsx` | `packages/ui-interfaces/src/input/Input.tsx` |
| `components/ui/input-code.tsx` | `packages/ui-interfaces/src/input-code/InputCode.tsx` |
| `lib/buildpad/hooks/useRelationM2O.ts` | `packages/hooks/src/useRelationM2O.ts` |
| `components/ui/select-dropdown-m2o.tsx` | `packages/ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx` |

This mapping is exactly what `packages/registry.template.json` declares (sources → targets), so once fixed and the registry is rebuilt, `npx @buildpad/cli add --overwrite` distributes the corrected files.

### Data flow (unchanged — only marked nodes are modified)

```
Consumer app detail page
  └─ CollectionForm → VForm → FormField → FormFieldInterface (packages/ui-form)
       │   passes `type: field.type`, then spreads interfaceConfig.props (lines 271, 280)
       ├─ getFieldInterface (packages/utils/src/field-interface-mapper.ts)        ← FIX 1a
       ├─ Input (packages/ui-interfaces/src/input/Input.tsx)                      ← FIX 1b
       ├─ InputCode (packages/ui-interfaces/src/input-code/InputCode.tsx)         ← FIX 4
       └─ SelectDropdownM2O (packages/ui-interfaces/src/select-dropdown-m2o/)     ← FIX 3
            └─ useRelationM2OItem (packages/hooks/src/useRelationM2O.ts)          ← FIX 2
```

## Components and Interfaces

### Fix 1a — `packages/utils/src/field-interface-mapper.ts` (`getExplicitInterface`, `case "input"`, ~line 121)

Remove the hardcoded `type: "string"` from `props`; keep the `...options` spread:

```ts
case "input":
  return {
    type: "input",
    props: {
      // No hardcoded `type` here — FormFieldInterface passes `type: field.type`
      // so numeric fields (integer/decimal/...) render as NumberInput.
      // Field options may still override `type` via the spread below.
      ...options,
    },
  };
```

Do **not** touch the string fallback in `getInterfaceForType` (~line 747–753) — that path serves genuinely string-typed fields (Requirement 1.5); downstream left it unchanged too.

### Fix 1b — `packages/ui-interfaces/src/input/Input.tsx` (TextInput branch, ~line 227)

```tsx
value={value == null ? '' : String(value)}
```

The PasswordInput branch (~line 212) keeps its string-only handling (Requirement 6.1).

### Fix 2 — `packages/hooks/src/useRelationM2O.ts` (`useRelationM2OItem.loadItem`, ~lines 332–342)

`pkField` is already derived at line 310 (`relationInfo?.relatedPrimaryKeyField.field ?? "id"`). Branch on it:

```ts
let fetched: M2OItem | null;
if (pkField === "id") {
  const qs = queryParams.toString();
  const path = `/api/items/${col}/${primaryKey}${qs ? `?${qs}` : ""}`;
  const response = await apiRequest<{ data: M2OItem }>(path);
  fetched = (response.data ?? null) as M2OItem | null;
} else {
  // The relation targets a non-id column (e.g. daas_scope_items.uri_path).
  // The by-id path route can't resolve those values — and they may contain
  // path-breaking characters like "/" — so look the item up via a filter.
  queryParams.set("filter", JSON.stringify({ [pkField]: { _eq: primaryKey } }));
  queryParams.set("limit", "1");
  const response = await apiRequest<{ data: M2OItem[] }>(
    `/api/items/${col}?${queryParams.toString()}`,
  );
  fetched = (response.data?.[0] ?? null) as M2OItem | null;
}
```

The existing try/catch, inline-data merge, and display-template resolution need no change — `resolveDisplayTemplate` already falls back to `{{<targetField>}}`.

### Fix 3 — `packages/ui-interfaces/src/select-dropdown-m2o/SelectDropdownM2O.tsx`

Derive the relation key once (after the combined `loading` state):

```ts
// The column on the related collection that this relation references.
// Usually "id", but can be a unique non-PK column — selection must
// emit/compare this value, not item.id.
const relationKeyField = relationInfo?.relatedPrimaryKeyField.field ?? "id";
```

Replace the 8 hardcoded `item.id` usages with `item[relationKeyField]`:
- Combobox option `key` / `value` / `active` (~lines 432–434)
- Modal table row `key`, row background comparison, row `handleSelect`, Select-button variant/`handleSelect`/label (~lines 664–692)

`SelectDropdownM2OInterface.tsx` has no `item.id` usage — no change.

### Fix 4 — `packages/ui-interfaces/src/input-code/InputCode.tsx`

Module-level normalizer:

```ts
function toEditorString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v, null, 2); // arrays + objects
  return String(v); // number / boolean
}
```

- Widen props: `value?: unknown`, `onChange?: (value: unknown) => void`; add `type?: string` (passed by `FormFieldInterface`); destructure `type` in the component.
- Use `toEditorString(value)` in the `useState` initializer (~line 78) and the value-sync effect (~line 82) so `internalValue` is always a string and the `.split('\n')` line-number computation is safe unchanged.
- `handleChange`: for structured fields (`type === 'json' || type === 'csv' || language === 'json'`), `try { onChange?.(JSON.parse(newValue)) } catch { onChange?.(newValue || null) }`; otherwise keep emitting `newValue || null`.

## Distribution and Versioning

1. **Registry**: `pnpm build:registry` regenerates `packages/registry.json` (per-file `sourceSha256` of the raw sources). CI verifies via `pnpm registry:check`; the artifact must be committed together with the source changes.
2. **Changesets**: add one changeset with a `patch` bump for `@buildpad/ui-interfaces`, `@buildpad/hooks`, and `@buildpad/utils`, describing the three fixes. (`lastChangedIn` per component is derived from git tags at release time — nothing to do manually.)

## Error Handling

- Filter lookup returning zero rows → `fetched = null` → dropdown shows its placeholder (same as today's dangling-FK behavior).
- `loadItem`'s existing try/catch and inline-data fallback are preserved.
- Invalid JSON mid-edit in `InputCode` emits the raw string; the editor never crashes into `InterfaceErrorBoundary`.
- No API or schema changes; all fixes are client-side component logic.

## Testing Strategy

1. **Unit — InputCode (jest, `packages/ui-interfaces/src/__tests__/InputCode.test.tsx`)**: extend the existing suite —
   - array/object `value` renders pretty-printed JSON, no crash, line numbers reflect the pretty-printed line count;
   - `null`/`undefined` renders an empty editor;
   - with `type="json"`: valid JSON edit emits the parsed value; invalid JSON emits the raw string;
   - without a structured type: edits emit raw strings (unchanged behavior).
2. **Unit — field-interface-mapper (vitest, `packages/utils/tests/`)**: new test asserting that an explicit `"input"` field with `type: "integer"` resolves to `{ type: "input" }` with **no** `props.type` override, and that `meta.options.type` can still override; follow the style of `tests/interface-registry.test.ts`.
3. **Hooks/SelectDropdownM2O**: no unit-test infra in `packages/hooks`; behavior was verified end-to-end downstream (see `buildpad-daas/.kiro/specs/fix-content-detail-empty-fields/tasks.md`, all tasks checked). Parity with the staged downstream diffs is the acceptance check here (Requirement 6.3).
4. **Build/type-check**: `pnpm --filter './packages/**' build` passes with the widened `InputCodeProps`.
5. **Registry**: `pnpm build:registry` then `pnpm registry:check` passes.
6. **Post-release (out of scope for this repo)**: in `buildpad-daas`, run `npx @buildpad/cli add --overwrite` for the five components and confirm the vendored files match the staged fixes — no regression on the next overwrite.
