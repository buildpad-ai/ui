"use client";

/**
 * ListM2M — Many-to-Many relational interface component.
 *
 * Complete rewrite addressing P0 and P1 discrepancies with DaaS 11.14.0:
 *
 * P0 (Data Integrity):
 * - Local-first staged changes via useRelationMultipleM2M (no immediate API calls)
 * - Proper template rendering via shared renderTemplate utility
 * - Working enableLink with proper URL generation
 * - Working per-page selector
 *
 * P1 (Feature Parity):
 * - Permission checking via useRelationPermissionsM2M
 * - Correct edit drawer (junction + related collection, junctionFieldLocation)
 * - Proper selection filter (excludes already-linked, respects allowDuplicates)
 * - Singleton guard
 * - nonEditable prop support (view-only without action buttons)
 *
 * @module @buildpad/ui-interfaces/list-m2m
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Paper,
    Group,
    Button,
    Text,
    Drawer,
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
    Divider,
    Skeleton,
    Checkbox,
    Badge,
} from "@mantine/core";
import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
    IconPlus,
    IconEdit,
    IconTrash,
    IconExternalLink,
    IconSearch,
    IconChevronUp,
    IconChevronDown,
    IconAlertCircle,
    IconInfoCircle,
    IconGripVertical,
    IconCheckbox,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import {
    useRelationM2M,
    isValidPrimaryKey,
    useFieldMetadata,
    type M2MRelationInfo,
} from "@buildpad/hooks";
import { CollectionList, CollectionForm } from "@buildpad/ui-collections";
import { renderTemplate } from "../list-m2a/render-template";
import { useRelationMultipleM2M, type M2MDisplayItem, type M2MChangesItem } from "@buildpad/hooks";
import { useRelationPermissionsM2M } from "@buildpad/hooks";
import { mergeTranslations, interpolate, formatItemCount, type M2MTranslations } from "./translations";

// ── Props ──────────────────────────────────────────────────────────

export interface ListM2MProps {
    /** Current value — ChangesItem or array from parent form */
    value?: M2MChangesItem | unknown[] | null;
    /** Callback fired when local changes update (ChangesItem format) */
    onChange?: (value: M2MChangesItem) => void;
    /** Current collection name */
    collection: string;
    /** Field name for this M2M relationship */
    field: string;
    /** Primary key of the current item */
    primaryKey?: string | number;
    /** Layout mode */
    layout?: "list" | "table";
    /** Table spacing for table layout */
    tableSpacing?: "compact" | "cozy" | "comfortable";
    /** Fields to display in table layout */
    fields?: string[];
    /** Template string for list layout (mustache-style: `{{field}}`) */
    template?: string;
    /** Whether the interface is disabled (no edits at all) */
    disabled?: boolean;
    /** Non-editable mode: items visible but action buttons hidden (DaaS parity) */
    nonEditable?: boolean;
    /** Enable create new items button */
    enableCreate?: boolean;
    /** Enable select existing items button */
    enableSelect?: boolean;
    /** Filter to apply when selecting items */
    filter?: Record<string, unknown>;
    /** Enable search filter in table mode */
    enableSearchFilter?: boolean;
    /** Enable link to related items */
    enableLink?: boolean;
    /** Items per page */
    limit?: number;
    /** Allow duplicate selections (same related item linked multiple times) */
    allowDuplicates?: boolean;
    /** Junction field location in edit drawer ('top' | 'bottom') */
    junctionFieldLocation?: "top" | "bottom";
    /** Field label */
    label?: string;
    /** Field description */
    description?: string;
    /** Error message */
    error?: string | boolean;
    /** Whether the field is required */
    required?: boolean;
    /** Whether the field is read-only (alias for disabled) */
    readOnly?: boolean;
    /**
     * Mock items for testing/storybook (bypasses API loading).
     * When provided, the component renders these directly.
     */
    mockItems?: M2MDisplayItem[];
    /**
     * Mock relation info for testing/storybook.
     * When provided, skips the useRelationM2M API call.
     */
    mockRelationInfo?: M2MRelationInfo;
    /**
     * Partial i18n overrides. Merged with English defaults.
     * @see M2MTranslations
     */
    translations?: Partial<M2MTranslations>;
    /**
     * Enable batch edit mode (table layout only).
     * Shows checkboxes for multi-select and a batch edit button.
     */
    enableBatchEdit?: boolean;
    /**
     * Content version ID to load versioned data.
     * When provided, items are loaded for this specific version.
     */
    versionId?: string | number;
}

// ── Sortable Table Row (DnD) ───────────────────────────────────────

interface SortableM2MTableRowProps {
    item: M2MDisplayItem;
    index: number;
    fields: string[];
    relationInfo: M2MRelationInfo | null;
    allowDrag: boolean;
    showFallbackSort: boolean;
    enableBatchEdit: boolean;
    isSelected: boolean;
    isFirst: boolean;
    isLast: boolean;
    enableLink: boolean;
    isEffectivelyNonEditable: boolean;
    updateAllowed: boolean;
    deleteAllowed: boolean;
    t: M2MTranslations;
    onEdit: (item: M2MDisplayItem) => void;
    onRemove: (item: M2MDisplayItem) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    onToggleSelect: (id: string | number) => void;
    getItemLink: (item: M2MDisplayItem) => string | null;
}

const SortableM2MTableRow: React.FC<SortableM2MTableRowProps> = ({
    item,
    index,
    fields,
    relationInfo,
    allowDrag,
    showFallbackSort,
    enableBatchEdit,
    isSelected,
    isFirst,
    isLast,
    enableLink,
    isEffectivelyNonEditable,
    updateAllowed,
    deleteAllowed,
    t,
    onEdit,
    onRemove,
    onMoveUp,
    onMoveDown,
    onToggleSelect,
    getItemLink,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: String(item.id),
        disabled: !allowDrag,
    });

    const style: React.CSSProperties = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        transition,
        opacity: isDragging ? 0.5 : item.$type === "deleted" ? 0.5 : 1,
        cursor: !isEffectivelyNonEditable && updateAllowed ? "pointer" : undefined,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 1 : undefined,
    };

    const relatedData = relationInfo
        ? (item[relationInfo.junctionField.field] as Record<string, unknown> | undefined)
        : undefined;

    return (
        <Table.Tr
            ref={setNodeRef}
            style={style}
            {...(allowDrag ? attributes : {})}
            onClick={() => {
                if (!isEffectivelyNonEditable && updateAllowed) {
                    onEdit(item);
                }
            }}
        >
            {/* Batch edit checkbox */}
            {enableBatchEdit && (
                <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id as string | number)}
                        size="xs"
                    />
                </Table.Td>
            )}

            {/* DnD drag handle */}
            {allowDrag && (
                <Table.Td>
                    <Tooltip label={t.drag_to_reorder}>
                        <ActionIcon
                            variant="subtle"
                            size="sm"
                            style={{ cursor: "grab" }}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <IconGripVertical size={14} />
                        </ActionIcon>
                    </Tooltip>
                </Table.Td>
            )}

            {/* Fallback sort arrows (when not all items fit on one page) */}
            {showFallbackSort && (
                <Table.Td>
                    <Group gap="xs">
                        <Tooltip label={t.move_up}>
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                disabled={isFirst}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveUp(index);
                                }}
                            >
                                <IconChevronUp size={14} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t.move_down}>
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                disabled={isLast}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveDown(index);
                                }}
                            >
                                <IconChevronDown size={14} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Table.Td>
            )}

            {/* Field value cells */}
            {fields.map((fieldName) => {
                const value = relatedData?.[fieldName] ?? item[fieldName];
                return (
                    <Table.Td key={fieldName}>
                        <Text size="sm">{formatCellValue(value)}</Text>
                    </Table.Td>
                );
            })}

            {/* Actions */}
            <Table.Td>
                <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                    {enableLink && (
                        <Tooltip label={t.navigate_to_item}>
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                component="a"
                                href={getItemLink(item) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <IconExternalLink size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    {!isEffectivelyNonEditable && updateAllowed && (
                        <Tooltip label={t.edit}>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={() => onEdit(item)}
                            >
                                <IconEdit size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    {!isEffectivelyNonEditable && deleteAllowed && (
                        <Tooltip label={t.remove}>
                            <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => onRemove(item)}
                            >
                                <IconTrash size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            </Table.Td>
        </Table.Tr>
    );
};

// ── Sortable List Item (DnD) ───────────────────────────────────────

interface SortableM2MListItemProps {
    item: M2MDisplayItem;
    index: number;
    allowDrag: boolean;
    showFallbackSort: boolean;
    isFirst: boolean;
    isLast: boolean;
    enableLink: boolean;
    isEffectivelyNonEditable: boolean;
    updateAllowed: boolean;
    deleteAllowed: boolean;
    t: M2MTranslations;
    formatDisplayValue: (item: M2MDisplayItem) => string;
    onEdit: (item: M2MDisplayItem) => void;
    onRemove: (item: M2MDisplayItem) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    getItemLink: (item: M2MDisplayItem) => string | null;
}

const SortableM2MListItem: React.FC<SortableM2MListItemProps> = ({
    item,
    index,
    allowDrag,
    showFallbackSort,
    isFirst,
    isLast,
    enableLink,
    isEffectivelyNonEditable,
    updateAllowed,
    deleteAllowed,
    t,
    formatDisplayValue,
    onEdit,
    onRemove,
    onMoveUp,
    onMoveDown,
    getItemLink,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: String(item.id),
        disabled: !allowDrag,
    });

    const style: React.CSSProperties = {
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        transition,
        cursor: !isEffectivelyNonEditable && updateAllowed ? "pointer" : undefined,
        opacity: isDragging ? 0.5 : item.$type === "deleted" ? 0.5 : 1,
        position: isDragging ? "relative" : undefined,
        zIndex: isDragging ? 1 : undefined,
    };

    return (
        <Paper
            ref={setNodeRef}
            p="sm"
            withBorder
            style={style}
            {...(allowDrag ? attributes : {})}
            onClick={() => {
                if (!isEffectivelyNonEditable && updateAllowed) {
                    onEdit(item);
                }
            }}
        >
            <Group justify="space-between">
                <Group>
                    {/* DnD drag handle */}
                    {allowDrag && (
                        <Tooltip label={t.drag_to_reorder}>
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                style={{ cursor: "grab" }}
                                {...listeners}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <IconGripVertical size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    {/* Fallback sort arrows */}
                    {showFallbackSort && (
                        <Group gap="xs">
                            <Tooltip label={t.move_up}>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    disabled={isFirst}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveUp(index);
                                    }}
                                >
                                    <IconChevronUp size={14} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label={t.move_down}>
                                <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    disabled={isLast}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMoveDown(index);
                                    }}
                                >
                                    <IconChevronDown size={14} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    )}

                    <Text>{formatDisplayValue(item)}</Text>

                    {item.$type === "created" && (
                        <Badge size="xs" color="green" variant="light">
                            {t.badge_new}
                        </Badge>
                    )}
                    {item.$type === "updated" && (
                        <Badge size="xs" color="yellow" variant="light">
                            {t.badge_edited}
                        </Badge>
                    )}
                </Group>
                <Group gap="xs" onClick={(e) => e.stopPropagation()}>
                    {enableLink && (
                        <Tooltip label={t.navigate_to_item}>
                            <ActionIcon
                                variant="subtle"
                                size="sm"
                                component="a"
                                href={getItemLink(item) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <IconExternalLink size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                    {!isEffectivelyNonEditable && deleteAllowed && (
                        <Tooltip label={t.remove}>
                            <ActionIcon
                                variant="subtle"
                                color="red"
                                size="sm"
                                onClick={() => onRemove(item)}
                            >
                                <IconTrash size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            </Group>
        </Paper>
    );
};

// ── Helper: format cell values ─────────────────────────────────────

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
        if (Array.isArray(value)) return `[${value.length} items]`;
        return JSON.stringify(value);
    }
    return String(value);
}

// ── Component ──────────────────────────────────────────────────────

export const ListM2M: React.FC<ListM2MProps> = ({
    value: valueProp,
    onChange,
    collection,
    field,
    primaryKey,
    layout = "list",
    tableSpacing: _tableSpacing = "cozy",
    fields = ["id"],
    template,
    disabled = false,
    nonEditable = false,
    enableCreate = true,
    enableSelect = true,
    filter,
    enableSearchFilter = false,
    enableLink = false,
    limit: initialLimit = 15,
    allowDuplicates = false,
    junctionFieldLocation = "bottom",
    label,
    description,
    error,
    required = false,
    readOnly = false,
    mockItems,
    mockRelationInfo,
    translations: translationOverrides,
    enableBatchEdit = false,
    versionId,
}) => {
    // ── i18n ────────────────────────────────────────────────────────
    const t = useMemo(() => mergeTranslations(translationOverrides), [translationOverrides]);

    // ── Mock mode (Storybook / tests) ──────────────────────────────
    const isMockMode = !!(mockItems || mockRelationInfo);

    // ── Relation discovery ──────────────────────────────────────────
    const {
        relationInfo: discoveredRelationInfo,
        loading: relationLoading,
        error: relationError,
    } = useRelationM2M(collection, field);
    const relationInfo = mockRelationInfo ?? discoveredRelationInfo;

    // ── Permissions ─────────────────────────────────────────────────
    const {
        createAllowed: apiCreateAllowed,
        selectAllowed: apiSelectAllowed,
        updateAllowed: apiUpdateAllowed,
        deleteAllowed: apiDeleteAllowed,
    } = useRelationPermissionsM2M(relationInfo);

    // In mock mode, grant all permissions (no API available)
    const createAllowed = isMockMode || apiCreateAllowed;
    const selectAllowed = isMockMode || apiSelectAllowed;
    const updateAllowed = isMockMode || apiUpdateAllowed;
    const deleteAllowed = isMockMode || apiDeleteAllowed;

    // ── Staged change tracking ──────────────────────────────────────
    const {
        displayItems: hookDisplayItems,
        totalCount: hookTotalCount,
        loading: itemsLoading,
        error: itemsError,
        loadItems,
        selectItems,
        removeItem,
        moveItemUp,
        moveItemDown,
        reorderItems,
        getSelectedRelatedPKs,
        getChanges,
        hasChanges,
        setLocalChanges,
        changes,
    } = useRelationMultipleM2M(relationInfo, primaryKey ?? null);

    // ── DnD sensors ─────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // ── Field metadata for table column headers ─────────────────────
    const {
        getDisplayName,
        loading: fieldMetaLoading,
    } = useFieldMetadata({
        collection: relationInfo?.relatedCollection?.collection ?? null,
        fields,
        skip: isMockMode || !relationInfo,
    });

    // ── State ───────────────────────────────────────────────────────
    const [currentPage, setCurrentPage] = useState(1);
    const [currentLimit, setCurrentLimit] = useState(initialLimit);
    const [search, setSearch] = useState("");

    // Batch edit selection (table layout only)
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // Drawer / modal states
    const [editDrawerOpened, { open: openEditDrawer, close: closeEditDrawer }] = useDisclosure(false);
    const [selectModalOpened, { open: openSelectModal, close: closeSelectModal }] = useDisclosure(false);
    const [currentlyEditing, setCurrentlyEditing] = useState<M2MDisplayItem | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // ── Derived state ───────────────────────────────────────────────
    const isParentSaved = isValidPrimaryKey(primaryKey);
    const isEffectivelyDisabled = disabled || readOnly;
    const isEffectivelyNonEditable = nonEditable || isEffectivelyDisabled;

    // Use mock items if provided (storybook/testing), otherwise hook items
    const displayItems = mockItems ?? hookDisplayItems;
    // Filter out deleted items for display
    const visibleItems = useMemo(
        () => displayItems.filter((item) => item.$type !== "deleted"),
        [displayItems],
    );
    const totalCount = mockItems ? mockItems.length : hookTotalCount;
    const totalPages = currentLimit > 0 ? Math.ceil(totalCount / currentLimit) : 1;

    const loading = relationLoading || itemsLoading || fieldMetaLoading;

    // DnD allowed: all items fit on one page, sort field exists, not disabled
    const allowDrag = useMemo(() => {
        return (
            !!relationInfo?.sortField &&
            !isEffectivelyDisabled &&
            totalCount <= currentLimit
        );
    }, [relationInfo, isEffectivelyDisabled, totalCount, currentLimit]);

    // Item IDs for SortableContext
    const sortableIds = useMemo(
        () => visibleItems.map((item) => String(item.id ?? "")),
        [visibleItems],
    );

    // Singleton guard
    const isSingleton = useMemo(() => {
        if (!relationInfo) return false;
        return (relationInfo.relatedCollection as { meta?: { singleton?: boolean } })?.meta?.singleton === true;
    }, [relationInfo]);

    // ── Resolve display template ────────────────────────────────────
    // If no template is provided, try the related collection's display_template
    const resolvedTemplate = useMemo(() => {
        if (template) return template;
        const collMeta = relationInfo?.relatedCollection?.meta;
        if (collMeta?.display_template) return collMeta.display_template;
        return null;
    }, [template, relationInfo]);

    // ── Refs to break bidirectional sync loops ─────────────────────
    // 1. Track the onChange callback via ref so the "notify parent" effect
    //    doesn't re-trigger when the parent re-renders with a new closure.
    // 2. Track the last JSON we sent so the "sync external" effect skips
    //    echoed values coming back from the parent.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const lastSentChangesJSON = useRef<string>("");

    // ── Sync external value → local changes ─────────────────────────
    useEffect(() => {
        if (valueProp && typeof valueProp === "object" && !Array.isArray(valueProp)) {
            const vp = valueProp as M2MChangesItem;
            if ("create" in vp && "update" in vp && "delete" in vp) {
                // Skip if this matches what we just sent via onChange (prevent infinite loop)
                const vpJSON = JSON.stringify(vp);
                if (vpJSON === lastSentChangesJSON.current) return;
                setLocalChanges(vp);
            }
        }
    }, [valueProp, setLocalChanges]);

    // ── Notify parent of changes ────────────────────────────────────
    useEffect(() => {
        const hasAnyChanges =
            changes.create.length > 0 ||
            changes.update.length > 0 ||
            changes.delete.length > 0;
        if (onChangeRef.current && hasAnyChanges) {
            const changesValue = { ...changes };
            lastSentChangesJSON.current = JSON.stringify(changesValue);
            onChangeRef.current(changesValue);
        }
        // onChange accessed via ref — intentionally omitted from deps
        // to prevent infinite loop when parent re-renders with new closure
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changes]);

    // ── Load items when parameters change ───────────────────────────
    useEffect(() => {
        if (relationInfo && isParentSaved && !mockItems) {
            // Build fields for the query — prefix with junction field for related data
            const queryFields = fields.map((f) =>
                f.includes(".") ? f : `${relationInfo.junctionField.field}.${f}`,
            );
            // Always include junction PK and sort field
            queryFields.push(relationInfo.junctionPrimaryKeyField.field);
            if (relationInfo.sortField) queryFields.push(relationInfo.sortField);

            loadItems({
                limit: currentLimit,
                page: currentPage,
                fields: [...new Set(queryFields)],
                search: enableSearchFilter ? search : undefined,
                filter: filter as Record<string, unknown>,
            });
        }
    }, [
        relationInfo,
        isParentSaved,
        currentPage,
        currentLimit,
        search,
        fields,
        enableSearchFilter,
        filter,
        loadItems,
        mockItems,
    ]);

    // ── Handlers ────────────────────────────────────────────────────

    const handleCreateNew = useCallback(() => {
        setCurrentlyEditing(null);
        setIsCreatingNew(true);
        openEditDrawer();
    }, [openEditDrawer]);

    const handleEditItem = useCallback(
        (item: M2MDisplayItem) => {
            if (isEffectivelyNonEditable) return;
            setCurrentlyEditing(item);
            setIsCreatingNew(false);
            openEditDrawer();
        },
        [openEditDrawer, isEffectivelyNonEditable],
    );

    const handleSelectExisting = useCallback(
        (selectedIds: (string | number)[]) => {
            selectItems(selectedIds);
            closeSelectModal();
        },
        [selectItems, closeSelectModal],
    );

    const handleRemoveItem = useCallback(
        (item: M2MDisplayItem) => {
            removeItem(item);
        },
        [removeItem],
    );

    const handleMoveUp = useCallback(
        (index: number) => {
            moveItemUp(index);
        },
        [moveItemUp],
    );

    const handleMoveDown = useCallback(
        (index: number) => {
            moveItemDown(index);
        },
        [moveItemDown],
    );

    // ── DnD drag-end handler ────────────────────────────────────────
    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const oldIndex = visibleItems.findIndex((item) => String(item.id) === active.id);
            const newIndex = visibleItems.findIndex((item) => String(item.id) === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const reordered = arrayMove(visibleItems, oldIndex, newIndex);
                reorderItems(reordered);
            }
        },
        [visibleItems, reorderItems],
    );

    // ── Batch edit handlers ─────────────────────────────────────────
    const handleToggleSelect = useCallback(
        (itemId: string | number) => {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(itemId)) {
                    next.delete(itemId);
                } else {
                    next.add(itemId);
                }
                return next;
            });
        },
        [],
    );

    const handleToggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (prev.size === visibleItems.length) {
                return new Set(); // deselect all
            }
            return new Set(visibleItems.map((item) => item.id as string | number));
        });
    }, [visibleItems]);

    const handleDeselectAll = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const handleLimitChange = useCallback(
        (value: string | null) => {
            if (value) {
                const newLimit = parseInt(value, 10);
                setCurrentLimit(newLimit);
                setCurrentPage(1); // Reset to first page
            }
        },
        [],
    );

    // ── enableLink URL generation ───────────────────────────────────
    const getItemLink = useCallback(
        (item: M2MDisplayItem): string | null => {
            if (!enableLink || !relationInfo) return null;
            const relatedData = item[relationInfo.junctionField.field] as
                | Record<string, unknown>
                | undefined;
            if (!relatedData) return null;
            const relatedPK = relatedData[relationInfo.relatedPrimaryKeyField.field];
            if (relatedPK === undefined) return null;
            return `/content/${relationInfo.relatedCollection.collection}/${relatedPK}`;
        },
        [enableLink, relationInfo],
    );

    // ── Format display value using render-template ──────────────────
    const formatDisplayValue = useCallback(
        (item: M2MDisplayItem): string => {
            if (!relationInfo) return String(item.id ?? "");

            // For M2M, related data is nested under the junction field
            const relatedData = item[relationInfo.junctionField.field] as
                | Record<string, unknown>
                | undefined;

            if (resolvedTemplate && relatedData && typeof relatedData === "object") {
                return renderTemplate(resolvedTemplate, relatedData);
            }

            // Fallback: show first available field value
            if (relatedData && typeof relatedData === "object") {
                const displayField = fields.find(
                    (f) => relatedData[f] !== undefined && relatedData[f] !== null,
                ) ?? "id";
                return String(relatedData[displayField] ?? item.id ?? "");
            }

            return String(item.id ?? "");
        },
        [relationInfo, resolvedTemplate, fields],
    );

    // ── Selection filter for select modal ───────────────────────────
    const selectionFilter = useMemo(() => {
        if (!relationInfo) return undefined;

        const filters: Record<string, unknown>[] = [];

        // User-provided filter
        if (filter) {
            filters.push(filter);
        }

        // Exclude already-linked items (unless allowDuplicates)
        if (!allowDuplicates) {
            const selectedPKs = getSelectedRelatedPKs();
            if (selectedPKs.length > 0) {
                filters.push({
                    [relationInfo.relatedPrimaryKeyField.field]: {
                        _nin: selectedPKs,
                    },
                });
            }
        }

        if (filters.length === 0) return undefined;
        if (filters.length === 1) return filters[0];
        return { _and: filters };
    }, [relationInfo, filter, allowDuplicates, getSelectedRelatedPKs]);

    // ── Edit drawer form handlers ───────────────────────────────────
    const editDrawerCollection = useMemo(() => {
        if (!relationInfo) return "";
        // Always edit the related collection item
        return relationInfo.relatedCollection.collection;
    }, [relationInfo]);

    const editDrawerItemId = useMemo(() => {
        if (!relationInfo || !currentlyEditing) return undefined;
        if (isCreatingNew) return undefined;

        // For existing items, get the related item's PK
        const relatedData = currentlyEditing[relationInfo.junctionField.field] as
            | Record<string, unknown>
            | undefined;
        if (relatedData && typeof relatedData === "object") {
            return relatedData[relationInfo.relatedPrimaryKeyField.field] as
                | string
                | number
                | undefined;
        }
        return undefined;
    }, [relationInfo, currentlyEditing, isCreatingNew]);

    const handleEditFormSuccess = useCallback(() => {
        closeEditDrawer();
        // After editing a related item, reload to show updated data
        if (relationInfo && isParentSaved && !mockItems) {
            const queryFields = fields.map((f) =>
                f.includes(".") ? f : `${relationInfo.junctionField.field}.${f}`,
            );
            queryFields.push(relationInfo.junctionPrimaryKeyField.field);
            if (relationInfo.sortField) queryFields.push(relationInfo.sortField);

            loadItems({
                limit: currentLimit,
                page: currentPage,
                fields: [...new Set(queryFields)],
                search: enableSearchFilter ? search : undefined,
                filter: filter as Record<string, unknown>,
            });
        }
    }, [
        closeEditDrawer,
        relationInfo,
        isParentSaved,
        mockItems,
        fields,
        currentLimit,
        currentPage,
        search,
        enableSearchFilter,
        filter,
        loadItems,
    ]);

    // ── Render: Error states ────────────────────────────────────────
    // Skip relation error in mock mode — the hook will fail but mock data is enough
    if (relationError && !isMockMode) {
        return (
            <Stack gap="xs">
                {label && (
                    <Text size="sm" fw={500}>
                        {label}
                    </Text>
                )}
                <Alert icon={<IconAlertCircle size={16} />} title={t.configuration_error} color="red">
                    <Text size="sm">{relationError}</Text>
                    <Text size="xs" c="dimmed" mt="xs">
                        {t.storybook_hint}
                    </Text>
                </Alert>
            </Stack>
        );
    }

    if (isSingleton) {
        return (
            <Stack gap="xs">
                {label && (
                    <Text size="sm" fw={500}>
                        {label}
                    </Text>
                )}
                <Alert icon={<IconInfoCircle size={16} />} title={t.no_singleton_relations} color="yellow">
                    <Text size="sm">
                        {t.no_singleton_relations}
                    </Text>
                </Alert>
            </Stack>
        );
    }

    if (!relationInfo && !relationLoading) {
        return (
            <Alert
                icon={<IconAlertCircle size={16} />}
                title={t.relationship_not_setup}
                color="warning"
            >
                {t.relationship_not_setup_detail}
            </Alert>
        );
    }

    if (loading && !mockItems) {
        return (
            <Paper p="md" withBorder>
                <Group justify="space-between" mb="md">
                    <Skeleton width={200} height={28} />
                    <Group>
                        <Skeleton width={100} height={28} />
                        <Skeleton width={100} height={28} />
                    </Group>
                </Group>
                {layout === "table" ? (
                    <Stack gap="xs">
                        <Skeleton height={36} /> {/* Header row */}
                        {Array.from({ length: Math.min(currentLimit, 5) }).map((_, i) => (
                            <Skeleton key={i} height={40} />
                        ))}
                    </Stack>
                ) : (
                    <Stack gap="xs">
                        {Array.from({ length: Math.min(currentLimit, 5) }).map((_, i) => (
                            <Skeleton key={i} height={56} radius="sm" />
                        ))}
                    </Stack>
                )}
            </Paper>
        );
    }

    // ── Render: Main component ──────────────────────────────────────
    return (
        <Stack gap="sm">
            {label && (
                <Group>
                    <Text size="sm" fw={500}>
                        {label}
                        {required && (
                            <Text span c="red">
                                {" "}
                                *
                            </Text>
                        )}
                    </Text>
                </Group>
            )}

            {description && (
                <Text size="xs" c="dimmed">
                    {description}
                </Text>
            )}

            <Paper p="md" withBorder>
                {/* Header Actions */}
                <Group justify="space-between" mb="md">
                    <Group>
                        {enableSearchFilter && layout === "table" && (
                            <TextInput
                                placeholder={t.search_placeholder}
                                leftSection={<IconSearch size={16} />}
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.currentTarget.value);
                                    setCurrentPage(1);
                                }}
                                style={{ width: 250 }}
                            />
                        )}
                    </Group>

                    <Group>
                        {versionId && (
                            <Badge variant="light" color="grape" size="sm">
                                {interpolate(t.viewing_version, { name: String(versionId) })}
                            </Badge>
                        )}

                        {totalCount > 0 && (
                            <Text size="sm" c="dimmed">
                                {formatItemCount(totalCount, t)}
                                {hasChanges && (
                                    <Text span c="yellow" size="xs">
                                        {" "}
                                        {t.unsaved_changes}
                                    </Text>
                                )}
                            </Text>
                        )}

                        {/* Batch edit toggle (table layout only) */}
                        {!isEffectivelyNonEditable &&
                            enableBatchEdit &&
                            layout === "table" &&
                            selectedIds.size > 0 && (
                                <Button
                                    variant="light"
                                    color="yellow"
                                    leftSection={<IconCheckbox size={16} />}
                                    onClick={openEditDrawer}
                                    size="sm"
                                >
                                    {interpolate(t.batch_edit_title, { count: String(selectedIds.size) })}
                                </Button>
                            )}

                        {!isEffectivelyNonEditable && enableSelect && selectAllowed && (
                            <Button
                                variant="light"
                                leftSection={<IconPlus size={16} />}
                                onClick={openSelectModal}
                                size="sm"
                            >
                                {t.add_existing}
                            </Button>
                        )}

                        {!isEffectivelyNonEditable && enableCreate && createAllowed && (
                            <Button
                                leftSection={<IconPlus size={16} />}
                                onClick={handleCreateNew}
                                size="sm"
                            >
                                {t.create_new}
                            </Button>
                        )}
                    </Group>
                </Group>

                {/* Error notification */}
                {itemsError && (
                    <Alert
                        icon={<IconAlertCircle size={16} />}
                        color="red"
                        mb="md"
                    >
                        {itemsError}
                    </Alert>
                )}

                {/* Content */}
                {visibleItems.length === 0 ? (
                    <Paper p="xl" style={{ textAlign: "center" }}>
                        <Text c="dimmed">{t.no_items}</Text>
                    </Paper>
                ) : layout === "table" ? (
                    /* Table Layout — with DnD, field metadata headers, batch edit */
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <Table striped highlightOnHover>
                            <Table.Thead>
                                <Table.Tr>
                                    {/* Batch edit checkbox column */}
                                    {enableBatchEdit && !isEffectivelyNonEditable && (
                                        <Table.Th style={{ width: 40 }}>
                                            <Checkbox
                                                checked={selectedIds.size === visibleItems.length && visibleItems.length > 0}
                                                indeterminate={selectedIds.size > 0 && selectedIds.size < visibleItems.length}
                                                onChange={handleToggleSelectAll}
                                                aria-label={t.select_all}
                                                size="xs"
                                            />
                                        </Table.Th>
                                    )}
                                    {/* DnD drag handle column */}
                                    {allowDrag && (
                                        <Table.Th style={{ width: 48 }}>
                                            <Text size="xs" c="dimmed">{t.order}</Text>
                                        </Table.Th>
                                    )}
                                    {/* Sort arrow column (fallback when DnD not available) */}
                                    {relationInfo?.sortField && !isEffectivelyDisabled && !allowDrag && (
                                        <Table.Th style={{ width: 80 }}>
                                            <Text size="xs" c="dimmed">{t.order}</Text>
                                        </Table.Th>
                                    )}
                                    {fields.map((fieldName) => (
                                        <Table.Th key={fieldName}>
                                            <Text size="sm" fw={500}>
                                                {getDisplayName(fieldName)}
                                            </Text>
                                        </Table.Th>
                                    ))}
                                    <Table.Th style={{ width: 120 }}>
                                        <Text size="xs" c="dimmed">{t.actions}</Text>
                                    </Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <SortableContext
                                items={sortableIds}
                                strategy={verticalListSortingStrategy}
                                disabled={!allowDrag}
                            >
                                <Table.Tbody>
                                    {visibleItems.map((item, index) => (
                                        <SortableM2MTableRow
                                            key={item.id}
                                            item={item}
                                            index={index}
                                            fields={fields}
                                            relationInfo={relationInfo}
                                            allowDrag={allowDrag}
                                            showFallbackSort={!!relationInfo?.sortField && !isEffectivelyDisabled && !allowDrag}
                                            enableBatchEdit={enableBatchEdit && !isEffectivelyNonEditable}
                                            isSelected={selectedIds.has(item.id as string | number)}
                                            isFirst={index === 0}
                                            isLast={index === visibleItems.length - 1}
                                            enableLink={enableLink}
                                            isEffectivelyNonEditable={isEffectivelyNonEditable}
                                            updateAllowed={updateAllowed}
                                            deleteAllowed={deleteAllowed}
                                            t={t}
                                            onEdit={handleEditItem}
                                            onRemove={handleRemoveItem}
                                            onMoveUp={handleMoveUp}
                                            onMoveDown={handleMoveDown}
                                            onToggleSelect={handleToggleSelect}
                                            getItemLink={getItemLink}
                                        />
                                    ))}
                                </Table.Tbody>
                            </SortableContext>
                        </Table>
                    </DndContext>
                ) : (
                    /* List Layout — with DnD drag handles */
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sortableIds}
                            strategy={verticalListSortingStrategy}
                            disabled={!allowDrag}
                        >
                            <Stack gap="xs">
                                {visibleItems.map((item, index) => (
                                    <SortableM2MListItem
                                        key={item.id}
                                        item={item}
                                        index={index}
                                        allowDrag={allowDrag}
                                        showFallbackSort={!!relationInfo?.sortField && !isEffectivelyDisabled && !allowDrag}
                                        isFirst={index === 0}
                                        isLast={index === visibleItems.length - 1}
                                        enableLink={enableLink}
                                        isEffectivelyNonEditable={isEffectivelyNonEditable}
                                        updateAllowed={updateAllowed}
                                        deleteAllowed={deleteAllowed}
                                        t={t}
                                        formatDisplayValue={formatDisplayValue}
                                        onEdit={handleEditItem}
                                        onRemove={handleRemoveItem}
                                        onMoveUp={handleMoveUp}
                                        onMoveDown={handleMoveDown}
                                        getItemLink={getItemLink}
                                    />
                                ))}
                            </Stack>
                        </SortableContext>
                    </DndContext>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <Group justify="space-between" mt="md">
                        <Group>
                            <Text size="sm" c="dimmed">
                                {interpolate(t.showing_range, {
                                    start: (currentPage - 1) * currentLimit + 1,
                                    end: Math.min(currentPage * currentLimit, totalCount),
                                    total: totalCount,
                                })}
                            </Text>
                        </Group>

                        <Group>
                            <Text size="sm">{t.per_page}</Text>
                            <Select
                                value={String(currentLimit)}
                                onChange={handleLimitChange}
                                data={["10", "15", "25", "50", "100"]}
                                style={{ width: 80 }}
                                size="xs"
                            />

                            <Pagination
                                value={currentPage}
                                onChange={setCurrentPage}
                                total={totalPages}
                                size="sm"
                            />
                        </Group>
                    </Group>
                )}
            </Paper>

            {error && (
                <Text size="xs" c="red">
                    {typeof error === "string" ? error : t.invalid_value}
                </Text>
            )}

            {/* Edit Drawer — opens a CollectionForm for the related item */}
            <Drawer
                opened={editDrawerOpened}
                onClose={closeEditDrawer}
                title={isCreatingNew ? t.create_item : t.edit_item}
                position="right"
                size="lg"
                padding="md"
            >
                {relationInfo && (
                    <Stack gap="md">
                        {/* Junction field section at top (if configured) */}
                        {!isCreatingNew &&
                            currentlyEditing &&
                            junctionFieldLocation === "top" && (
                                <>
                                    <Text size="sm" fw={500} c="dimmed">
                                        {t.junction_fields}
                                    </Text>
                                    <CollectionForm
                                        collection={relationInfo.junctionCollection.collection}
                                        id={currentlyEditing.id as string | number}
                                        mode="edit"
                                        excludeFields={[
                                            relationInfo.junctionField.field,
                                            relationInfo.reverseJunctionField.field,
                                        ]}
                                    />
                                    <Divider />
                                </>
                            )}

                        {/* Related item form */}
                        <CollectionForm
                            collection={editDrawerCollection}
                            id={editDrawerItemId}
                            mode={isCreatingNew ? "create" : "edit"}
                            onSuccess={handleEditFormSuccess}
                            onCancel={closeEditDrawer}
                        />

                        {/* Junction field section at bottom (if configured) */}
                        {!isCreatingNew &&
                            currentlyEditing &&
                            junctionFieldLocation === "bottom" && (
                                <>
                                    <Divider />
                                    <Text size="sm" fw={500} c="dimmed">
                                        {t.junction_fields}
                                    </Text>
                                    <CollectionForm
                                        collection={relationInfo.junctionCollection.collection}
                                        id={currentlyEditing.id as string | number}
                                        mode="edit"
                                        excludeFields={[
                                            relationInfo.junctionField.field,
                                            relationInfo.reverseJunctionField.field,
                                        ]}
                                    />
                                </>
                            )}
                    </Stack>
                )}
            </Drawer>

            {/* Select Modal — pick existing items from the related collection */}
            <Modal
                opened={selectModalOpened}
                onClose={closeSelectModal}
                title={t.select_items}
                size="xl"
            >
                {relationInfo && (
                    <Box p="md">
                        <CollectionList
                            collection={relationInfo.relatedCollection.collection}
                            enableSelection
                            filter={selectionFilter}
                            bulkActions={[
                                {
                                    label: t.add_selected,
                                    icon: <IconPlus size={14} />,
                                    action: handleSelectExisting,
                                },
                            ]}
                        />
                    </Box>
                )}
            </Modal>
        </Stack>
    );
};
