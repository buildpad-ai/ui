# @buildpad/services

## 2.0.0

### Patch Changes

- @buildpad/types@2.0.0
- @buildpad/utils@2.0.0

## 1.9.3

### Patch Changes

- @buildpad/types@1.9.3
- @buildpad/utils@1.9.3


## 1.9.2

### Patch Changes

- @buildpad/types@1.9.2
- @buildpad/utils@1.9.2

## 1.9.1

### Patch Changes

- @buildpad/types@1.9.1
- @buildpad/utils@1.9.1

## 1.9.0

### Patch Changes

- @buildpad/types@1.9.0
- @buildpad/utils@1.9.0

## 1.8.1

### Patch Changes

- @buildpad/types@1.8.1
- @buildpad/utils@1.8.1

## 1.8.0

### Patch Changes

- @buildpad/types@1.8.0
- @buildpad/utils@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [90dc795]
  - @buildpad/types@1.8.0
  - @buildpad/utils@1.8.0

## 1.6.0

### Patch Changes

- @buildpad/types@1.6.0
- @buildpad/utils@1.6.0

## 1.5.0

### Patch Changes

- @buildpad/types@1.5.0

## 1.4.1

### Patch Changes

- fix(services): initialize `authLoading` to `autoFetchUser` in `DaaSProvider`

  `DaaSProvider` previously initialized `authLoading` to `false`, so during the
  first render window — before `/api/users/me` resolves — consumers observed
  `(authLoading=false, user=null)`, which auth-gated pages read as "signed out",
  flashing a false error before the user loaded. `authLoading` now initializes to
  `autoFetchUser` (identical on server and client, so no hydration mismatch), and
  an `else` branch sets it back to `false` when the provider won't fetch
  (auto-fetch off or no DaaS URL) so it never gets stuck on. The signed-out error
  now only appears once auth genuinely settles with no user.

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

## 0.2.0

### Patch Changes

- Established per-package semver baseline. This package now carries its own independent version tracked via Changesets. Future releases will record component-level changes here so `npx buildpad outdated` and `npx buildpad changelog` can surface the relevant diff.
