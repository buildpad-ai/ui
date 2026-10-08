---
"@buildpad/cli": minor
"@buildpad/mcp": minor
"@buildpad/ui-cron": minor
---

The Cron Jobs module is installable: the `cron-management` registry component and the `cron-routes` lib module. `buildpad add cron-routes` installs the whole feature.

**Registry and CLI**

- `cron-management` (category `workflow`, not part of `add --all`): the 20 source files of `@buildpad/ui-cron` under `components/ui/cron-management/`; depends on the `types`, `hooks`, `services` and `utils` lib modules and on the `vtable` and `input-code` components (`input-code` is the built-in code editor). No new npm dependency.
- `cron-routes`: two pages under `app/[lang]/(authenticated)/` — `/cron` (`CronJobsManager`) and `/cron/[id]` (`CronJobDetail`; `/cron/new` creates) — and one sidebar entry, Cron Jobs (`IconClock`), in the Automation section the workflow routes use. The app dictionary gains `app.nav.cron`; an existing app gets it from `buildpad upgrade i18n`, and the sidebar shows the English label until then.
- The editor keeps `id="new"` after a create, so the installed detail page navigates in `onCreated` to `/cron/<id>` of the stored job, as the reference admin UI does. After a save of an existing job it stays on the editor.
- `@buildpad/ui-cron` imports are rewritten to `@/components/ui/cron-management` (subpaths kebab-cased).
- `@buildpad/mcp` embeds the same registry, so `list_components`, `list_lib_modules` and `copy_component` serve both entries.

Docs: the Cron Jobs Module Recipe page (install, the two routes, component props, the `renderCodeEditor` slot with an example of a syntax-highlighting editor, permissions on `daas_cron_jobs`, both backends, prerequisites).
