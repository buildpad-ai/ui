/**
 * useBuildpadI18n Hook
 *
 * Re-exports the component i18n context from @buildpad/services so hooks
 * consumers have one import path, mirroring `useDaaSContext`.
 *
 * @module @buildpad/hooks/useBuildpadI18n
 */

export {
  BuildpadI18nProvider,
  BUILDPAD_I18N_DEFAULT_TIMEZONE,
  useBuildpadI18n,
  useBuildpadI18nOptional,
  useBuildpadTranslations,
  type BuildpadI18nContextValue,
  type BuildpadI18nProviderProps,
  type DateInput,
} from '@buildpad/services';

export { useBuildpadI18n as default } from '@buildpad/services';
