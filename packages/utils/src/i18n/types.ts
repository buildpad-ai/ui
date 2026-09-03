/**
 * Buildpad component i18n — dictionary shape.
 *
 * One namespace per package, each in `namespaces/<name>.ts` together with its
 * English defaults and Indonesian catalog. Apps pass a (deep-partial)
 * dictionary of this shape to `BuildpadI18nProvider` once, in their root
 * layout; every Buildpad component reads it through `useBuildpadI18n()` /
 * `useBuildpadTranslations()`.
 *
 * Conventions
 * - Placeholders use the `{key}` syntax from `interpolate()`.
 * - Countable strings are `PluralForms` objects resolved with
 *   `Intl.PluralRules` (see `plural.ts`); `{count}` is always available.
 * - Keys are additive: a new release may add keys, never rename or remove them,
 *   so a consumer's dictionary keeps working across `buildpad upgrade`.
 *
 * @module @buildpad/utils/i18n/types
 */

import type { DeepPartial } from './primitives';
import type { CommonTranslations } from './namespaces/common';
import type { FormTranslations } from './namespaces/form';
import type { TableTranslations } from './namespaces/table';
import type { InterfacesTranslations } from './namespaces/interfaces';
import type { CollectionsTranslations } from './namespaces/collections';
import type { FilesTranslations } from './namespaces/files';
import type { UsersTranslations } from './namespaces/users';
import type { FormsTranslations } from './namespaces/forms';
import type { HooksTranslations } from './namespaces/hooks';

export type { PluralForms, DeepPartial, TextDirection, InterpolationValues } from './primitives';
export type { CommonTranslations } from './namespaces/common';
export type { FormTranslations, FormValidationTranslations } from './namespaces/form';
export type { TableTranslations } from './namespaces/table';
export type * from './namespaces/interfaces';
export type { CollectionsTranslations } from './namespaces/collections';
export type { FilesTranslations } from './namespaces/files';
export type { UsersTranslations } from './namespaces/users';
export type { FormsTranslations } from './namespaces/forms';
export type { HooksTranslations, HooksRelationsTranslations } from './namespaces/hooks';

export interface BuildpadTranslations {
  common: CommonTranslations;
  form: FormTranslations;
  table: TableTranslations;
  interfaces: InterfacesTranslations;
  collections: CollectionsTranslations;
  files: FilesTranslations;
  users: UsersTranslations;
  forms: FormsTranslations;
  hooks: HooksTranslations;
}

/** What apps pass to the provider and what `locales/*.ts` export. */
export type BuildpadTranslationsInput = DeepPartial<BuildpadTranslations>;
