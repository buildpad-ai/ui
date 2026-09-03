"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { isNewItem, interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
import { useBuildpadI18n, useBuildpadTranslations } from "@buildpad/services";
import {
    Paper,
    Group,
    Button,
    Text,
    LoadingOverlay,
    Modal,
    Stack,
    ActionIcon,
    Pagination,
    Select,
    Table,
    TextInput,
    Alert,
    Box,
    Tooltip,
    Menu,
    Badge,
} from "@mantine/core";
import {
    IconPlus,
    IconEdit,
    IconTrash,
    IconExternalLink,
    IconSearch,
    IconAlertCircle,
    IconChevronDown as IconDropdown,
    IconBox,
    IconArrowBackUp,
    IconGripVertical,
} from "@tabler/icons-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDisclosure } from "@mantine/hooks";
import { 
    useRelationM2A, 
    useRelationM2AItems, 
    useRelationPermissionsM2A,
    type M2AItem, 
    type M2ARelationInfo,
    type ChangesItem,
} from "@buildpad/hooks";
import { CollectionList } from "@buildpad/ui-collections";
import { renderTemplate, resolveDisplayTemplate } from "./render-template";
import { JunctionItemForm } from "./JunctionItemForm";

/**
 * Props for the ListM2A component
 * 
 * Many-to-Any (M2A) relationship interface - allows linking to items from
 * MULTIPLE different collections through a junction table.
 * 
 * Example: A "page" can have "blocks" that are articles, images, videos, etc.
 * The junction table stores: page_id, collection (e.g., "articles"), item (the article ID)
 */
export interface ListM2AProps {
    /** Current value - array of junction items */
    value?: M2AItem[];
    /** Callback fired when value changes */
    onChange?: (value: M2AItem[]) => void;
    /** Current collection name (the parent/one side) */
    collection: string;
    /** Field name for this M2A relationship */
    field: string;
    /** Primary key of the current item */
    primaryKey?: string | number;
    /** Layout mode - 'list' or 'table' */
    layout?: 'list' | 'table';
    /** Table spacing for table layout */
    tableSpacing?: 'compact' | 'cozy' | 'comfortable';
    /** Fields to display (applies to junction table) */
    fields?: string[];
    /** Prefix template for displaying collection name before item */
    prefix?: string;
    /** Whether the interface is disabled */
    disabled?: boolean;
    /** Enable create new items button */
    enableCreate?: boolean;
    /** Enable select existing items button */
    enableSelect?: boolean;
    /** Enable search filter in table mode */
    enableSearchFilter?: boolean;
    /** Enable link to related items */
    enableLink?: boolean;
    /** Items per page */
    limit?: number;
    /** Allow duplicate items from the same collection */
    allowDuplicates?: boolean;
    /** Field label */
    label?: string;
    /** Field description */
    description?: string;
    /** Error message */
    error?: string | boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the field is read-only */
    readOnly?: boolean;
    /** Mock items for demo/testing */
    mockItems?: M2AItem[];
    /** Mock relationship info for demo/testing */
    mockRelationInfo?: Partial<M2ARelationInfo>;
    /** Per-instance overrides of the dictionary strings (`interfaces.listM2A`) */
    translations?: DeepPartial<InterfacesTranslations['listM2A']>;
}

// ── DnD helper: Sortable table row ──
interface SortableTableRowProps {
    id: string;
    dragEnabled: boolean;
    showDragColumn: boolean;
    isAllowed: boolean;
    isDeleted: boolean;
    children: React.ReactNode;
    'data-testid'?: string;
    'data-item-type'?: string;
}

const SortableTableRow: React.FC<SortableTableRowProps> = ({
    id,
    dragEnabled,
    showDragColumn,
    isAllowed,
    isDeleted,
    children,
    ...rest
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !dragEnabled,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : !isAllowed || isDeleted ? 0.5 : 1,
        textDecoration: isDeleted ? 'line-through' : undefined,
    };

    return (
        <Table.Tr ref={setNodeRef} style={style} {...attributes} {...rest}>
            {showDragColumn && (
                <Table.Td style={{ width: 50 }}>
                    {dragEnabled ? (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            style={{ cursor: 'grab', touchAction: 'none' }}
                            data-testid={`m2a-drag-handle-${id}`}
                            {...listeners}
                        >
                            <IconGripVertical size={14} />
                        </ActionIcon>
                    ) : null}
                </Table.Td>
            )}
            {children}
        </Table.Tr>
    );
};

// ── DnD helper: Sortable list item wrapper ──
interface SortableListItemProps {
    id: string;
    dragEnabled: boolean;
    /** aria-label of the drag handle */
    reorderLabel: string;
    children: React.ReactNode;
}

const SortableListItem: React.FC<SortableListItemProps> = ({
    id,
    dragEnabled,
    reorderLabel,
    children,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !dragEnabled,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'stretch',
        gap: 4,
    };

    return (
        <Box ref={setNodeRef} style={style} {...attributes}>
            {dragEnabled && (
                <Box
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'grab',
                        touchAction: 'none',
                        padding: '0 4px',
                    }}
                    data-testid={`m2a-drag-handle-${id}`}
                    role="button"
                    aria-label={reorderLabel}
                    {...listeners}
                >
                    <IconGripVertical size={14} color="var(--mantine-color-gray-5)" />
                </Box>
            )}
            <Box style={{ flex: 1 }}>{children}</Box>
        </Box>
    );
};

/**
 * ListM2A - Many-to-Any relationship interface
 * 
 * Similar to DaaS list-m2a interface.
 * Displays items from multiple different collections through a junction table.
 */
export const ListM2A: React.FC<ListM2AProps> = ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value: _value = [],
    onChange: _onChange,
    collection,
    field,
    primaryKey,
    layout = 'list',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tableSpacing: _tableSpacing,
    fields = ['id'],
    prefix,
    disabled = false,
    enableCreate = true,
    enableSelect = true,
    enableSearchFilter = false,
    enableLink = false,
    limit: initialLimit = 15,
    allowDuplicates = false,
    label,
    description,
    error,
    required = false,
    readOnly = false,
    mockItems,
    mockRelationInfo,
    translations,
}) => {
    const t = useBuildpadTranslations((d) => d.interfaces.listM2A, translations);
    const { formatCount } = useBuildpadI18n();

    // `readOnly` was previously destructured into an unused variable, so every
    // mutation affordance below was gated on `disabled` alone and a read-only
    // M2A field stayed fully create/select/delete/reorder capable. Mirrors the
    // `isEffectivelyDisabled` flag ListM2M and ListO2M already use.
    const isEffectivelyDisabled = disabled || readOnly;

    // Determine if we're in demo/mock mode
    const isDemoMode = mockItems !== undefined;

    // Use the custom hook for M2A relationship info (only when not in demo mode)
    const { 
        relationInfo: hookRelationInfo, 
        loading: hookLoading, 
        error: hookError 
    } = useRelationM2A(isDemoMode ? '' : collection, isDemoMode ? '' : field);

    // State for pagination and search
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(initialLimit);
    const [search, setSearch] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [sortField, _setSortField] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [sortDirection, _setSortDirection] = useState<"asc" | "desc">("asc");

    // Internal state for mock items (for demo mode)
    const [internalMockItems, setInternalMockItems] = useState<M2AItem[]>(mockItems || []);

    // Modal states
    const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
    const [selectModalOpened, { open: openSelectModal, close: closeSelectModal }] = useDisclosure(false);
    const [currentlyEditing, setCurrentlyEditing] = useState<M2AItem | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
    
    // Check if parent item is saved. Uses the canonical sentinel set
    // (`isNewItem` knows '+', '%2B' and 'new') — the same helper
    // useRelationM2A.loadItems gates on, so this can't report "saved" for a
    // parent the loader is declining to fetch and then preserve-fetch against
    // a literal 'new' primary key.
    const isParentSaved = !!primaryKey && !isNewItem(primaryKey);

    // Error notification state
    const [selectError, setSelectError] = useState<string | null>(null);

    // Use the items management hook (only when not in demo mode)
    // Now uses local-first ChangesItem pattern – no direct API calls
    const {
        displayItems: hookDisplayItems,
        totalCount: hookTotalCount,
        loading: itemsLoading,
        loadItems,
        createItem,
        createItemWithData,
        removeItem,
        updateItem,
        selectItems,
        reorderItems: hookReorderItems,
        getSelectedPrimaryKeysByCollection,
        getChanges,
        hasChanges,
        resetChanges,
    } = useRelationM2AItems(
        isDemoMode ? null : (hookRelationInfo as M2ARelationInfo | null), 
        isDemoMode ? null : (primaryKey || null)
    );

    // Combined values - use mock data in demo mode, hook data otherwise
    const relationInfo = isDemoMode ? (mockRelationInfo as M2ARelationInfo | undefined) : hookRelationInfo;
    const relationError = isDemoMode ? null : hookError;
    const relationLoading = isDemoMode ? false : hookLoading;

    // Items to render: in demo mode use mock items, otherwise the merged displayItems
    const items: M2AItem[] = isDemoMode ? internalMockItems : hookDisplayItems;
    
    // Visible items (filter out deleted for counting/display, but keep them for undo)
    const visibleItems = useMemo(() => items.filter(i => i.$type !== 'deleted'), [items]);
    
    const totalCount = isDemoMode 
        ? internalMockItems.length 
        : hookTotalCount;
    const loading = isDemoMode ? false : (relationLoading || itemsLoading);

    // Allowed collections (non-singleton)
    const allowedCollections = useMemo(() => {
        return relationInfo?.allowedCollections?.filter(
            c => c.meta?.singleton !== true
        ) || [];
    }, [relationInfo?.allowedCollections]);

    // Per-collection permission maps (DaaS-style)
    const {
        createAllowed: permCreateAllowed,
        selectAllowed: permSelectAllowed,
        updateAllowed: permUpdateAllowed,
        deleteAllowed: permDeleteAllowed,
    } = useRelationPermissionsM2A(isDemoMode ? null : (hookRelationInfo as M2ARelationInfo | null));

    // Collections where user can create new items
    const creatableCollections = useMemo(() => {
        if (isDemoMode) return allowedCollections;
        return allowedCollections.filter(c => permCreateAllowed[c.collection]);
    }, [isDemoMode, allowedCollections, permCreateAllowed]);

    // Collections where user can select existing items
    const selectableCollections = useMemo(() => {
        if (isDemoMode) return allowedCollections;
        if (!permSelectAllowed) return [];
        return allowedCollections;
    }, [isDemoMode, allowedCollections, permSelectAllowed]);

    // Helper: can user edit this item's collection?
    const canEditItem = useCallback((item: M2AItem): boolean => {
        if (isDemoMode) return true;
        const coll = (relationInfo ? item[relationInfo.collectionField.field] as string : null) || (item as Record<string, unknown>).collection as string;
        if (!coll) return false;
        return permUpdateAllowed[coll] ?? false;
    }, [isDemoMode, relationInfo, permUpdateAllowed]);

    // Helper: can user remove/unlink this item?
    const canDeleteItem = useCallback((item: M2AItem): boolean => {
        if (isDemoMode) return true;
        const coll = (relationInfo ? item[relationInfo.collectionField.field] as string : null) || (item as Record<string, unknown>).collection as string;
        if (!coll) return false;
        return permDeleteAllowed[coll] ?? false;
    }, [isDemoMode, relationInfo, permDeleteAllowed]);

    // Get display template for each collection using shared fallback chain
    const getDisplayTemplate = useCallback((collectionName: string) => {
        const collInfo = allowedCollections.find(c => c.collection === collectionName);
        return resolveDisplayTemplate(undefined, { displayTemplate: collInfo?.meta?.display_template });
    }, [allowedCollections]);

    // Use ref for onChange to avoid triggering effect on every render
    const onChangeRef = useRef(_onChange);
    useEffect(() => {
        onChangeRef.current = _onChange;
    }, [_onChange]);

    // Track the changes JSON we last *successfully* emitted for. Set only
    // after an emit completes, so an aborted or cancelled payload build is
    // retried on the next effect run instead of being deduped away.
    const lastEmittedChangesRef = useRef<string>('');
    // Track whether we've ever emitted so we don't clear formData on initial load
    const hasEmittedRef = useRef(false);

    // Notify parent component whenever local changes change.
    // Builds a flat M2A payload for DaaS processM2AField (replace mode):
    //   [{ collection: "coll_name", item: "item_id" }, ...]
    // DaaS deletes ALL junction records for the parent, then inserts exactly
    // the payload (assigning sort from payload order) — so the payload must
    // contain every junction row that should survive, across every page.
    // displayItems is page-scoped, so the surviving rows are re-fetched here
    // unpaginated at build time (fresh per emit, not a mount-time snapshot)
    // and merged with the staged changes. Bare-primitive entries are ignored
    // by processM2AField, so unlike ListO2M each preserved row must be a full
    // { collection, item } object.
    useEffect(() => {
        if (isDemoMode || !relationInfo) return;

        if (!hasChanges) {
            // No local changes. If we previously emitted, clear the form value
            // so saving doesn't accidentally trigger replace-mode with stale data.
            if (hasEmittedRef.current) {
                onChangeRef.current?.(undefined as unknown as M2AItem[]);
                hasEmittedRef.current = false;
                lastEmittedChangesRef.current = '';
            }
            return;
        }

        const currentChanges = getChanges();
        const serialized = JSON.stringify(currentChanges);
        if (serialized === lastEmittedChangesRef.current) return;

        let cancelled = false;

        const collField = relationInfo.collectionField.field;
        const itemField = relationInfo.junctionField.field;
        const sortField = relationInfo.sortField;
        const junctionPK = relationInfo.junctionPrimaryKeyField?.field || 'id';

        const buildAndEmit = async () => {
            // Rows that survive the replace, with the sort value that decides
            // payload order (entries carry no sort of their own — the backend
            // persists payload order as the sort).
            const survivors: { collection: string; itemValue: unknown; sort: number }[] = [];

            if (isParentSaved) {
                // Preserve-fetch: every junction row currently linked to this
                // parent, raw and unpaginated. Staged deletes are dropped and
                // staged sort updates applied below; everything else must be
                // re-sent, or the replace-mode save silently unlinks it.
                try {
                    const { apiRequest } = await import('@buildpad/services');
                    const qp = new URLSearchParams({
                        filter: JSON.stringify({
                            [relationInfo.reverseJunctionField.field]: { _eq: primaryKey },
                        }),
                        fields: [junctionPK, collField, itemField, ...(sortField ? [sortField] : [])].join(','),
                        // `limit=-1` alone is NOT "no limit" here: the route
                        // defaults `page` to 1 regardless, and the range branch
                        // then computes a broken range for limit=-1. `page=0` is
                        // falsy so that branch is skipped entirely.
                        limit: '-1',
                        page: '0',
                        // The route's default count mode is the planner's
                        // estimate; the completeness check below needs the
                        // real number.
                        count: 'exact',
                        meta: 'total_count',
                    });
                    if (sortField) qp.set('sort', sortField);

                    const resp = await apiRequest<
                        { data?: M2AItem[]; meta?: { total_count?: number; filter_count?: number } } | M2AItem[]
                    >(`/api/items/${relationInfo.junctionCollection.collection}?${qp.toString()}`);

                    const rows = (Array.isArray(resp) ? resp : (resp.data || [])) as Record<string, unknown>[];

                    // Completeness check: if the server reports more linked rows
                    // than it returned (a clamped limit, a capped page size),
                    // emitting would silently unlink the difference.
                    const expected = Array.isArray(resp)
                        ? undefined
                        : (resp.meta?.total_count ?? resp.meta?.filter_count);
                    if (typeof expected === 'number' && rows.length !== expected) {
                        console.error(
                            `M2A preserve-fetch returned ${rows.length} of ${expected} junction rows — refusing to emit an incomplete replace payload.`,
                        );
                        return;
                    }

                    const deletedPks = new Set<unknown>(currentChanges.delete);
                    const updatesByPk = new Map(currentChanges.update.map(u => [u[junctionPK], u]));

                    for (const row of rows) {
                        const pk = row[junctionPK];
                        if (deletedPks.has(pk)) continue;
                        // Only the staged *sort* participates here — it decides
                        // payload order. The link itself always comes from the
                        // fetched row: edit staging never retargets a junction
                        // row, and passing staged nested edits through would
                        // deep-create a new related item instead of re-linking.
                        const staged = updatesByPk.get(pk);
                        let sortVal: unknown = sortField ? row[sortField] : undefined;
                        if (sortField && staged && staged[sortField] !== undefined) {
                            sortVal = staged[sortField];
                        }
                        survivors.push({
                            collection: row[collField] as string,
                            itemValue: row[itemField],
                            sort: typeof sortVal === 'number' ? sortVal : Number.POSITIVE_INFINITY,
                        });
                    }
                } catch (err) {
                    console.error('Failed to fetch existing M2A junction rows to preserve on save:', err);
                    // A failed preserve-fetch must NOT fall through to a
                    // changes-only payload — replace mode treats the payload as
                    // the complete set and would delete every other junction
                    // row. Aborting only fails to stage this save; emitting
                    // anyway would destroy data.
                    return;
                }
            }

            // Staged creates: the link value comes from the staged entry.
            for (const entry of currentChanges.create) {
                const collectionName = entry[collField] as string;
                const raw = entry[itemField];

                // Extract the plain item ID. selectItems/createItem stage
                // { [pkField]: id }. createItemWithData stages the new item's
                // fields with no PK (JunctionItemForm.handleSave omits the PK
                // key for new items) — grabbing the first object value here
                // used to return the collection-discriminator string instead
                // of an item id. Pass the whole nested object through so the
                // backend can deep-create the related item.
                let itemValue: unknown;
                if (typeof raw === 'object' && raw !== null) {
                    const nested = raw as Record<string, unknown>;
                    const pkField = relationInfo.relationPrimaryKeyFields?.[collectionName]?.field || 'id';
                    itemValue = nested[pkField] != null ? (nested[pkField] as string | number) : nested;
                } else {
                    itemValue = raw;
                }

                const sortVal = sortField ? entry[sortField] : undefined;
                survivors.push({
                    collection: collectionName,
                    itemValue,
                    sort: typeof sortVal === 'number' ? sortVal : Number.POSITIVE_INFINITY,
                });
            }

            // Payload order carries the sort. Array.prototype.sort is stable,
            // so rows without a numeric sort keep their relative order at the
            // end (fetched rows first, then creates) — same as displayItems.
            if (sortField) {
                survivors.sort((a, b) => a.sort - b.sort);
            }

            const payload = survivors
                .filter(s => s.collection && s.itemValue)
                .map(s => ({
                    [collField]: s.collection,
                    [itemField]: s.itemValue,
                }));

            if (cancelled) return;
            lastEmittedChangesRef.current = serialized;
            onChangeRef.current?.(payload as unknown as M2AItem[]);
            hasEmittedRef.current = true;
        };

        buildAndEmit();
        return () => {
            cancelled = true;
        };
    }, [isDemoMode, relationInfo, getChanges, hasChanges, isParentSaved, primaryKey]);

    // ── Drag & Drop (DnD) setup ──
    // Drag is only allowed when: there's a sortField, not disabled, and all items (across all pages) fit on one page
    const hasSortField = !!relationInfo?.sortField;
    const canDrag = hasSortField && !isEffectivelyDisabled && totalCount <= limit;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Sortable item IDs (must be strings for DnD)
    const sortableIds = useMemo(
        () => visibleItems.map((item) => String(item.id)),
        [visibleItems],
    );

    // Handle drag end → reorder items
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = visibleItems.findIndex((i) => String(i.id) === String(active.id));
            const newIndex = visibleItems.findIndex((i) => String(i.id) === String(over.id));
            if (oldIndex === -1 || newIndex === -1) return;

            const reordered = arrayMove(visibleItems, oldIndex, newIndex);

            if (isDemoMode) {
                setInternalMockItems(reordered);
            } else {
                const pageOffset = (currentPage - 1) * limit;
                hookReorderItems(reordered, pageOffset);
            }
        },
        [visibleItems, isDemoMode, currentPage, limit, hookReorderItems],
    );

    // Load items when parameters change (only for real mode)
    useEffect(() => {
        if (!isDemoMode && relationInfo && primaryKey && primaryKey !== '+') {
            loadItems({
                limit,
                page: currentPage,
                search: enableSearchFilter ? search : undefined,
                sortField,
                sortDirection,
                fields,
            });
        }
    }, [isDemoMode, relationInfo, primaryKey, currentPage, limit, search, sortField, sortDirection, fields, enableSearchFilter, loadItems]);

    // Handle creating new item in a specific collection
    const handleCreateNew = (collectionName: string) => {
        setCurrentlyEditing(null);
        setIsCreatingNew(true);
        setSelectedCollection(collectionName);
        openEditModal();
    };

    // Handle editing existing item
    const handleEditItem = (item: M2AItem) => {
        if (!relationInfo) return;
        const collectionName = item[relationInfo.collectionField.field] as string;
        setCurrentlyEditing(item);
        setIsCreatingNew(false);
        setSelectedCollection(collectionName);
        openEditModal();
    };

    // Handle opening select modal for a specific collection
    const handleOpenSelectModal = (collectionName: string) => {
        setSelectedCollection(collectionName);
        openSelectModal();
    };

    // Handle selecting existing items
    const handleSelectItems = async (selectedIds: (string | number)[]) => {
        if (!selectedCollection) return;
        setSelectError(null);

        // Local-first: stage selections – no API calls
        selectItems(selectedCollection, selectedIds);
        closeSelectModal();
        setSelectedCollection(null);
    };

    // Handle removing item (local-first: just toggle $type)
    const handleRemoveItem = (item: M2AItem) => {
        if (isDemoMode) {
            setInternalMockItems(prev => prev.filter(i => i.id !== item.id));
            return;
        }

        // removeItem handles all cases:
        // - created items → splice from create array
        // - deleted items → undo (splice from delete array)
        // - fetched items → add to delete array
        removeItem(item);
    };

    // Get the collection prefix/label for an item
    const getItemPrefix = (item: M2AItem): string => {
        if (!relationInfo) return '';
        const collectionName = item[relationInfo.collectionField.field] as string || item.collection;
        
        if (prefix) {
            return renderTemplate(prefix, item as Record<string, unknown>);
        }

        const collInfo = allowedCollections.find(c => c.collection === collectionName);
        return collInfo?.name || collectionName || t.unknownCollection;
    };

    // Get display value for an item
    const getItemDisplayValue = (item: M2AItem): string => {
        if (!relationInfo) return String(item.id);
        
        const collectionName = item[relationInfo.collectionField.field] as string || item.collection;
        const itemData = item[relationInfo.junctionField.field] || item.item;
        
        if (!itemData) return String(item.id);

        const template = getDisplayTemplate(collectionName || '');
        
        if (typeof itemData === 'object' && itemData !== null) {
            return renderTemplate(template, itemData as Record<string, unknown>);
        }

        return String(itemData);
    };

    // Check if item's collection is still allowed
    const isCollectionAllowed = (item: M2AItem): boolean => {
        if (!relationInfo) return false;
        const cfField = relationInfo.collectionField.field;
        const collectionName = item[cfField] as string || (item as Record<string, unknown>).collection as string;
        return allowedCollections.some(c => c.collection === collectionName);
    };

    const totalPages = Math.ceil(totalCount / limit);

    // Show relation error (only in non-demo mode)
    if (!isDemoMode && relationError) {
        return (
            <Alert 
                icon={<IconAlertCircle size={16} />} 
                title={t.configError.title} 
                color="red" 
                data-testid="m2a-error"
            >
                {relationError}
            </Alert>
        );
    }

    // In non-demo mode, show warning if no allowed collections
    if (!isDemoMode && relationInfo && allowedCollections.length === 0 && !relationLoading) {
        return (
            <Alert 
                icon={<IconAlertCircle size={16} />} 
                title={t.noCollections.title} 
                color="warning" 
                data-testid="m2a-no-collections"
            >
                {t.noCollections.message}
            </Alert>
        );
    }

    // In non-demo mode, show warning if relationship not configured
    if (!isDemoMode && !relationInfo && !relationLoading) {
        return (
            <Alert 
                icon={<IconAlertCircle size={16} />} 
                title={t.notConfigured.title} 
                color="warning" 
                data-testid="m2a-not-configured"
            >
                {t.notConfigured.message}
            </Alert>
        );
    }

    return (
        <Stack gap="sm" data-testid="list-m2a">
            {label && (
                <Group>
                    <Text size="sm" fw={500}>
                        {label}
                        {required && <Text span c="red"> *</Text>}
                    </Text>
                </Group>
            )}

            {description && (
                <Text size="xs" c="dimmed">{description}</Text>
            )}

            <Paper p="md" withBorder pos="relative">
                <LoadingOverlay visible={loading} />

                {/* Header Actions */}
                <Group justify="space-between" mb="md">
                    <Group>
                        {enableSearchFilter && layout === 'table' && (
                            <TextInput
                                placeholder={t.searchPlaceholder}
                                leftSection={<IconSearch size={16} />}
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.currentTarget.value);
                                    setCurrentPage(1);
                                }}
                                style={{ width: 250 }}
                                data-testid="m2a-search"
                            />
                        )}
                    </Group>

                    <Group>
                        {totalCount > 0 && (
                            <Text size="sm" c="dimmed" data-testid="m2a-count">
                                {formatCount(totalCount, t.itemCount)}
                            </Text>
                        )}

                        {!isEffectivelyDisabled && enableSelect && selectableCollections.length > 0 && (
                            <Menu shadow="md" width={200}>
                                <Menu.Target>
                                    <Button
                                        variant="light"
                                        leftSection={<IconPlus size={16} />}
                                        rightSection={<IconDropdown size={14} />}
                                        data-testid="m2a-select-btn"
                                    >
                                        {t.addExisting}
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    {selectableCollections.map(coll => (
                                        <Menu.Item
                                            key={coll.collection}
                                            leftSection={<IconBox size={14} />}
                                            onClick={() => handleOpenSelectModal(coll.collection)}
                                            data-testid={`m2a-select-${coll.collection}`}
                                        >
                                            {coll.name || coll.collection}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                        )}

                        {!isEffectivelyDisabled && enableCreate && creatableCollections.length > 0 && (
                            <Menu shadow="md" width={200}>
                                <Menu.Target>
                                    <Tooltip 
                                        label={t.saveFirstHint}
                                        disabled={!!isParentSaved}
                                    >
                                        <Button
                                            leftSection={<IconPlus size={16} />}
                                            rightSection={<IconDropdown size={14} />}
                                            disabled={!isParentSaved}
                                            data-testid="m2a-create-btn"
                                        >
                                            {t.createNew}
                                        </Button>
                                    </Tooltip>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    {creatableCollections.map(coll => (
                                        <Menu.Item
                                            key={coll.collection}
                                            leftSection={<IconBox size={14} />}
                                            onClick={() => handleCreateNew(coll.collection)}
                                            data-testid={`m2a-create-${coll.collection}`}
                                        >
                                            {coll.name || coll.collection}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                        )}
                    </Group>
                </Group>

                {/* Unsaved changes notice */}
                {!isDemoMode && hasChanges && (
                    <Alert icon={<IconAlertCircle size={16} />} color="info" mb="md" data-testid="m2a-unsaved-notice">
                        {t.unsavedChanges}
                    </Alert>
                )}

                {/* Error notification */}
                {selectError && (
                    <Alert 
                        icon={<IconAlertCircle size={16} />} 
                        color="red" 
                        mb="md" 
                        withCloseButton 
                        onClose={() => setSelectError(null)}
                    >
                        {selectError}
                    </Alert>
                )}

                {/* Drag disabled notice (paginated) */}
                {hasSortField && !isEffectivelyDisabled && totalCount > limit && (
                    <Alert icon={<IconAlertCircle size={16} />} color="warning" mb="md" data-testid="m2a-drag-disabled-notice">
                        {t.dragDisabledPaginated}
                    </Alert>
                )}

                {/* Content */}
                {items.length === 0 && !loading ? (
                    <Paper p="xl" style={{ textAlign: 'center' }} data-testid="m2a-empty">
                        <Text c="dimmed">{t.noItems}</Text>
                    </Paper>
                ) : layout === 'table' ? (
                    /* Table Layout — wrapped with DnD */
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <Table striped highlightOnHover data-testid="m2a-table">
                        <Table.Thead>
                            <Table.Tr>
                                {hasSortField && (
                                    <Table.Th style={{ width: 50 }}></Table.Th>
                                )}
                                <Table.Th style={{ width: 150 }}>{t.columns.collection}</Table.Th>
                                <Table.Th>{t.columns.item}</Table.Th>
                                <Table.Th style={{ width: 120 }}>{t.columns.actions}</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {items.map((item) => {
                                const isAllowed = isCollectionAllowed(item);
                                const isDeleted = item.$type === 'deleted';
                                const isCreated = item.$type === 'created';
                                const isUpdated = item.$type === 'updated';
                                
                                return (
                                    <SortableTableRow 
                                        key={item.id} 
                                        id={String(item.id)}
                                        dragEnabled={canDrag && !isDeleted}
                                        showDragColumn={hasSortField}
                                        isAllowed={isAllowed}
                                        isDeleted={isDeleted}
                                        data-testid={`m2a-row-${item.id}`}
                                        data-item-type={item.$type}
                                    >
                                        <Table.Td>
                                            <Badge 
                                                color={isAllowed ? 'blue' : 'gray'}
                                                variant="light"
                                            >
                                                {getItemPrefix(item)}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            {isAllowed ? (
                                                <Group gap="xs">
                                                    <Text size="sm" td={isDeleted ? 'line-through' : undefined}>{getItemDisplayValue(item)}</Text>
                                                    {isCreated && <Badge size="xs" color="green" variant="light">{t.badges.new}</Badge>}
                                                    {isUpdated && <Badge size="xs" color="warning" variant="light">{t.badges.edited}</Badge>}
                                                    {isDeleted && <Badge size="xs" color="red" variant="light">{t.badges.removed}</Badge>}
                                                </Group>
                                            ) : (
                                                <Group gap="xs">
                                                <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
                                                    <Text size="sm" c="dimmed">{t.invalidItem}</Text>
                                                </Group>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                {enableLink && isAllowed && !isDeleted && (
                                                    <Tooltip label={t.actions.viewItem}>
                                                        <ActionIcon
                                                            variant="subtle"
                                                            size="sm"
                                                            data-testid={`m2a-link-${item.id}`}
                                                        >
                                                            <IconExternalLink size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}

                                                {!isEffectivelyDisabled && isAllowed && !isDeleted && canEditItem(item) && (
                                                    <Tooltip label={t.actions.edit}>
                                                        <ActionIcon
                                                            variant="subtle"
                                                            color="gray"
                                                            size="sm"
                                                            onClick={() => handleEditItem(item)}
                                                            data-testid={`m2a-edit-${item.id}`}
                                                        >
                                                            <IconEdit size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}

                                                {!isEffectivelyDisabled && isDeleted && (
                                                    <Tooltip label={t.actions.undoRemove}>
                                                        <ActionIcon
                                                            variant="subtle"
                                                            size="sm"
                                                            onClick={() => handleRemoveItem(item)}
                                                            data-testid={`m2a-undo-${item.id}`}
                                                        >
                                                            <IconArrowBackUp size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}

                                                {!isEffectivelyDisabled && !isDeleted && canDeleteItem(item) && (
                                                    <Tooltip label={t.actions.remove}>
                                                        <ActionIcon
                                                            variant="subtle"
                                                            color="red"
                                                            size="sm"
                                                            onClick={() => handleRemoveItem(item)}
                                                            data-testid={`m2a-remove-${item.id}`}
                                                        >
                                                            <IconTrash size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </Group>
                                        </Table.Td>
                                    </SortableTableRow>
                                );
                            })}
                        </Table.Tbody>
                    </Table>
                    </SortableContext>
                    </DndContext>
                ) : (
                    /* List Layout — wrapped with DnD */
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <Stack gap="xs" data-testid="m2a-list">
                        {items.map((item) => {
                            const isAllowed = isCollectionAllowed(item);
                            const isDeleted = item.$type === 'deleted';
                            const isCreated = item.$type === 'created';
                            const isUpdated = item.$type === 'updated';
                            
                            return (
                                <SortableListItem
                                    key={item.id}
                                    id={String(item.id)}
                                    dragEnabled={canDrag && !isDeleted}
                                    reorderLabel={t.reorderItem}
                                >
                                <Paper
                                    p="sm"
                                    withBorder
                                    style={{ 
                                        cursor: disabled || !isAllowed || isDeleted || !canEditItem(item) ? 'default' : 'pointer',
                                        opacity: !isAllowed || isDeleted ? 0.5 : 1,
                                        textDecoration: isDeleted ? 'line-through' : undefined,
                                        borderColor: isCreated ? 'var(--mantine-color-green-4)' : isUpdated ? 'var(--mantine-color-yellow-4)' : isDeleted ? 'var(--mantine-color-red-3)' : undefined,
                                    }}
                                    onClick={() => !isEffectivelyDisabled && isAllowed && !isDeleted && canEditItem(item) && handleEditItem(item)}
                                    data-testid={`m2a-item-${item.id}`}
                                    data-item-type={item.$type}
                                >
                                    <Group justify="space-between">
                                        <Group>
                                            {isAllowed ? (
                                                <Group gap="xs">
                                                    <Text c="var(--mantine-primary-color-6)" fw={500}>{interpolate(t.prefixFormat, { prefix: getItemPrefix(item) })}</Text>
                                                    <Text td={isDeleted ? 'line-through' : undefined}>
                                                        {getItemDisplayValue(item)}
                                                    </Text>
                                                    {isCreated && <Badge size="xs" color="green" variant="light">{t.badges.new}</Badge>}
                                                    {isUpdated && <Badge size="xs" color="warning" variant="light">{t.badges.edited}</Badge>}
                                                    {isDeleted && <Badge size="xs" color="red" variant="light">{t.badges.removed}</Badge>}
                                                </Group>
                                            ) : (
                                                <Group gap="xs">
                                                    <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
                                                    <Text c="dimmed">{t.invalidItem}</Text>
                                                </Group>
                                            )}
                                        </Group>
                                        
                                        <Group gap="xs">
                                            {enableLink && isAllowed && !isDeleted && (
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                    data-testid={`m2a-list-link-${item.id}`}
                                                >
                                                    <IconExternalLink size={14} />
                                                </ActionIcon>
                                            )}
                                            {!isEffectivelyDisabled && isDeleted && (
                                                <Tooltip label={t.actions.undoRemove}>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveItem(item); // toggles undo for deleted items
                                                        }}
                                                        data-testid={`m2a-list-undo-${item.id}`}
                                                    >
                                                        <IconArrowBackUp size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                            {!isEffectivelyDisabled && !isDeleted && canDeleteItem(item) && (
                                                <Tooltip label={t.actions.remove}>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveItem(item);
                                                        }}
                                                        data-testid={`m2a-list-remove-${item.id}`}
                                                    >
                                                        <IconTrash size={14} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </Group>
                                    </Group>
                                </Paper>
                                </SortableListItem>
                            );
                        })}
                    </Stack>
                    </SortableContext>
                    </DndContext>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <Group justify="space-between" mt="md" data-testid="m2a-pagination">
                        <Group>
                            <Text size="sm" c="dimmed">
                                {interpolate(t.showingRange, {
                                    start: ((currentPage - 1) * limit) + 1,
                                    end: Math.min(currentPage * limit, totalCount),
                                    total: totalCount,
                                })}
                            </Text>
                        </Group>

                        <Group>
                            <Text size="sm">{t.perPage}</Text>
                            <Select
                                value={String(limit)}
                                onChange={(value) => {
                                    if (value) {
                                        setLimit(Number(value));
                                        setCurrentPage(1);
                                    }
                                }}
                                data={['10', '15', '25', '50', '100']}
                                style={{ width: 80 }}
                                data-testid="m2a-per-page"
                            />

                            <Pagination
                                value={currentPage}
                                onChange={setCurrentPage}
                                total={totalPages}
                                size="sm"
                                data-testid="m2a-pagination-control"
                            />
                        </Group>
                    </Group>
                )}
            </Paper>

            {error && (
                <Text size="xs" c="red" data-testid="m2a-error-text">
                    {typeof error === 'string' ? error : t.invalidValue}
                </Text>
            )}

            {/* Edit Modal — junction-based form (two sections: related item + junction metadata) */}
            <Modal
                opened={editModalOpened}
                onClose={() => {
                    closeEditModal();
                    setCurrentlyEditing(null);
                    setSelectedCollection(null);
                }}
                title={
                    isCreatingNew
                        ? interpolate(t.editModal.createTitle, { collection: selectedCollection })
                        : interpolate(t.editModal.editTitle, { collection: selectedCollection })
                }
                size="lg"
            >
                {selectedCollection && relationInfo && (
                    <JunctionItemForm
                        relationInfo={relationInfo}
                        item={currentlyEditing}
                        targetCollection={selectedCollection}
                        isNew={isCreatingNew}
                        parentPrimaryKey={primaryKey}
                        disabled={isEffectivelyDisabled}
                        translations={translations}
                        onCancel={() => {
                            closeEditModal();
                            setCurrentlyEditing(null);
                            setSelectedCollection(null);
                        }}
                        onSave={(edits) => {
                            if (isCreatingNew && relationInfo) {
                                // `edits` is JunctionItemForm's combined payload:
                                // { ...junctionEdits, [collectionField]: targetCollection,
                                //   [junctionField]: relatedPayload }. createItemWithData
                                // nests whatever it's given a second time under
                                // junctionField, so passing `edits` itself (not just the
                                // related item's own fields) doubly-wraps it — the emitted
                                // junction value ends up keyed by collectionField first,
                                // and reading its first value as "the item id" (elsewhere)
                                // returned the collection name string, not an item id.
                                // Pass only the nested related-item fields as itemData,
                                // and any other junction-level edits as additionalData.
                                const junctionFieldName = relationInfo.junctionField.field;
                                const collectionFieldName = relationInfo.collectionField.field;
                                const {
                                    [junctionFieldName]: nestedItemData,
                                    [collectionFieldName]: _collectionDiscriminator,
                                    ...additionalJunctionData
                                } = edits as Record<string, unknown>;
                                createItemWithData(
                                    selectedCollection || '',
                                    (nestedItemData as Record<string, unknown>) ?? {},
                                    additionalJunctionData,
                                );
                            } else if (currentlyEditing) {
                                // Stage an update to the junction row (includes nested related edits)
                                updateItem(currentlyEditing, edits);
                            }
                            closeEditModal();
                            setCurrentlyEditing(null);
                            setSelectedCollection(null);
                        }}
                    />
                )}
            </Modal>

            {/* Select Modal */}
            <Modal
                opened={selectModalOpened}
                onClose={() => {
                    closeSelectModal();
                    setSelectedCollection(null);
                    setSelectError(null);
                }}
                title={interpolate(t.selectModal.title, { collection: selectedCollection })}
                size="xl"
            >
                {/* Error */}
                {selectError && (
                    <Alert 
                        icon={<IconAlertCircle size={16} />} 
                        title={t.selectModal.errorTitle} 
                        color="red" 
                        mb="md"
                        withCloseButton
                        onClose={() => setSelectError(null)}
                    >
                        {selectError}
                    </Alert>
                )}

                {/* Staged notice – local-first, changes are always staged */}
                {!selectError && (
                    <Alert 
                        icon={<IconAlertCircle size={16} />} 
                        title={t.selectModal.stagedTitle} 
                        color="info" 
                        mb="md"
                    >
                        {t.selectModal.stagedMessage}
                    </Alert>
                )}

                {selectedCollection && (
                    <Box p="md">
                        <CollectionList
                            collection={selectedCollection}
                            enableSelection
                            filter={!allowDuplicates ? (() => {
                                const selectedByCollection = getSelectedPrimaryKeysByCollection();
                                const selectedIds = selectedByCollection[selectedCollection] || [];
                                if (selectedIds.length === 0) return undefined;
                                // Use actual PK field from relation info (not hardcoded "id")
                                const pkField = relationInfo?.relationPrimaryKeyFields?.[selectedCollection]?.field || 'id';
                                return {
                                    [pkField]: { _nin: selectedIds }
                                };
                            })() : undefined}
                            bulkActions={[
                                {
                                    label: t.selectModal.addSelected,
                                    icon: <IconPlus size={14} />,
                                    action: handleSelectItems,
                                }
                            ]}
                        />
                    </Box>
                )}
            </Modal>
        </Stack>
    );
};

export default ListM2A;
