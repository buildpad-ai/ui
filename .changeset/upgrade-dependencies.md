---
"@buildpad/cli": major
"@buildpad/mcp": major
---

`buildpad upgrade` brings the dependencies of what it upgrades.

The new source of an entry imports the new source of the entries it depends on, so upgrading one entry alone could leave a project that does not compile (3.0's `list-o2m` imports a services file and a `list-m2a` file that 2.6 does not have). `upgrade` now follows the registry's dependency lists (`internalDependencies`, `registryDependencies`) from every entry it upgrades, through components and lib modules alike:

- An installed, out-of-date dependency is upgraded in the same run. Edited files go through `--strategy` as usual; nothing is overwritten silently.
- A dependency the project does not have is installed and added to `components/ui/index.ts`. Until now only missing lib modules were installed, so a 2.6 project with `api-routes` but no `collection-form` had to run `add` by hand.
- Up-to-date dependencies, and out-of-date entries nothing selected depends on, are left alone. `--force` re-syncs the selected entries only.

The run lists what it brings along, and which entry needs it, before it writes anything. This applies to named entries, `--package`, a bare `upgrade` and `--all`; `--design` stays scoped to the design-system module. The new `--no-deps` flag upgrades only the selected entries, as before. `upgrade <name>` for a component the project does not have now installs it properly (it used to write the files without listing the component as installed).

MCP: `get_upgrade_plan` and `apply_upgrade` follow the same rule. A named entry's plan includes its outdated component dependencies as well as lib modules, and lists `staleComponentDependencies` and `missingDependencies`. `apply_upgrade` names every dependency on the command line and runs the CLI with `--no-deps`, so the entries it checked (nothing newer than the server is moved backwards) are the entries the CLI touches; its result adds `componentDependencies` and `missingDependencies`. The option is now `includeDependencies`; `includeLibDependencies` is still accepted.
