/**
 * @buildpad/ui-collections
 * 
 * Dynamic collection components (Form, List, Navigation, Layout, Filter) for Buildpad projects.
 * Built with Mantine v8 and using @buildpad/services for data fetching.
 */

export { CollectionForm } from './CollectionForm';
export type { CollectionFormProps, FormPermissionState } from './CollectionForm';

export {
  EXTRAS_COLUMN,
  flattenExtras,
  extractExtras,
  mergeExtras,
  missingExtrasColumnMessage,
} from './extras-storage';

export { CollectionList } from './CollectionList';
export type { CollectionListProps, BulkAction, ArchiveFilter, ListPermissionState } from './CollectionList';

export { FilterPanel } from './FilterPanel';
export type { FilterPanelProps, FilterRule, FilterGroup } from './FilterPanel';

export { ContentNavigation } from './ContentNavigation';
export type { ContentNavigationProps, CollectionTreeNode } from './ContentNavigation';

export { ContentLayout } from './ContentLayout';
export type { ContentLayoutProps, BreadcrumbItem } from './ContentLayout';

export { SaveOptions } from './SaveOptions';
export type { SaveOptionsProps, SaveAction } from './SaveOptions';
