/**
 * @buildpad/utils/i18n
 *
 * Framework-free core of Buildpad component i18n: the dictionary shape, the
 * English defaults, bundled locale catalogs, and the merge / interpolate /
 * plural helpers. The React side (`BuildpadI18nProvider`, `useBuildpadI18n`)
 * lives in `@buildpad/services` and is re-exported by `@buildpad/hooks`.
 */
export type {
  BuildpadTranslations,
  BuildpadTranslationsInput,
  CommonTranslations,
  DeepPartial,
  FormTranslations,
  FormValidationTranslations,
  InterfacesTranslations,
  InterpolationValues,
  ListM2MTranslations,
  PluralForms,
  TableTranslations,
  TextDirection,
} from './types';
export { defaultTranslations } from './defaults';
export { en, id, bundledLocales, bundledTranslationsFor } from './locales';
export { mergeTranslations } from './merge';
export { interpolate, hasPlaceholders } from './interpolate';
export { pluralCategory, selectPlural, formatCount } from './plural';
export {
  DEFAULT_LOCALE,
  languageOf,
  directionForLocale,
  lookupTranslation,
  translate,
} from './locale';
