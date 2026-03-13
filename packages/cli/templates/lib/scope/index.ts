/**
 * Scope module exports
 *
 * @buildpad/origin: scope-routes/scope-index
 * @buildpad/version: 1.0.0
 */

export { ScopeProvider, useScope } from './context';
export type { ScopeContextValue } from './context';
export { scopedFetch, ScopeError, useScopeErrorHandler } from './use-scope-error';
