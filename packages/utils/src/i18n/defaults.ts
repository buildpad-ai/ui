/**
 * English defaults — assembled from `namespaces/*.ts`, the ONLY place
 * user-facing literals are allowed in Buildpad packages. Every component reads
 * its strings from here through `useBuildpadTranslations()`; apps override them
 * via `BuildpadI18nProvider`.
 *
 * Keep each namespace's `<name>Id` catalog in sync with its defaults (the
 * parity test in `utils/tests/i18n.test.ts` fails when a locale misses a key).
 */
import type { BuildpadTranslations } from './types';
import { commonDefaults } from './namespaces/common';
import { formDefaults } from './namespaces/form';
import { tableDefaults } from './namespaces/table';
import { interfacesDefaults } from './namespaces/interfaces';

export const defaultTranslations: BuildpadTranslations = {
  common: commonDefaults,
  form: formDefaults,
  table: tableDefaults,
  interfaces: interfacesDefaults,
};

export default defaultTranslations;
