// Hooks-correctness lint only — no style rules. Scoped to package sources;
// @typescript-eslint/parser is needed solely so ESLint can parse TS/TSX.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import noUntranslatedLiteral from './scripts/eslint/no-untranslated-literal.mjs';

/**
 * Packages whose user-facing strings have been moved into the shared i18n
 * dictionary (docs/I18N_PLAN.md, B2). The literal rule is an ERROR for them so
 * a regression cannot merge, and a WARNING everywhere else until that package
 * is migrated — promote a package here as part of its migration PR.
 */
const I18N_MIGRATED = ['ui-form', 'ui-table', 'ui-collections', 'ui-interfaces', 'ui-files', 'ui-users', 'ui-forms', 'hooks'];

export default [
  { ignores: ['**/dist/', '**/.next/', '**/storybook-static/', '**/coverage/', 'apps/storybook-host/public/storybook/'] },
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    // '@typescript-eslint' is registered with NO rules enabled: package sources
    // carry eslint-disable comments for consumer repos (registry installs land in
    // Next.js apps that run typescript-eslint), and without the plugin those
    // directives error with "Definition for rule ... was not found".
    plugins: {
      'react-hooks': reactHooks,
      '@typescript-eslint': tsPlugin,
      buildpad: { rules: { 'no-untranslated-literal': noUntranslatedLiteral } },
    },
    // Those same consumer-targeted directives are "unused" in this repo, so
    // unused-directive reporting stays off.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'buildpad/no-untranslated-literal': 'warn',
    },
  },
  // ESLint rejects an empty `files` array, so the block only exists once a
  // package has been promoted.
  ...(I18N_MIGRATED.length > 0
    ? [
        {
          files: I18N_MIGRATED.map((pkg) => `packages/${pkg}/src/**/*.{ts,tsx}`),
          rules: { 'buildpad/no-untranslated-literal': 'error' },
        },
      ]
    : []),
  {
    // Stories, tests, demos and the dictionary itself may carry literals.
    files: [
      'packages/*/src/**/*.stories.{ts,tsx}',
      'packages/*/src/**/*.test.{ts,tsx}',
      'packages/*/src/**/__tests__/**',
      'packages/*/src/**/Demo*.tsx',
      'packages/utils/src/i18n/**',
    ],
    rules: { 'buildpad/no-untranslated-literal': 'off' },
  },
];
