/**
 * CollectionsRelationalProvider
 *
 * The pre-wired relational UI provider: supplies CollectionForm,
 * CollectionList and VForm to the relational interfaces (ListO2M, ListM2M,
 * ListM2A, JunctionItemForm) rendered below it, through the relational UI
 * context (`@buildpad/services/relational-ui-context`).
 *
 * It lives in its own module and loads all three components on demand, so an
 * app layout can wrap every page in it without adding the form system to the
 * bundle of pages that never open a relational dialog. Each slot renders
 * inside the relational interfaces' own Suspense boundary.
 *
 * It only FILLS slots: a slot chosen by a provider above it (for example an
 * app-level `RelationalUIProvider` with a custom form) is kept, so nesting a
 * bare `<CollectionsRelationalProvider>` (as the scaffolded layouts do) never
 * overrides an app's own components. Its `components` prop, in contrast, wins
 * over everything above.
 *
 * @package @buildpad/ui-collections
 */

"use client";

import React from "react";
import {
  RelationalUIProvider,
  type RelationalUIComponents,
} from "@buildpad/services/relational-ui-context";

// CollectionForm's module imports VForm statically, so one chunk serves both
// the form and the form renderer.
const LazyCollectionForm = React.lazy(() =>
  import("./CollectionForm").then((m) => ({ default: m.CollectionForm })),
);
const LazyCollectionList = React.lazy(() =>
  import("./CollectionList").then((m) => ({ default: m.CollectionList })),
);
const LazyVForm = React.lazy(() =>
  import("./CollectionForm").then((m) => ({ default: m.collectionsRelationalUI.FormRenderer! })),
);

/** The built-in components, each loaded on first use. */
const lazyCollectionsRelationalUI: RelationalUIComponents = {
  CollectionForm: LazyCollectionForm,
  CollectionList: LazyCollectionList,
  FormRenderer: LazyVForm,
};

export interface CollectionsRelationalProviderProps {
  /**
   * Slots to use instead of the built-in ones (each one optional). They win
   * over any provider above.
   */
  components?: RelationalUIComponents;
  children?: React.ReactNode;
}

/**
 * Pre-wired relational UI provider: supplies CollectionForm, CollectionList
 * and VForm to every relational interface below it. CollectionForm already
 * does this for the fields it renders (a plain VForm supplies only itself);
 * wrap a page (or the app) in this provider when it renders `<ListO2M>`,
 * `<ListM2M>`, `<ListM2A>` or a plain `<VForm>` with relational fields on its
 * own, so their create / edit / select dialogs work.
 *
 * The built-ins only fill slots no provider above chose; `components` wins.
 *
 * @example
 * <CollectionsRelationalProvider>
 *   <ListO2M collection="categories" field="posts" primaryKey={id} />
 * </CollectionsRelationalProvider>
 */
export function CollectionsRelationalProvider({ components, children }: CollectionsRelationalProviderProps) {
  return (
    <RelationalUIProvider defaults={lazyCollectionsRelationalUI} components={components}>
      {children}
    </RelationalUIProvider>
  );
}

export default CollectionsRelationalProvider;
