---
"@buildpad/cli": patch
"@buildpad/mcp": patch
---

Installing a registry entry on its own now installs everything its files import.

- `add users-management` installs `vtable`: the users, roles and policies tables import it, so a project without it failed to compile.
- `add content-routes` installs `content-layout`, `content-navigation`, `collection-list` and `collection-form`, which its pages import.
- `api-routes` depends on the `hooks` lib module: `components/DaaSProviderWrapper.tsx` imports `@/lib/buildpad/hooks`. A project that already has `api-routes` but not `hooks` gets it from `buildpad upgrade api-routes` (or `upgrade --all`, or `add hooks`); a plain `buildpad upgrade` does not install it, because no file of `api-routes` changed.
- `@buildpad/mcp` embeds the same registry: `list_lib_modules` now lists `hooks` under `api-routes`, `copy_component` for `api-routes` (and for `external-oauth`, which depends on it) also returns the `hooks` files, and the `users-management` and `content-routes` entries list their new dependencies.

The generated `components/ui/index.ts` no longer fails to compile when two installed components export the same name. With both `file-manager` and `users-management` installed, `DeleteConfirmModal` and `DeleteConfirmModalProps` were ambiguous under `export *` (TS2308), which broke `tsc` and `next build`. The barrel now re-exports each such name from the first component that provides it (alphabetical), and `add` lists them; import the other one by path, e.g. `@/components/ui/users-management`.

Two gaps remain, because fixing them means moving a file to another entry: the `api-routes` logout route imports `@/lib/oauth/config` (install `external-oauth`, as `add --with-api` and `bootstrap` do), and the `services` module's `lib/module-access/enforce.ts` imports `@/lib/supabase/server` (install `supabase-auth`).
