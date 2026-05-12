import React from 'react';
import { AnyItem, Field, Collection, Bookmark } from '@buildpad/types';
import { Sort, Header } from '@buildpad/ui-table';

/**
 * CollectionForm Component
 *
 * A CRUD wrapper around VForm that handles data fetching and persistence.
 * Uses VForm for the actual form rendering with all @buildpad/ui-interfaces components.
 *
 * Architecture:
 * - CollectionForm = Data layer (fetch fields, load/save items, CRUD operations, permissions)
 * - VForm = Presentation layer (renders fields with proper interfaces from @buildpad/ui-interfaces)
 *
 * Permission enforcement (mirrors DaaS item.vue + get-fields.ts):
 * - Fetches field-level read/write permissions from PermissionsService
 * - Filters fields: only shows fields the user can read
 * - Marks non-writable fields as readonly
 * - Applies permission presets as default values on create
 * - Computes isSavable (hasEdits + saveAllowed)
 * - Surfaces validation errors per-field from the DaaS backend
 *
 * @package @buildpad/ui-collections
 */

interface CollectionFormProps {
    /** Collection name */
    collection: string;
    /** Item ID for edit mode */
    id?: string | number;
    /** Mode: create or edit */
    mode?: "create" | "edit";
    /** Default values for new items */
    defaultValues?: Record<string, unknown>;
    /** Callback on successful save */
    onSuccess?: (data?: Record<string, unknown>) => void;
    /** Callback on cancel */
    onCancel?: () => void;
    /** Callback to navigate to a new create form (for save-and-add-new) */
    onNavigateToCreate?: () => void;
    /** Callback when item is deleted successfully */
    onDelete?: () => void;
    /** Fields to exclude from form */
    excludeFields?: string[];
    /** Fields to show (if set, only these fields are shown) */
    includeFields?: string[];
    /** Whether to show the SaveOptions dropdown alongside the save button */
    showSaveOptions?: boolean;
    /** Whether to show the delete button in edit mode (default: true when id is set) */
    showDelete?: boolean;
}
/** Permission state exposed to parent components */
interface FormPermissionState {
    createAllowed: boolean;
    updateAllowed: boolean;
    deleteAllowed: boolean;
    saveAllowed: boolean;
    hasEdits: boolean;
    isSavable: boolean;
}
/**
 * CollectionForm - Dynamic form for creating/editing collection items
 */
declare const CollectionForm: React.FC<CollectionFormProps>;

/**
 * CollectionList Component
 *
 * A dynamic list/table that fetches items from a collection.
 * Composes VTable for presentation (sorting, resize, reorder, selection)
 * with data fetching from FieldsService/apiRequest.
 *
 * Inspired by the DaaS content module's tabular layout:
 * - Integrated FilterPanel with active filter count badge
 * - Action toolbar: search, filter toggle, bulk actions, create button
 * - Pagination with configurable page sizes (10, 25, 50, 100)
 * - Permission-gated create/delete actions
 * - Field-type-aware cell rendering (booleans, dates, numbers, etc.)
 *
 * @package @buildpad/ui-collections
 */

interface BulkAction {
    label: string;
    icon?: React.ReactNode;
    color?: string;
    /** Whether to show a confirmation dialog before executing */
    confirm?: boolean;
    /** Required permission action; bulk action is disabled when the user lacks this permission */
    requiredPermission?: "create" | "update" | "delete";
    action: (selectedIds: (string | number)[]) => void | Promise<void>;
}
/** Permission state exposed to consumers via onPermissionsLoaded */
interface ListPermissionState {
    createAllowed: boolean;
    readAllowed: boolean;
    updateAllowed: boolean;
    deleteAllowed: boolean;
    archiveAllowed: boolean;
}
/** Archive filter mode for collections with an archive field */
type ArchiveFilter = "all" | "archived" | "unarchived";
interface CollectionListProps {
    /** Collection name to display */
    collection: string;
    /** Enable row selection */
    enableSelection?: boolean;
    /** Filter to apply (DaaS-style filter object) */
    filter?: Record<string, unknown>;
    /** Enable the integrated filter panel toggle */
    enableFilter?: boolean;
    /** Bulk actions for selected items */
    bulkActions?: BulkAction[];
    /** Fields to display (defaults to first 5 visible fields) */
    fields?: string[];
    /** Items per page */
    limit?: number;
    /** Enable search */
    enableSearch?: boolean;
    /** Enable column sorting */
    enableSort?: boolean;
    /** Enable column resize */
    enableResize?: boolean;
    /** Enable column reorder (drag headers) */
    enableReorder?: boolean;
    /** Enable header context menu (right-click for sort, align, hide) */
    enableHeaderMenu?: boolean;
    /** Enable inline "add field" button in header */
    enableAddField?: boolean;
    /** Enable the create (+) action button */
    enableCreate?: boolean;
    /** Primary key field name */
    primaryKeyField?: string;
    /** Row height in pixels */
    rowHeight?: number;
    /** Table spacing preset */
    tableSpacing?: "compact" | "cozy" | "comfortable";
    /** Archive field name (e.g. "status" or "archived"). When set, archive filter UI is shown. */
    archiveField?: string;
    /** Value that indicates an item is archived (default: "archived") */
    archiveValue?: string;
    /** Value that indicates an item is not archived (default: "draft") */
    unarchiveValue?: string;
    /** Callback when item row is clicked */
    onItemClick?: (item: AnyItem) => void;
    /** Callback when "Create" button is clicked */
    onCreate?: () => void;
    /** Callback when "Edit" (row click or edit action) is triggered */
    onEdit?: (item: AnyItem) => void;
    /** Enable built-in delete functionality with confirmation */
    enableDelete?: boolean;
    /** Callback after successful delete (receives deleted IDs) */
    onDeleteSuccess?: (ids: (string | number)[]) => void;
    /** Callback when visible fields change */
    onFieldsChange?: (fields: string[]) => void;
    /** Callback when sort changes */
    onSortChange?: (sort: Sort | null) => void;
    /** Callback when filter changes from the integrated FilterPanel */
    onFilterChange?: (filter: Record<string, unknown> | null) => void;
    /** Callback fired once permissions are resolved for the collection */
    onPermissionsLoaded?: (permissions: ListPermissionState) => void;
    /**
     * Custom cell renderer — called before the built-in field-type renderer.
     * Return a React node to override the cell, or null/undefined to fall through
     * to the default field-type-aware renderer.
     */
    renderCell?: (item: AnyItem, header: Header) => React.ReactNode | null | undefined;
}
/**
 * CollectionList - Dynamic list for displaying collection items.
 * Composes VTable for sorting, resize, reorder, selection, and context menu.
 */
declare const CollectionList: React.FC<CollectionListProps>;

/**
 * FilterPanel Component
 *
 * A field-type-aware filter builder for collection queries.
 * Inspired by DaaS's system-filter interface.
 *
 * Produces DaaS-compatible filter objects ({ _and: [...] })
 * that can be passed to CollectionList's `filter` prop or
 * used directly with apiRequest for custom queries.
 *
 * @package @buildpad/ui-collections
 */

/** A single filter rule */
interface FilterRule {
    id: string;
    field: string;
    operator: string;
    value: unknown;
}
/** A filter group (AND / OR) */
interface FilterGroup {
    id: string;
    logical: '_and' | '_or';
    rules: (FilterRule | FilterGroup)[];
}
interface FilterPanelProps {
    /** Available fields to filter on */
    fields: Field[];
    /** Current filter value (DaaS-style JSON) */
    value?: Record<string, unknown> | null;
    /** Called when filter changes */
    onChange?: (filter: Record<string, unknown> | null) => void;
    /** Display mode: 'panel' shows bordered container, 'inline' is flat */
    mode?: 'panel' | 'inline';
    /** Show as collapsed bar with chip summary */
    collapsible?: boolean;
    /** Initially collapsed */
    defaultCollapsed?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Maximum nesting depth for groups (default: 3) */
    maxDepth?: number;
}
declare const FilterPanel: React.FC<FilterPanelProps>;

/**
 * ContentNavigation Component
 *
 * Hierarchical sidebar navigation for the content module.
 * Displays all collections in a tree structure with search, grouping,
 * bookmarks, context menus, and show/hide hidden collections.
 *
 * Ported from DaaS content module's navigation.vue + navigation-item.vue.
 *
 * @package @buildpad/ui-collections
 */

/** Node in the collection tree */
interface CollectionTreeNode extends Collection {
    /** Display name (formatted from collection identifier) */
    name?: string;
    /** Icon identifier (flattened from meta) */
    icon?: string;
    /** Color value (flattened from meta) */
    color?: string;
    children: CollectionTreeNode[];
}
interface ContentNavigationProps {
    /** Current active collection */
    currentCollection?: string;
    /** Tree of root collections (use useCollections hook) */
    rootCollections: CollectionTreeNode[];
    /** Currently expanded group IDs */
    activeGroups: string[];
    /** Toggle group expand/collapse */
    onToggleGroup: (collectionId: string) => void;
    /** Show hidden collections */
    showHidden?: boolean;
    /** Callback to toggle hidden collections */
    onToggleHidden?: () => void;
    /** Whether hidden collections exist */
    hasHiddenCollections?: boolean;
    /** Whether to show search (many collections) */
    showSearch?: boolean;
    /** Whether to use dense mode */
    dense?: boolean;
    /** Bookmarks grouped by collection */
    bookmarks?: Bookmark[];
    /** Navigate to a collection */
    onNavigate: (collection: string) => void;
    /** Navigate to a bookmark */
    onBookmarkClick?: (bookmark: Bookmark) => void;
    /** Navigate to collection settings (admin only) */
    onEditCollection?: (collection: string) => void;
    /** Whether user is admin */
    isAdmin?: boolean;
    /** Whether collections are loading */
    loading?: boolean;
    /** Called when search value changes */
    onSearchChange?: (search: string) => void;
}
/**
 * ContentNavigation — Sidebar navigation for the content module.
 *
 * Renders a hierarchical tree of collections with:
 * - Searchable collection list
 * - Expandable/collapsible groups
 * - Bookmark items under each collection
 * - Context menu for admin actions
 * - Show/hide hidden collections
 *
 * @example
 * ```tsx
 * import { ContentNavigation } from '@buildpad/ui-collections';
 * import { useCollections } from '@buildpad/hooks';
 *
 * function Sidebar() {
 *   const {
 *     rootCollections, activeGroups, toggleGroup,
 *     showHidden, setShowHidden, hasHiddenCollections,
 *     showSearch, dense, loading,
 *   } = useCollections({ currentCollection: 'articles' });
 *
 *   return (
 *     <ContentNavigation
 *       rootCollections={rootCollections}
 *       activeGroups={activeGroups}
 *       onToggleGroup={toggleGroup}
 *       currentCollection="articles"
 *       onNavigate={(col) => router.push(`/content/${col}`)}
 *       showHidden={showHidden}
 *       onToggleHidden={() => setShowHidden(!showHidden)}
 *       hasHiddenCollections={hasHiddenCollections}
 *       showSearch={showSearch}
 *       dense={dense}
 *       loading={loading}
 *     />
 *   );
 * }
 * ```
 */
declare const ContentNavigation: React.FC<ContentNavigationProps>;

/**
 * ContentLayout Component
 *
 * Shell layout for the content module providing:
 * - Sidebar with ContentNavigation
 * - Main content area with header (title, breadcrumbs, actions)
 * - Responsive: sidebar collapses on mobile
 *
 * Ported from DaaS PrivateView + content module shell.
 *
 * @package @buildpad/ui-collections
 */

interface BreadcrumbItem {
    /** Display label */
    label: string;
    /** Navigation path */
    href?: string;
}
interface ContentLayoutProps {
    /** Page title */
    title?: string;
    /** Page icon (Tabler icon name or React node) */
    icon?: React.ReactNode;
    /** Icon color */
    iconColor?: string;
    /** Breadcrumb trail */
    breadcrumbs?: BreadcrumbItem[];
    /** Show a back button */
    showBack?: boolean;
    /** Back button callback */
    onBack?: () => void;
    /** Show header shadow (e.g., when form is scrolled) */
    showHeaderShadow?: boolean;
    /** Sidebar content (typically ContentNavigation) */
    sidebar: React.ReactNode;
    /** Sidebar detail panels (right sidebar) */
    sidebarDetail?: React.ReactNode;
    /** Actions rendered in the header bar */
    actions?: React.ReactNode;
    /** Content between title and actions */
    titleAppend?: React.ReactNode;
    /** Headline area (above title, e.g. version menu) */
    headline?: React.ReactNode;
    /** Whether content is loading */
    loading?: boolean;
    /** Sidebar width in px (default: 260) */
    sidebarWidth?: number;
    /** Detail sidebar width in px (default: 284) */
    detailWidth?: number;
    /** Main content */
    children: React.ReactNode;
}
/**
 * ContentLayout — Content module shell with sidebar navigation.
 *
 * Provides a responsive layout with a collapsible sidebar on the left,
 * a header bar with breadcrumbs/title/actions, and a main content area.
 *
 * @example
 * ```tsx
 * import { ContentLayout, ContentNavigation } from '@buildpad/ui-collections';
 * import { useCollections } from '@buildpad/hooks';
 *
 * function ContentPage({ children }) {
 *   const collections = useCollections({ currentCollection: 'articles' });
 *
 *   return (
 *     <ContentLayout
 *       title="Articles"
 *       breadcrumbs={[{ label: 'Content', href: '/content' }]}
 *       sidebar={
 *         <ContentNavigation
 *           rootCollections={collections.rootCollections}
 *           activeGroups={collections.activeGroups}
 *           onToggleGroup={collections.toggleGroup}
 *           onNavigate={(col) => router.push(`/content/${col}`)}
 *         />
 *       }
 *       actions={<Button>Create Item</Button>}
 *     >
 *       <CollectionList collection="articles" />
 *     </ContentLayout>
 *   );
 * }
 * ```
 */
declare const ContentLayout: React.FC<ContentLayoutProps>;

/**
 * SaveOptions Component
 *
 * Dropdown menu attached to the primary save button providing
 * additional save actions: save & stay, save & add new, save as copy, discard.
 *
 * Ported from DaaS save-options.vue.
 *
 * @package @buildpad/ui-collections
 */

type SaveAction = 'save-and-stay' | 'save-and-add-new' | 'save-as-copy' | 'discard-and-stay';
interface SaveOptionsProps {
    /** Disabled options */
    disabledOptions?: SaveAction[];
    /** Save and stay on current item */
    onSaveAndStay?: () => void;
    /** Save and navigate to create new */
    onSaveAndAddNew?: () => void;
    /** Save a copy of the current item */
    onSaveAsCopy?: () => void;
    /** Discard all changes */
    onDiscardAndStay?: () => void;
    /** Whether the menu trigger is disabled */
    disabled?: boolean;
    /** Platform for keyboard shortcut display (default: auto-detect) */
    platform?: 'mac' | 'win';
}
/**
 * SaveOptions — Dropdown for additional save actions
 *
 * Designed to be placed adjacent to the primary Save button.
 *
 * @example
 * ```tsx
 * <Group gap={0}>
 *   <Button onClick={handleSave} loading={saving} disabled={!hasEdits}>
 *     <IconCheck size={16} />
 *   </Button>
 *   <SaveOptions
 *     onSaveAndStay={handleSaveAndStay}
 *     onSaveAndAddNew={handleSaveAndAddNew}
 *     onSaveAsCopy={handleSaveAsCopy}
 *     onDiscardAndStay={handleDiscard}
 *     disabledOptions={isNew ? ['save-as-copy'] : []}
 *   />
 * </Group>
 * ```
 */
declare const SaveOptions: React.FC<SaveOptionsProps>;

export { type ArchiveFilter, type BreadcrumbItem, type BulkAction, CollectionForm, type CollectionFormProps, CollectionList, type CollectionListProps, type CollectionTreeNode, ContentLayout, type ContentLayoutProps, ContentNavigation, type ContentNavigationProps, type FilterGroup, FilterPanel, type FilterPanelProps, type FilterRule, type FormPermissionState, type ListPermissionState, type SaveAction, SaveOptions, type SaveOptionsProps };
