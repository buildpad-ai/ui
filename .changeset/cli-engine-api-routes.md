---
"@buildpad/cli": patch
---

Engine projects (`.buildpad/project.json` `"backend": "engine"`): `bootstrap`, `add api-routes` and every route module that depends on it (`files-routes`, `users-routes`, …) now install `api-routes-engine`, so the Files module works with a non-admin user. `DaaSProviderWrapper` calls the app's own `/api` routes (`url: ""`) instead of the Engine, which refuses credentialed cross-origin requests; new proxy routes `/api/users/me`, `/api/files/signed-url` and `/api/permissions/[collection]` (with `lib/api/forward.ts`); `/api/assets/:id` forwards to the Engine's `/api/files/assets/:id`; the login page has no password-recovery link. `external-oauth-engine` depends on and replaces `api-routes-engine`. An unmodified copy of an earlier `api-routes` install is replaced; `upgrade` does not switch it.

Both backends: the login page uses the Buildpad `Input` with plain state validation instead of `@mantine/form` / `TextInput` / `PasswordInput` (`api-routes` now installs the `input` component), and `/api/assets/:id` passes `Content-Disposition`, `Content-Length`, `ETag` and `Last-Modified` through, so Download saves the file under its name.

Dependency installs in a project with no lockfile use `pnpm add` (as bootstrap's own install step does) instead of `npm install`, so `bootstrap` no longer leaves a `package-lock.json` beside `pnpm-lock.yaml`.
