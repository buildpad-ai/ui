# Skill patches

Patches for `buildpad-ai/skills` that must ship together with a Buildpad UI release. Apply from a checkout of the skills repo:

```bash
git apply /path/to/buildpad-ui/docs/skill-patches/add-i18n-phase-2.patch
```

| Patch | Ships with | What it changes |
| --- | --- | --- |
| `add-i18n-phase-2.patch` | `@buildpad/cli` 2.3 (app/[lang] scaffold, component i18n) | `add-i18n` treats CLI ≥ 2.3 apps as already locale-prefixed (skip the retrofit, use `migrate i18n` for older apps), documents the `buildpad.*` dictionary namespace as `BuildpadTranslations`, and points the locale-routing reference at the CLI templates as the source of truth. |

Delete a patch once it has been applied upstream and `pnpm sync:skills` has run in `buildpad-platform`.
