---
'@buildpad/cli': minor
---

`add` no longer silently keeps stale copies of already-installed components.
When a requested component or a transitive `registryDependencies` entry is
installed at a version older than the registry's `lastChangedIn` for it:

- **Unmodified copy** (every recorded file matches its install-time sha256, or
  is missing from disk) → refreshed in place automatically, with an info line.
  This makes one-step installs like `add users-routes` pick up updated
  dependencies (e.g. `system-permissions`) instead of leaving the old copy.
- **Locally edited copy** → kept untouched, with a warning that names the
  versions and points at `npx buildpad upgrade <name>` (three-way merge).
  A direct interactive `add <name>` additionally offers an explicit
  discard-and-overwrite prompt.

Up-to-date and pre-tracking (v1 / no install record) components keep the
previous skip behavior. Lib modules are unchanged (they already self-heal on
missing files); content-stale lib modules remain a `buildpad upgrade` concern.
