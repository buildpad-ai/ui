# @buildpad/hooks

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `useRelationM2OItem.loadItem`: when the relation targets a non-`id` column, the selected item is loaded via a filter query (`filter[<targetField>][_eq]=<value>&limit=1`) instead of the by-id path route, which failed for values containing `/` or `:` (e.g. a `uri_path`). Relations targeting `id` are unchanged.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
