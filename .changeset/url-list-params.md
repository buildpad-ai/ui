---
'@buildpad/hooks': minor
'@buildpad/ui-users': minor
'@buildpad/ui-files': minor
---

List managers persist search, filters, sort, and page in the URL by default.

`UsersManager`, `RolesManager`, `PoliciesManager`, and `FileManager` now mirror
their settled list state into the query string (`?search=…&role=…&status=…`,
`?folder=…`, `?sort=-email&page=2`) via a new framework-free
`useUrlListParams` hook in `@buildpad/hooks` — so a filtered view is
shareable, reload-safe, and observable by URL-level integrations such as the
micro-frontend bridge. Writes go through `history.replaceState` (no history
spam; Next.js ≥ 14.1 reflects them into `useSearchParams`) and ride the
managers' existing 300 ms search debounce, so there is no extra work per
keystroke. Browser Back/Forward and programmatic rewrites (dispatch the
exported `URL_STATE_EVENT`) flow back into component state.

Defaults stay off the URL entirely; deep-linked `?folder=` ids rebuild their
breadcrumb via the new `useFolders().fetchFolder`. Opt out per instance with
`urlParams={false}` (embedded surfaces), or namespace with
`urlParamPrefix="users-"` when two lists share a page.
