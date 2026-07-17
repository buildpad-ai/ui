# @buildpad/ui-table

## 1.9.2

### Patch Changes

- 0a7e18d: Resolve vertical scrolling issues on collections table and height/scroll-sync bugs on code input editor.
  - @buildpad/hooks@1.9.2
  - @buildpad/services@1.9.2
  - @buildpad/types@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/hooks@1.9.1
- @buildpad/services@1.9.1
- @buildpad/types@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/hooks@1.9.0
- @buildpad/services@1.9.0
- @buildpad/types@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/hooks@1.8.1
- @buildpad/services@1.8.1
- @buildpad/types@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/hooks@1.8.0
- @buildpad/services@1.8.0
- @buildpad/types@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/hooks@1.8.0
  - @buildpad/types@1.8.0
  - @buildpad/services@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/hooks@1.6.0
- @buildpad/services@1.6.0
- @buildpad/types@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [94604c9]
- Updated dependencies [94604c9]
  - @buildpad/hooks@1.5.0
  - @buildpad/services@1.5.0
  - @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies
  - @buildpad/services@1.4.1
  - @buildpad/hooks@1.4.1
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

- Styling refinements in `VTable`.

## 1.1.0

### Minor Changes

- **Version realignment to 1.x.** Consumer manifests written before per-package versioning recorded component versions as `1.0.0`, while packages were versioned `0.1.x`–`0.2.0` — so `npx buildpad outdated` could never detect updates (`1.0.0 >= 0.2.0`). All packages now release in lockstep from `1.1.0` so the upgrade mechanism works for every existing install.

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
