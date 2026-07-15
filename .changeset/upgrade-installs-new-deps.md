---
"@buildpad/cli": patch
---

`buildpad upgrade` now installs npm dependencies that a new component or lib-module version introduces. Previously it copied the new source but never checked the registry-declared `dependencies`, so an upgrade could leave the app with unresolvable imports (e.g. rich-text-markdown 1.8.0 added `@tiptap/extension-table`, `tiptap-markdown` and `marked`). Missing deps are now detected after upgrading, pinned to their tested ranges, and installed with the package manager the app's lockfile implies — with confirmation, or automatically under `--yes`; `--dry-run` lists what would be installed. The dependency pin map moved to a shared util used by both `add` and `upgrade`, and gained pins for `@tiptap/extension-table`, `tiptap-markdown` and `marked`.
