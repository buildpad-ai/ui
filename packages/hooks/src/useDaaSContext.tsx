/**
 * useDaaSContext Hook
 *
 * Re-exports DaaS context utilities from @buildpad/services.
 * The browser calls DaaS directly — no Next.js proxy routes are used.
 * CORS is handled on the DaaS side via CORS_ORIGINS env variable.
 *
 * @module @buildpad/hooks/useDaaSContext
 */

export {
  DaaSProvider,
  useDaaSContext,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  type DaaSConfig,
  type DaaSContextValue,
  type DaaSProviderProps,
  type DaaSUser,
} from '@buildpad/services';

export { useDaaSContext as default } from '@buildpad/services';
