---
"@buildpad/cli": patch
---

`upgrade`, `add` and `migrate` no longer end silently when they need to ask a question and there is no terminal (CI, a pipe, the MCP server's `apply_upgrade`).

- The "Install missing dependencies automatically?" question was left pending: the process ended at it with exit code 0, before the command's summary and without saying how to install the packages. Without a terminal the CLI now lists the missing packages, prints the install command for the project's package manager and carries on. Nothing is installed unless `--yes` (or `bootstrap`) asks for it. A cancelled prompt counts as "no".
- `upgrade` with the default `prompt` strategy did the same at the first locally-modified file, with files already written and `buildpad.json` not saved. Without a terminal it now acts as `--strategy=new-file`: your file is kept, the new version is written as `<file>.new`, and the entry stays pending. An explicit `--strategy` is honoured as before.
