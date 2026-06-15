# @buildpad/ui-interfaces

## 1.2.0

### Patch Changes

- Styling refinements across interface components (input-hash, system-token, map, shared stories).

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `Input`: the text branch now coerces non-string primitives via `String(value)` instead of rendering an empty input, so numeric values display correctly.
- `InputCode`: non-string values (arrays/objects from `json`/`csv` fields) are normalized to pretty-printed JSON instead of crashing with `.split is not a function`; for structured fields (`type` json/csv or `language="json"`), valid JSON edits emit the parsed value so the stored type is preserved on save, while invalid JSON mid-edit stays editable and emits the raw string. `InputCodeProps.value`/`onChange` widen to `unknown`.
- `SelectDropdownM2O`: option selection and active-option comparison now use the relation's target field (`relatedPrimaryKeyField.field`) instead of unconditionally `item.id`, so relations targeting a unique non-PK column (e.g. a `uri_path`) save and highlight correctly.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
