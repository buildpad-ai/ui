"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { renderTemplate } from "./render-template";
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
    children: React.ReactNode;
}

const SortableListItem: React.FC<SortableListItemProps> = ({
    id,
    dragEnabled,
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    readOnly: _readOnly,
    mockItems,
    mockRelationInfo,
}) => {
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
    
    // Check if parent item is saved (has valid primary key, not '+' which means new)
    const isParentSaved = primaryKey && primaryKey !== '+';

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
        moveItemUp: hookMoveItemUp,
        moveItemDown: hookMoveItemDown,
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

    // Get display template for each collection
    const getDisplayTemplate = useCallback((collectionName: string) => {
        const collInfo = allowedCollections.find(c => c.collection === collectionName);
        return collInfo?.meta?.display_template || `{{id}}`;
    }, [allowedCollections]);

    // Use ref for onChange to avoid triggering effect on every render
    const onChangeRef = useRef(_onChange);
    useEffect(() => {
        onChangeRef.current = _onChange;
    }, [_onChange]);

    // Track previous changes JSON to avoid duplicate onChange emissions
    const prevChangesRef = useRef<string>('');
    // Track whether we've ever emitted so we don't clear formData on initial load
    const hasEmittedRef = useRef(false);

    // Notify parent component whenever local changes change.
    // Builds a flat M2A payload for DaaS processM2AField (replace mode):
    //   [{ collection: "coll_name", item: "item_id" }, ...]
    // Must include ALL visible items (fetched + created - deleted) because
    // DaaS deletes all existing junction records, then inserts the payload.
    useEffect(() => {
        if (isDemoMode || !relationInfo) return;

        if (!hasChanges) {
            // No local changes. If we previously emitted, clear the form value
            // so saving doesn't accidentally trigger replace-mode with stale data.
            if (hasEmittedRef.current) {
                onChangeRef.current?.(undefined as unknown as M2AItem[]);
                hasEmittedRef.current = false;
                prevChangesRef.current = '';
            }
            return;
        }

        const currentChanges = getChanges();
        const serialized = JSON.stringify(currentChanges);

        if (serialized === prevChangesRef.current) return;
        prevChangesRef.current = serialized;

        // Build the full M2A replacement payload from all non-deleted items.
        const collField = relationInfo.collectionField.field;
        const itemField = relationInfo.junctionField.field;

        const payload = hookDisplayItems
            .filter(item => item.$type !== 'deleted')
            .map(item => {
                const collectionName = item[collField] as string;
                const junctionFieldValue = item[itemField];

                // Extract the plain item ID.
                // loadItems enrichment replaces the flat junction ID with a nested
                // object like { id: "uuid", title: "..." }. For locally-created
                // items it's { id: "uuid" }. We need the flat ID for the backend.
                let itemId: string | number | undefined;
                if (typeof junctionFieldValue === 'object' && junctionFieldValue !== null) {
                    const nested = junctionFieldValue as Record<string, unknown>;
                    itemId = (nested.id ?? Object.values(nested)[0]) as string | number;
                } else {
                    itemId = junctionFieldValue as string | number;
                }

                return {
                    [collField]: collectionName,
                    [itemField]: itemId,
                };
            })
            .filter(entry => entry[collField] && entry[itemField]);

        onChangeRef.current?.(payload as unknown as M2AItem[]);
        hasEmittedRef.current = true;
    }, [isDemoMode, relationInfo, getChanges, hasChanges, hookDisplayItems]);

    // Functions that work for both demo and real mode
    const moveItemUp = (index: number) => {
        if (isDemoMode) {
            if (index <= 0) return;
            const newItems = [...internalMockItems];
            [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
            setInternalMockItems(newItems);
        } else {
            hookMoveItemUp(index);
        }
    };

    const moveItemDown = (index: number) => {
        if (isDemoMode) {
            if (index >= internalMockItems.length - 1) return;
            const newItems = [...internalMockItems];
            [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
            setInternalMockItems(newItems);
        } else {
            hookMoveItemDown(index);
        }
    };

    // ── Drag & Drop (DnD) setup ──
    // Drag is only allowed when: there's a sortField, not disabled, and all items fit on one page
    const hasSortField = !!relationInfo?.sortField;
    const canDrag = hasSortField && !disabled && visibleItems.length <= limit;

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

            // Move item from oldIndex to newIndex using repeated up/down
            if (oldIndex < newIndex) {
                for (let i = oldIndex; i < newIndex; i++) moveItemDown(i);
            } else {
                for (let i = oldIndex; i > newIndex; i--) moveItemUp(i);
            }
        },
        [visibleItems, moveItemUp, moveItemDown],
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
        return collInfo?.name || collectionName || 'Unknown';
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
                title="Configuration Error" 
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
                title="No available collections" 
                color="warning" 
                data-testid="m2a-no-collections"
            >
                No non-singleton collections are configured for this M2A relationship.
            </Alert>
        );
    }

    // In non-demo mode, show warning if relationship not configured
    if (!isDemoMode && !relationInfo && !relationLoading) {
        return (
            <Alert 
                icon={<IconAlertCircle size={16} />} 
                title="Relationship not configured" 
                color="warning" 
                data-testid="m2a-not-configured"
            >
                The many-to-any relationship is not properly configured for this field.
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
                                placeholder="Search..."
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
                                {totalCount} item{totalCount !== 1 ? 's' : ''}
                            </Text>
                        )}

                        {!disabled && enableSelect && selectableCollections.length > 0 && (
                            <Menu shadow="md" width={200}>
                                <Menu.Target>
                                    <Button
                                        variant="light"
                                        leftSection={<IconPlus size={16} />}
                                        rightSection={<IconDropdown size={14} />}
                                        data-testid="m2a-select-btn"
                                    >
                                        Add Existing
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

                        {!disabled && enableCreate && creatableCollections.length > 0 && (
                            <Menu shadow="md" width={200}>
                                <Menu.Target>
                                    <Tooltip 
                                        label="Save the item first before creating related items"
                                        disabled={!!isParentSaved}
                                    >
                                        <Button
                                            leftSection={<IconPlus size={16} />}
                                            rightSection={<IconDropdown size={14} />}
                                            disabled={!isParentSaved}
                                            data-testid="m2a-create-btn"
                                        >
                                            Create New
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
                        You have unsaved changes. Save the parent item to persist them.
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
                {hasSortField && !disabled && visibleItems.length > limit && (
                    <Alert icon={<IconAlertCircle size={16} />} color="yellow" mb="md" data-testid="m2a-drag-disabled-notice">
                        Drag &amp; drop sorting is disabled when items are paginated. Reduce items or increase page size to enable.
                    </Alert>
                )}

                {/* Content */}
                {items.length === 0 && !loading ? (
                    <Paper p="xl" style={{ textAlign: 'center' }} data-testid="m2a-empty">
                        <Text c="dimmed">No items</Text>
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
                                <Table.Th style={{ width: 150 }}>Collection</Table.Th>
                                <Table.Th>Item</Table.Th>
                                <Table.Th style={{ width: 120 }}>Actions</Table.Th>
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
                                                    {isCreated && <Badge size="xs" color="green" variant="light">new</Badge>}
                                                    {isUpdated && <Badge size="xs" color="yellow" variant="light">edited</Badge>}
                                                    {isDeleted && <Badge size="xs" color="red" variant="light">removed</Badge>}
                                                </Group>
                                            ) : (
                                                <Group gap="xs">
                                                <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
                                                    <Text size="sm" c="dimmed">Invalid item</Text>
                                                </Group>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs">
                                                {enableLink && isAllowed && !isDeleted && (
                                                    <Tooltip label="View item">
                                                        <ActionIcon
                                                            variant="subtle"
                                                            size="sm"
                                                            data-testid={`m2a-link-${item.id}`}
                                                        >
                                                            <IconExternalLink size={14} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}

                                                {!disabled && isAllowed && !isDeleted && canEditItem(item) && (
                                                    <Tooltip label="Edit">
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

                                                {!disabled && isDeleted && (
                                                    <Tooltip label="Undo remove">
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

                                                {!disabled && !isDeleted && canDeleteItem(item) && (
                                                    <Tooltip label="Remove">
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
                                    onClick={() => !disabled && isAllowed && !isDeleted && canEditItem(item) && handleEditItem(item)}
                                    data-testid={`m2a-item-${item.id}`}
                                    data-item-type={item.$type}
                                >
                                    <Group justify="space-between">
                                        <Group>
                                            {isAllowed ? (
                                                <Group gap="xs">
                                                    <Text c="var(--mantine-primary-color-6)" fw={500}>{getItemPrefix(item)}:</Text>
                                                    <Text td={isDeleted ? 'line-through' : undefined}>
                                                        {getItemDisplayValue(item)}
                                                    </Text>
                                                    {isCreated && <Badge size="xs" color="green" variant="light">new</Badge>}
                                                    {isUpdated && <Badge size="xs" color="yellow" variant="light">edited</Badge>}
                                                    {isDeleted && <Badge size="xs" color="red" variant="light">removed</Badge>}
                                                </Group>
                                            ) : (
                                                <Group gap="xs">
                                                    <IconAlertCircle size={14} color="var(--mantine-color-yellow-6)" />
                                                    <Text c="dimmed">Invalid item</Text>
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
                                            {!disabled && isDeleted && (
                                                <Tooltip label="Undo remove">
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
                                            {!disabled && !isDeleted && canDeleteItem(item) && (
                                                <Tooltip label="Remove">
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
                                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount}
                            </Text>
                        </Group>

                        <Group>
                            <Text size="sm">Items per page:</Text>
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
                    {typeof error === 'string' ? error : 'Invalid value'}
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
                title={isCreatingNew ? `Create New ${selectedCollection}` : `Edit ${selectedCollection}`}
                size="lg"
            >
                {selectedCollection && relationInfo && (
                    <JunctionItemForm
                        relationInfo={relationInfo}
                        item={currentlyEditing}
                        targetCollection={selectedCollection}
                        isNew={isCreatingNew}
                        parentPrimaryKey={primaryKey}
                        disabled={disabled}
                        onCancel={() => {
                            closeEditModal();
                            setCurrentlyEditing(null);
                            setSelectedCollection(null);
                        }}
                        onSave={(edits) => {
                            if (isCreatingNew) {
                                // Stage a junction create with the related item nested
                                createItemWithData(selectedCollection || '', edits);
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
                title={`Select from ${selectedCollection}`}
                size="xl"
            >
                {/* Error */}
                {selectError && (
                    <Alert 
                        icon={<IconAlertCircle size={16} />} 
                        title="Error" 
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
                        title="Items will be linked when you save" 
                        color="info" 
                        mb="md"
                    >
                        Selected items will be staged locally and saved when you save the parent item.
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
                                    label: "Add Selected",
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
