# Changesets

This directory is managed by [Changesets](https://github.com/changesets/changesets).

When you make changes that should be released, run:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages changed (`@buildpad/cli`, `@buildpad/mcp`)
2. Choose a semver bump type — pick by what changed, not by severity:
   `minor` for anything that changes component source (the default, including
   bug fixes), `patch` for docs/templates/MCP/CLI-only changes, `major` for a
   breaking public API change. See
   [docs/PUBLISHING.md](../docs/PUBLISHING.md#bump-types).
3. Write a summary of the change

The changeset file is committed alongside your code and consumed during the release process.
