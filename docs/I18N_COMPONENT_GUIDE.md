# Component i18n — how a Buildpad package reads its strings

Every user-facing string in `packages/*/src` comes from the shared dictionary. This is the contract for migrating a package and for writing new components. The design and rollout order live in [I18N_PLAN.md](I18N_PLAN.md) (Workstream B).

## Where strings live

```
packages/utils/src/i18n/
├── primitives.ts                 PluralForms, DeepPartial, InterpolationValues, TextDirection
├── namespaces/
│   ├── common.ts                 chrome shared by several packages (save, cancel, itemCount, …)
│   ├── form.ts                   ui-form
│   ├── table.ts                  ui-table
│   ├── collections.ts            ui-collections
│   ├── files.ts                  ui-files
│   ├── users.ts                  ui-users
│   ├── forms.ts                  ui-forms (builder chrome only)
│   ├── interfaces.ts             composer — one sub-namespace per interface folder
│   └── interfaces/<folder>.ts    ui-interfaces: list-m2m.ts → interfaces.listM2M, upload.ts → interfaces.upload, …
├── types.ts / defaults.ts / locales/id.ts   composers — do not add keys here
└── merge.ts · interpolate.ts · plural.ts · locale.ts
```

A namespace file carries three things that must stay in step — the parity test in `packages/utils/tests/i18n.test.ts` fails otherwise:

```ts
export interface UploadTranslations {
  dropFiles: string;                      // "Drop files here"
  /** "{count} file(s) selected" */
  selectedCount: PluralForms;             // { one: '{count} file selected', other: '{count} files selected' }
}
export const uploadDefaults: UploadTranslations = { … };   // English — the ONLY place literals are allowed
export const uploadId: UploadTranslations = { … };         // Bahasa Indonesia, every key, `{count}` placeholders identical
```

Rules for keys: camelCase, grouped by component (`collectionList.emptyState.title`), `PluralForms` for anything countable (`{count}` is always available), `{name}`-style placeholders for interpolation. Keys are additive — never rename or remove a key once released (consumers' dictionaries must keep working across `buildpad upgrade`). Existing snake_case keys (`interfaces.listM2M.create_new`) stay as they are.

## Reading strings in a component

```tsx
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services'; // or '@buildpad/hooks'

export function Upload({ translations, ...props }: UploadProps) {
  // one namespace, with the component's own override prop layered on top
  const t = useBuildpadTranslations((d) => d.interfaces.upload, translations);
  // locale + formatters (locale-aware, time zone pinned by the provider)
  const { locale, direction, formatDate, formatDateTime, formatNumber, formatCount } = useBuildpadI18n();

  return (
    <>
      <Text>{t.dropFiles}</Text>
      <Text>{formatCount(files.length, t.selectedCount)}</Text>
      <Text>{formatDate(file.uploaded_on)}</Text>
      <Text>{interpolate(t.renamedTo, { name: file.title })}</Text>
    </>
  );
}
```

- **Precedence:** component prop (`translations`, `loadingText`, `noItemsText`, …) > provider dictionary > English defaults. Keep every existing text prop working; new components get a `translations?: DeepPartial<XTranslations>` prop when per-instance overrides make sense.
- **No provider mounted** (Storybook without the toolbar, unit tests, apps that predate i18n): the hooks return the English defaults and format with the browser locale and time zone — exactly the old behaviour. Never guard on `hasProvider` for text.
- **Dates / numbers:** replace bare `toLocaleDateString()` / `toLocaleString()` / `Intl.DateTimeFormat(undefined, …)` with `formatDate` / `formatDateTime` / `formatNumber` from `useBuildpadI18n()`. They take the same `Intl` options. `formatDate` returns `''` for an invalid or empty value.
- **Plurals:** never `count === 1 ? '…' : '…'`; use a `PluralForms` entry and `formatCount(count, forms)` (or `t('common.itemCount', { count })` via the dotted `t()`).
- **Interpolation:** `interpolate(t.someString, { name })` from `@buildpad/utils`; a `{key}` with no value stays visible so a typo is noticed.
- **Hooks rules:** call the hooks at the top of the component. Class components (error boundaries) cannot: wrap them in a function component that resolves the strings and passes them as props. Non-React helpers (`utils/*.ts`, services) take the strings as an argument instead of importing defaults.
- **Text direction:** `direction` is `'rtl'` for Arabic/Hebrew/Persian/Urdu locales; use logical CSS where a component has explicit left/right (RTL audit is Phase 3).
- **Third-party UI** (EditorJS toolbox, Mantine calendar labels) keeps its own i18n; wire it from the dictionary only where the library exposes a config.

## Definition of done for a package

1. `pnpm lint` reports **zero** `buildpad/no-untranslated-literal` warnings for `packages/<pkg>/src`, and the package is added to `I18N_MIGRATED` in `eslint.config.mjs` (the rule becomes an error there).
2. The English output is unchanged: every default equals the literal it replaced (same text, same punctuation, same casing).
3. `pnpm --filter @buildpad/utils test` (parity + placeholder check) and the package's own typecheck/tests pass.
4. Storybook: the stories render in `id` via the **Locale** toolbar (`packages/storybook-i18n.tsx`) with no English chrome left.
5. Dates/numbers in the package go through `useBuildpadI18n()` formatters.
6. The changeset for the release names the package and says "strings now come from the shared dictionary; overrides via `BuildpadI18nProvider` or the component's `translations` prop".

## Testing

```tsx
import { render } from '@testing-library/react';
import { BuildpadI18nProvider } from '@buildpad/services';
import { id } from '@buildpad/utils';

render(
  <BuildpadI18nProvider locale="id" translations={id}>
    <CollectionListToolbar … />
  </BuildpadI18nProvider>,
);
expect(screen.getByPlaceholderText('Cari...')).toBeInTheDocument();
```

Without the provider, tests keep asserting on English text.

## Apps

An app scaffolded by the CLI mounts `BuildpadI18nProvider` through `lib/i18n/provider.tsx`; translations go under the `buildpad` namespace of `lib/i18n/dictionaries/<locale>.json` (same shape as `BuildpadTranslations`), and Buildpad's bundled `id` catalog is applied automatically. Apps not using the CLI mount `<BuildpadI18nProvider locale translations timeZone>` themselves in their root layout.
