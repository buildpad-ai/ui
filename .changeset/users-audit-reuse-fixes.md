---
'@buildpad/ui-users': minor
'@buildpad/ui-interfaces': minor
---

Reuse consolidation and error surfacing from the ui-users conventions audit:

- `IconDisplay` moves into `@buildpad/ui-interfaces/select-icon`, driven by
  `SelectIcon`'s full ~190-name icon map (previously ui-users shipped its own
  18-name copy, so most picked icons fell back to a generic glyph in the
  roles/policies lists). The map and picker also gain the security/identity
  names (`shield`, `verified_user`, `admin_panel_settings`, `policy`, `key`,
  `badge`, `supervised_user_circle`, …) under a new "Security & Identity"
  category — including the daas default role/policy icons, which were
  previously not pickable. ui-users re-exports `IconDisplay` unchanged.
- `SystemToken` gains an optional `generate` prop (custom sync/async token
  producer replacing the `/api/utils/random/string` call),
  `data-lpignore`/`data-1p-ignore` password-manager suppression, daas wording
  ("Value Securely Saved", the copy-once notice), and copy feedback via
  notifications. ui-users' `TokenInput` is now a thin wrapper over it
  (client-side `generateToken()`), replacing the previous parallel port;
  `users-management` gains a `system-token` registry dependency.
- The three list managers now share extracted chrome: `SearchInput`,
  `ListFooter` (owns the totalCount/totalPages footer gates), `ListEmptyState`,
  and `RowActionsMenu` — all exported and registry-listed.
- Error surfacing: a failed list load renders a distinct "Failed to load …"
  state plus a red notification instead of masquerading as "no data yet", and
  a failed row delete toasts and keeps the confirm dialog open for retry.
