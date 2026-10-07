'use client';

/**
 * Relational UI context — the components the relational interfaces
 * (ListO2M, ListM2M, ListM2A and JunctionItemForm) render inside their
 * create / edit / select dialogs.
 *
 * Those interfaces live BELOW CollectionForm, CollectionList and VForm in the
 * package graph, so they cannot import them without an import cycle. Instead
 * they read them from this context:
 *
 * - `CollectionForm` and `VForm` supply it automatically, so every relational
 *   field rendered inside a CollectionForm (content pages, DynamicForm,
 *   FormPreview) or inside a VForm works with no setup.
 * - Standalone use (a `<ListO2M>` on its own page, a plain `<VForm>` with
 *   relational fields) needs an app-level provider: wrap the page in
 *   `CollectionsRelationalProvider` (exported next to CollectionForm), or in a
 *   `RelationalUIProvider` with your own components.
 * - Without a provider the interfaces show a translated alert and hide the
 *   actions that need a missing component; they never import a fallback.
 *
 * The slot prop types below are STRUCTURAL: they list exactly the props the
 * relational interfaces pass, so this module needs no import from the
 * packages above it. CollectionForm, CollectionList and VForm satisfy them.
 *
 * Import this module by its deep path
 * (`@buildpad/services/relational-ui-context`), not through the services
 * barrel, so a locally edited barrel can never break the relational fields.
 *
 * @module @buildpad/services/relational-ui-context
 */

import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react';
import type { Field } from '@buildpad/types';

/** Props the relational interfaces pass to the `CollectionForm` slot. */
export interface RelationalCollectionFormProps {
  /** Collection the form edits */
  collection: string;
  /** Item id (edit mode) */
  id?: string | number;
  /** Create a new item or edit `id` */
  mode?: 'create' | 'edit';
  /** Values pre-filled on create */
  defaultValues?: Record<string, unknown>;
  /** Fields the form must not render */
  excludeFields?: string[];
  /** Called after a successful save with the saved record */
  onSuccess?: (data?: Record<string, unknown>) => void;
  /** Called when the user cancels */
  onCancel?: () => void;
}

/** A bulk action the relational interfaces add to the `CollectionList` picker. */
export interface RelationalBulkAction {
  label: string;
  icon?: ReactNode;
  /** Receives the selected ids and, when loaded, the selected rows. */
  action: (
    selectedIds: (string | number)[],
    selectedRows?: Record<string, unknown>[],
  ) => void | Promise<void>;
}

/** Props the relational interfaces pass to the `CollectionList` slot. */
export interface RelationalCollectionListProps {
  /** Collection to pick items from */
  collection: string;
  /** Show row checkboxes */
  enableSelection?: boolean;
  /** Request an exact total count */
  exactCount?: boolean;
  /** Fields each row must load */
  fields?: string[];
  /** DaaS filter applied to the picker */
  filter?: Record<string, unknown>;
  /** Actions on the selected rows */
  bulkActions?: RelationalBulkAction[];
}

/** Props JunctionItemForm passes to the `FormRenderer` slot (VForm). */
export interface RelationalFormRendererProps {
  collection?: string;
  fields?: Field[];
  modelValue?: Record<string, unknown>;
  initialValues?: Record<string, unknown>;
  onUpdate?: (values: Record<string, unknown>) => void;
  primaryKey?: string | number;
  disabled?: boolean;
  loading?: boolean;
  excludeFields?: string[];
  showNoVisibleFields?: boolean;
}

/** The components a relational interface may need. Every slot is optional. */
export interface RelationalUIComponents {
  /** Create / edit form for one item (CollectionForm) */
  CollectionForm?: ComponentType<RelationalCollectionFormProps>;
  /** Item picker (CollectionList with selection) */
  CollectionList?: ComponentType<RelationalCollectionListProps>;
  /** Schema-driven form for explicit fields (VForm) */
  FormRenderer?: ComponentType<RelationalFormRendererProps>;
}

/** Slot names, in a stable order (for messages and iteration). */
export const RELATIONAL_UI_SLOTS = ['CollectionForm', 'CollectionList', 'FormRenderer'] as const;

/** Name of one slot of {@link RelationalUIComponents}. */
export type RelationalUISlot = (typeof RELATIONAL_UI_SLOTS)[number];

const EMPTY: RelationalUIComponents = Object.freeze({});

/**
 * Merge layers of components; a later layer wins for every slot it DEFINES.
 * An `undefined` slot never erases an earlier one, so
 * `components={{ CollectionForm: undefined }}` keeps the inherited form.
 */
export function mergeRelationalUI(
  ...layers: Array<RelationalUIComponents | null | undefined>
): RelationalUIComponents {
  const result: RelationalUIComponents = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.CollectionForm) result.CollectionForm = layer.CollectionForm;
    if (layer.CollectionList) result.CollectionList = layer.CollectionList;
    if (layer.FormRenderer) result.FormRenderer = layer.FormRenderer;
  }
  return result;
}

/** The slots `required` names that `components` does not supply. */
export function missingRelationalUI(
  components: RelationalUIComponents,
  required: readonly RelationalUISlot[],
): RelationalUISlot[] {
  return RELATIONAL_UI_SLOTS.filter((slot) => required.includes(slot) && !components[slot]);
}

const RelationalUIContext = createContext<RelationalUIComponents>(EMPTY);
RelationalUIContext.displayName = 'RelationalUIContext';

export interface RelationalUIProviderProps {
  /**
   * Components this provider supplies. They win over any provider above it
   * (nested providers merge: a slot left undefined is inherited).
   */
  components?: RelationalUIComponents;
  /**
   * Components used only for slots that neither `components` nor any provider
   * above supplies. CollectionForm and VForm provide their built-ins this way,
   * so an app-level choice is never overridden by a form further down.
   */
  defaults?: RelationalUIComponents;
  children?: ReactNode;
}

/**
 * Supplies the components relational interfaces render in their dialogs.
 *
 * @example
 * <RelationalUIProvider components={{ CollectionForm, CollectionList, FormRenderer: VForm }}>
 *   <ListO2M collection="categories" field="posts" primaryKey={id} />
 * </RelationalUIProvider>
 */
export function RelationalUIProvider({ components, defaults, children }: RelationalUIProviderProps) {
  const parent = useContext(RelationalUIContext);
  // Depend on the slots, not on the (usually inline) objects holding them.
  const form = components?.CollectionForm;
  const list = components?.CollectionList;
  const renderer = components?.FormRenderer;
  const defaultForm = defaults?.CollectionForm;
  const defaultList = defaults?.CollectionList;
  const defaultRenderer = defaults?.FormRenderer;
  const value = useMemo(
    () =>
      mergeRelationalUI(
        { CollectionForm: defaultForm, CollectionList: defaultList, FormRenderer: defaultRenderer },
        parent,
        { CollectionForm: form, CollectionList: list, FormRenderer: renderer },
      ),
    [parent, form, list, renderer, defaultForm, defaultList, defaultRenderer],
  );
  return <RelationalUIContext.Provider value={value}>{children}</RelationalUIContext.Provider>;
}

/**
 * The relational components in scope, with `overrides` (e.g. a component's
 * own `components` prop) winning for every slot they define.
 */
export function useRelationalUI(overrides?: RelationalUIComponents): RelationalUIComponents {
  const context = useContext(RelationalUIContext);
  const CollectionForm = overrides?.CollectionForm;
  const CollectionList = overrides?.CollectionList;
  const FormRenderer = overrides?.FormRenderer;
  return useMemo(
    () => mergeRelationalUI(context, { CollectionForm, CollectionList, FormRenderer }),
    [context, CollectionForm, CollectionList, FormRenderer],
  );
}
