---
'@buildpad/hooks': minor
'@buildpad/ui-users': minor
'@buildpad/ui-files': minor
'@buildpad/cli': minor
---

List managers persist search, filters, sort, and page in the URL by default.

`UsersManager`, `RolesManager`, `PoliciesManager`, and `FileManager` now mirror
their settled list state into the query string (`?search=…&role=…&status=…`,
`?folder=…`, `?sort=-email&page=2`) via a new `useUrlListParams` hook in
`@buildpad/hooks` — so a filtered view is shareable, reload-safe, and
observable by URL-level integrations such as the micro-frontend bridge.
Writes ride the managers' existing 300 ms search debounce, so there is no
extra work per keystroke; browser Back/Forward and programmatic rewrites
(dispatch the exported `URL_STATE_EVENT`) flow back into component state.

**Next.js App Router apps must register a URL writer.** The hook has no
framework imports (it must keep rendering in Storybook), so it writes through
whatever the app registers with `registerUrlStateWriter`. The updated
`DaaSProviderWrapper` template registers `router.replace`; without it the hook
falls back to native `history.replaceState`, which the App Router ignores
(`useSearchParams` never updates) and re-asserts its own URL over (observed on
Next 16) — the parameters silently vanish. If you have customised
`DaaSProviderWrapper`, add the registration by hand; in development the hook
warns once when it detects Next.js and no writer. Consumers on `@/lib/buildpad/hooks`
get the new exports from the regenerated barrel (`useUrlListParams`,
`useHydrated`, `readUrlParam`, `readUrlIntParam`, `registerUrlStateWriter`,
`URL_STATE_EVENT`).

The managers are client-gated (`useHydrated`) while URL persistence is on:
seeding state from the URL in `useState` initialisers would otherwise render
differently on the server and the client, a hydration mismatch on every deep
link. Until hydration they render the same loading shell they showed before
their first fetch, so nothing meaningful is lost from server output.

Two url-synced lists on one page (`urlParamPrefix`) merge additively even
through an asynchronous router writer: the hook merges into the query it last
asked to be written, not into a `location.search` that has not caught up yet.

Defaults stay off the URL entirely; deep-linked `?folder=` ids rebuild their
breadcrumb via the new `useFolders().fetchFolder`. Opt out per instance with
`urlParams={false}` (embedded surfaces), or namespace with
`urlParamPrefix="users-"` when two lists share a page.
