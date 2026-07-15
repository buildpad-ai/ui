# @buildpad/utils

## 1.8.1

### Patch Changes

- @buildpad/types@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/types@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/types@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- @buildpad/types@1.4.1

## 1.4.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.1

### Patch Changes

- Released in lockstep; no functional changes.

## 1.3.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.2.0

### Patch Changes

- Released in lockstep; no functional changes.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

### Patch Changes

- `getExplicitInterface`: the explicit `"input"` interface no longer hardcodes `type: "string"`, so the field's actual type (`integer`, `decimal`, …) reaches the `Input` component and numeric fields render as number inputs. Field options can still override `type`.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
