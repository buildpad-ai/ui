---
"@buildpad/cli": patch
---

Safer installs and import rewriting.

- **`add` no longer overwrites your edits.** When an installed component was outdated, `add` refreshed it in place if it looked unmodified, but it checked the wrong file: the path without `src/` in `srcDir` projects, and the `.ts` path for files it writes as `.tsx` (VForm's `types.ts`, `utils/*.ts`, `index.ts`, `list-m2a/render-template.ts`, …). An edited file then looked missing, and `add` replaced it. It now checks the file it actually wrote, and keeps any copy you changed.
- **`validate` and `fix` find every leftover `@buildpad/*` import.** They used to look only for `from '@buildpad/…'` on one line, under `components/` and `lib/buildpad/`. They now also find dynamic `import()`, side-effect imports, `require()` and multi-line imports, in every folder the CLI installs into (`app/`, `lib/`, `middleware.ts`, `types/`, …).
- **`fix` no longer renames your relative imports.** It rewrote VForm's `./FormFieldInterface` to `./form-field-interface`, and a file of yours that imports `./MyPanel` to `./my-panel`. Installed files are now rewritten with the same rules `add` used, and your own files only have their `@buildpad/*` imports changed. `fix` lists any import it cannot rewrite.
- **Imports the CLI cannot place now fail the install.** A `@buildpad/*` import with no install target used to be copied unchanged and failed later in your build. `add` and `upgrade` now stop with an error that names the file, the line and the import.
- Import rewriting now covers side-effect imports, `require()`, `declare module`, and `import()` of any package path. This includes `import('@buildpad/ui-interfaces/<name>')`, which lazily loaded interfaces need. Some package paths were mapped to files the registry never installs, and now map to the installed file: `@buildpad/utils/<module>`, `@buildpad/ui-table/<module>`, `@buildpad/ui-forms`, and PascalCase paths in `ui-collections`, `ui-files`, `ui-users` and `ui-interfaces/<name>/<Entry>`. No shipped file uses these paths today, so the files installed into your project do not change.
