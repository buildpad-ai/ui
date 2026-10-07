---
"@buildpad/mcp": minor
---

The MCP server's source tools now work from npm, and its upgrade tools cover lib modules and run the matching CLI.

**Sources ship in the package.** Before this release, `get_component`, `copy_component` and `resources/read` looked for sources two directories above `dist/`. Under `npx` that directory is `node_modules/@buildpad/`, so for every npm user these tools returned `"Source code not available"`, empty `allSources` or empty file lists, with no error. The build now copies every file that the embedded registry references into `dist/sources/`. It fails if a copy's hash differs from the registry's `sourceSha256`. The server reads `packages/` when it runs from a monorepo checkout, and `dist/sources/` otherwise. It never reads `node_modules/@buildpad`. The tarball grows from about 374 kB to about 862 kB (3.7 MB unpacked). The sourcemap is no longer published.

**Missing sources are errors.** A file that cannot be read now gives `isError: true` with a `missingSources` list (for `resources/read`, an MCP error with `missingSources` in its `data`). It no longer gives placeholder text or an empty list. `copy_component` with `includeLib` now also includes the lib modules that the component's lib dependencies need, as `buildpad add` does, and it reports `registryDependencies`.

**Upgrade tools:**

- `list_outdated` and `get_upgrade_plan` now report lib modules (`kind: "lib"`) and installed entries with no record, as well as components. `latestRelease` is now the registry's release. Before, it echoed the project's own release. Entries installed from a newer release are flagged `aheadOfRegistry`.
- `get_upgrade_plan` now looks for files where the CLI writes them: under `src/` for `srcDir` projects, and component `.ts` files as `.tsx` (or `.jsx`). Before, those files showed as `missing`. Each file also reports its on-disk `path`. Naming a component also plans the outdated lib modules it depends on.
- `apply_upgrade` now runs `npx --yes @buildpad/cli@<MCP version> upgrade`. Before, it ran whichever CLI was latest. It accepts only the strategies `overwrite`, `new-file` and `three-way`, and only lowercase registry names, which it passes after `--`. It adds the outdated lib modules that named components depend on (turn this off with `includeLibDependencies: false`). It refuses to run if the project was installed from a newer release than the MCP, because that would downgrade the project. The timeout is now 120 s, up from 60 s, to allow npx to download the pinned CLI.

**Guidance text:** the tools no longer say that `@buildpad/cli` is not on npm, or tell users to clone the repository and pass `--project` (an option the CLI does not have). They now show `npx @buildpad/cli add <name>` and `--cwd`.
