---
"@buildpad/cli": minor
"@buildpad/ui-collections": minor
"@buildpad/ui-form": patch
"@buildpad/ui-interfaces": patch
"@buildpad/ui-table": patch
---

Design system enhancements and app-shell scaffold

- Design-token and styling refinements across collection, form, interface, and table components (ContentLayout, CollectionList, ContentNavigation, VForm, VTable, input/system-token interfaces).
- CLI scaffold now ships a generic `AuthenticatedShell` app-shell template with `.bp-*` design-token styles (glass-blur header, gradient-active navigation, brand, user menu) for non-content pages, alongside the schema-driven `ContentLayout`.
- Fix `buildpad init`/`bootstrap` generating a project that fails `next dev` with "Cannot resolve '@supabase/ssr'": the minimal scaffold now declares the always-installed auth layer (`@supabase/ssr`, `@supabase/supabase-js`, `jose`).
