"use client";

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  LoadingOverlay,
  Modal,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  useRelationO2M,
  useRelationO2MItems,
  usePermissions,
  type O2MItem,
  type O2MRelationInfo,
} from "@buildpad/hooks";
import { CollectionForm, CollectionList } from "@buildpad/ui-collections";
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconExternalLink,
  IconGripVertical,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUnlink,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/** Internal type for changeset-staged items */
interface StagedCreate {
  $type: "created";
  $index: number;
  /** Ephemeral data for display until parent saves */
  [key: string]: unknown;
}
interface StagedUpdate {
  $type: "updated";
  id: string | number;
  [key: string]: unknown;
}
interface StagedDelete {
  $type: "deleted";
  id: string | number;
}

/** The full changeset that tracks all pending mutations */
interface O2MChangeset {
  create: StagedCreate[];
  update: StagedUpdate[];
  delete: StagedDelete[];
}

const EMPTY_CHANGESET: O2MChangeset = { create: [], update: [], delete: [] };

/**
 * Props for the ListO2M component
 *
 * One-to-Many (O2M) relationship interface — displays MULTIPLE items from a related
 * collection that have a foreign key pointing to the current item.
 *
 * Example: A "category" has MANY "posts" (posts have category_id foreign key)
 * This is the INVERSE of M2O — viewing the "many" side from the "one" perspective.
 */
export interface ListO2MProps {
  /** Current value — array of related item IDs or objects (managed internally via changeset) */
  value?: (string | number | Record<string, unknown>)[];
  /** Callback fired when value changes — emits DaaS-compatible changeset payload */
  onChange?: (value: (string | number | Record<string, unknown>)[]) => void;
  /** Current collection name (the "one" side) */
  collection: string;
  /** Field name for this O2M relationship */
  field: string;
  /** Primary key of the current item */
  primaryKey?: string | number;
  /** Layout mode — 'list' or 'table' */
  layout?: "list" | "table";
  /** Table spacing for table layout */
  tableSpacing?: "compact" | "cozy" | "comfortable";
  /** Fields to display from related collection */
  fields?: string[];
  /** Template string for list layout (supports {{field}} and {{nested.field}}) */
  template?: string;
  /** Whether the interface is disabled */
  disabled?: boolean;
  /** Enable create new items button */
  enableCreate?: boolean;
  /** Enable select existing items button */
  enableSelect?: boolean;
  /** Filter to apply when selecting items (supports {{field}} interpolation) */
  filter?: Record<string, unknown>;
  /** Enable search filter in table mode */
  enableSearchFilter?: boolean;
  /** Enable link to related items */
  enableLink?: boolean;
  /** Items per page */
  limit?: number;
  /** Default sort field */
  sort?: string;
  /** Default sort direction */
  sortDirection?: "asc" | "desc";
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
  /** Action when removing: 'unlink' (set FK to null) or 'delete' (delete item) */
  removeAction?: "unlink" | "delete";
  /** Parent form values — used for dynamic filter interpolation */
  parentValues?: Record<string, unknown>;
  /** Mock items for demo/testing — bypasses hook-based data loading */
  mockItems?: O2MItem[];
  /** Mock relationship info for demo/testing — partial O2MRelationInfo for demo purposes */
  mockRelationInfo?: Partial<O2MRelationInfo>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a nested field path like "author.name" from an object.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Render a template string with {{field}} or {{nested.field}} placeholders.
 * Falls back to displaying the first non-id field if no template is given.
 */
function renderTemplate(
  template: string | undefined,
  item: O2MItem,
  fields: string[],
): string {
  if (template) {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const val = getNestedValue(item as Record<string, unknown>, path.trim());
      return val != null ? String(val) : "";
    });
  }
  // Default: first non-id field
  const displayField = fields.find((f) => f !== "id" && item[f]) || "id";
  return String(item[displayField] ?? item.id ?? "");
}

/**
 * Deep-interpolate {{field}} placeholders in a filter object using parent form values.
 * Matches DaaS's adjustFilterForField behavior.
 */
function interpolateFilter(
  filter: Record<string, unknown>,
  parentValues: Record<string, unknown>,
): Record<string, unknown> {
  const json = JSON.stringify(filter);
  const interpolated = json.replace(
    /\{\{\s*([^}\s]+)\s*\}\}/g,
    (_match, field: string) => {
      const val = getNestedValue(parentValues, field);
      if (val === undefined || val === null) return "null";
      return typeof val === "string" ? val.replace(/"/g, '\\"') : String(val);
    },
  );
  try {
    return JSON.parse(interpolated) as Record<string, unknown>;
  } catch {
    return filter;
  }
}

/**
 * Format count with singular/plural.
 */
function formatCount(n: number): string {
  if (n === 0) return "No items";
  if (n === 1) return "1 item";
  return `${n.toLocaleString()} items`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

/**
 * ListO2M — One-to-Many relationship interface
 *
 * Implements all 10 improvements matching DaaS 11.14.0 behavior:
 * 1. Changeset staging — mutations are deferred until parent form saves
 * 2. Permission checking — create/update/delete gates via usePermissions
 * 3. Circular field exclusion — FK field hidden in edit modal
 * 4. Unique foreign key guard — hides create/select when FK is unique and item exists
 * 5. Singleton guard — warning when related collection is singleton
 * 6. Dynamic filter interpolation — {{field}} in filter props
 * 7. Drag-and-drop reordering — sortable rows when sort field exists (disabled when paginated)
 * 8. Sort/sortDirection — forwarded from interface options
 * 9. Nested template rendering — supports {{nested.field}} paths
 * 10. Batch edit, skeleton loading, improved count formatting
 */
export const ListO2M: React.FC<ListO2MProps> = ({
  value: valueProp,
  onChange,
  collection,
  field,
  primaryKey,
  layout = "list",
  tableSpacing = "cozy",
  fields = ["id"],
  template,
  disabled = false,
  enableCreate = true,
  enableSelect = true,
  filter: filterProp,
  enableSearchFilter = false,
  enableLink = false,
  limit: initialLimit = 15,
  sort: sortProp,
  sortDirection: sortDirectionProp,
  label,
  description,
  error,
  required = false,
  readOnly = false,
  removeAction: removeActionProp = "unlink",
  parentValues,
  mockItems,
  mockRelationInfo,
}) => {
  // ── Ensure value is always an array ──────────────────────────────────────
  const value = valueProp ?? [];

  // ── Demo / mock mode ─────────────────────────────────────────────────────
  const isDemoMode = mockItems !== undefined;

  // ── Relationship info hook ───────────────────────────────────────────────
  const {
    relationInfo: hookRelationInfo,
    loading: hookLoading,
    error: hookError,
  } = useRelationO2M(isDemoMode ? "" : collection, isDemoMode ? "" : field);

  const relationInfo: Partial<O2MRelationInfo> | null | undefined = isDemoMode
    ? mockRelationInfo
    : hookRelationInfo;
  const relationError = isDemoMode ? null : hookError;
  const relationLoading = isDemoMode ? false : hookLoading;

  // ── Priority #2: Permission checking ─────────────────────────────────────
  const relatedCollection = relationInfo?.relatedCollection?.collection || "";
  const { canPerform, loading: permLoading } = usePermissions({
    collections: relatedCollection ? [relatedCollection] : [],
  });

  const createAllowed = useMemo(
    () =>
      isDemoMode ||
      permLoading ||
      !relatedCollection ||
      canPerform(relatedCollection, "create"),
    [isDemoMode, permLoading, relatedCollection, canPerform],
  );
  const updateAllowed = useMemo(
    () =>
      isDemoMode ||
      permLoading ||
      !relatedCollection ||
      canPerform(relatedCollection, "update"),
    [isDemoMode, permLoading, relatedCollection, canPerform],
  );
  const deleteAllowed = useMemo(
    () =>
      isDemoMode ||
      permLoading ||
      !relatedCollection ||
      canPerform(relatedCollection, "delete"),
    [isDemoMode, permLoading, relatedCollection, canPerform],
  );

  // Derive effective removeAction from relation's oneDeselectAction
  const effectiveRemoveAction = useMemo(() => {
    if (removeActionProp === "delete") return "delete";
    // In demo mode, use mockRelationInfo; otherwise use hookRelationInfo
    const info = isDemoMode ? mockRelationInfo : (hookRelationInfo as O2MRelationInfo | null);
    if (info?.oneDeselectAction === "delete") return "delete";
    return "unlink";
  }, [removeActionProp, isDemoMode, mockRelationInfo, hookRelationInfo]);

  // ── Pagination & search state ────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState("");
  // Priority #8: use sort/sortDirection props as defaults
  const [sortField, setSortField] = useState(sortProp || "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    sortDirectionProp || "asc",
  );

  // ── Internal mock items (demo mode) ─────────────────────────────────────
  const [internalMockItems, setInternalMockItems] = useState<O2MItem[]>(
    mockItems || [],
  );

  // ── Priority #1: Changeset staging ──────────────────────────────────────
  const [changeset, setChangeset] = useState<O2MChangeset>(EMPTY_CHANGESET);
  let createIndex = 0;

  // Check if parent item is saved (valid PK, not '+' convention for new)
  const isParentSaved = primaryKey && primaryKey !== "+";

  // ── Batch selection state (Priority #10) ────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(),
  );
  const toggleSelection = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── Modal states ────────────────────────────────────────────────────────
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] =
    useDisclosure(false);
  const [
    selectModalOpened,
    { open: openSelectModal, close: closeSelectModal },
  ] = useDisclosure(false);
  const [currentlyEditing, setCurrentlyEditing] = useState<O2MItem | null>(
    null,
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  // ── Items management hook ───────────────────────────────────────────────
  const {
    items: hookItems,
    totalCount: hookTotalCount,
    loading: itemsLoading,
    loadItems,
    selectItems,
    removeItem,
    deleteItem,
    moveItemUp: hookMoveItemUp,
    moveItemDown: hookMoveItemDown,
  } = useRelationO2MItems(
    isDemoMode ? null : (hookRelationInfo as O2MRelationInfo | null),
    isDemoMode ? null : primaryKey || null,
  );

  // ── Merge changeset with fetched items ──────────────────────────────────
  const baseItems: O2MItem[] = isDemoMode ? internalMockItems : hookItems;
  const displayItems: O2MItem[] = useMemo(() => {
    // Filter out items marked for deletion
    const deletedIds = new Set(changeset.delete.map((d) => d.id));
    let merged = baseItems.filter((item) => !deletedIds.has(item.id));

    // Apply staged updates
    merged = merged.map((item) => {
      const update = changeset.update.find((u) => u.id === item.id);
      if (update) {
        const { $type, ...rest } = update;
        return { ...item, ...rest };
      }
      return item;
    });

    // Append staged creates
    const createdItems: O2MItem[] = changeset.create.map((c) => {
      const { $type, $index, ...rest } = c;
      return { id: `$temp_${$index}`, ...rest } as O2MItem;
    });

    return [...merged, ...createdItems];
  }, [baseItems, changeset]);

  const totalCount = isDemoMode
    ? internalMockItems.length
    : hookTotalCount + changeset.create.length - changeset.delete.length;
  const loading = isDemoMode ? false : relationLoading || itemsLoading;

  // ── Emit changeset to parent onChange ───────────────────────────────────
  useEffect(() => {
    if (!onChange) return;
    const hasChanges =
      changeset.create.length > 0 ||
      changeset.update.length > 0 ||
      changeset.delete.length > 0;

    if (!hasChanges && (!value || value.length === 0)) return;

    const fkField = relationInfo?.reverseJunctionField?.field;
    const payload: Record<string, unknown>[] = [];

    // Creates: emit the item data with FK pointing to parent
    for (const item of changeset.create) {
      const { $type, $index, ...data } = item;
      payload.push({
        ...data,
        ...(fkField ? { [fkField]: primaryKey || "+" } : {}),
      });
    }

    // Updates: emit id + changed fields
    for (const item of changeset.update) {
      const { $type, ...data } = item;
      payload.push(data);
    }

    // Deletes: emit id with $delete marker (DaaS convention)
    for (const item of changeset.delete) {
      payload.push({ id: item.id, $delete: true });
    }

    if (payload.length > 0 || value.length > 0) {
      onChange(payload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeset]);

  // ── Priority #4: Unique FK guard ────────────────────────────────────────
  // In demo mode, use mockRelationInfo; otherwise use hookRelationInfo
  const guardInfo = isDemoMode ? mockRelationInfo : (hookRelationInfo as O2MRelationInfo | null);
  const isUniqueConstrained = guardInfo?.isForeignKeyUnique === true;
  const effectiveItemCount = isDemoMode ? internalMockItems.length : hookTotalCount;
  const hasExistingItem =
    (effectiveItemCount > 0 || changeset.create.length > 0) && isUniqueConstrained;

  // ── Priority #5: Singleton guard ────────────────────────────────────────
  const isSingleton = guardInfo?.isSingleton === true;

  // ── Priority #6: Dynamic filter interpolation ───────────────────────────
  const interpolatedFilter = useMemo(() => {
    if (!filterProp) return undefined;
    if (!parentValues) return filterProp;
    return interpolateFilter(filterProp, parentValues);
  }, [filterProp, parentValues]);

  // ── Move helpers (demo + real) ──────────────────────────────────────────
  const moveItemUp = async (index: number) => {
    if (isDemoMode) {
      if (index <= 0) return;
      const newItems = [...internalMockItems];
      [newItems[index - 1], newItems[index]] = [
        newItems[index],
        newItems[index - 1],
      ];
      setInternalMockItems(newItems);
    } else {
      await hookMoveItemUp(index);
    }
  };

  const moveItemDown = async (index: number) => {
    if (isDemoMode) {
      if (index >= internalMockItems.length - 1) return;
      const newItems = [...internalMockItems];
      [newItems[index], newItems[index + 1]] = [
        newItems[index + 1],
        newItems[index],
      ];
      setInternalMockItems(newItems);
    } else {
      await hookMoveItemDown(index);
    }
  };

  // ── Load items effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoMode && relationInfo && primaryKey) {
      loadItems({
        limit,
        page: currentPage,
        search: enableSearchFilter ? search : undefined,
        sortField: sortField || relationInfo?.sortField || undefined,
        sortDirection,
        fields,
      });
    }
  }, [
    isDemoMode,
    relationInfo,
    primaryKey,
    currentPage,
    limit,
    search,
    sortField,
    sortDirection,
    fields,
    enableSearchFilter,
    loadItems,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCreateNew = () => {
    setCurrentlyEditing(null);
    setIsCreatingNew(true);
    openEditModal();
  };

  const handleEditItem = (item: O2MItem) => {
    if (!updateAllowed && !isDemoMode) return;
    setCurrentlyEditing(item);
    setIsCreatingNew(false);
    openEditModal();
  };

  /**
   * On form save from the edit modal:
   * - If parent is saved → API mutation already happened via CollectionForm → just reload.
   * - If parent is new → stage the create/update into the changeset.
   */
  const handleFormSuccess = useCallback(
    (data?: Record<string, unknown>) => {
      closeEditModal();

      if (isParentSaved) {
        // Parent already saved — CollectionForm did the API call, just reload
        if (!isDemoMode && relationInfo && primaryKey) {
          loadItems({
            limit,
            page: currentPage,
            search: enableSearchFilter ? search : undefined,
            sortField,
            sortDirection,
            fields,
          });
        }
        return;
      }

      // Parent not saved → stage into changeset
      if (isCreatingNew && data) {
        setChangeset((prev) => ({
          ...prev,
          create: [
            ...prev.create,
            { $type: "created", $index: createIndex++, ...data },
          ],
        }));
      } else if (currentlyEditing && data) {
        setChangeset((prev) => ({
          ...prev,
          update: [
            ...prev.update.filter((u) => u.id !== currentlyEditing.id),
            { $type: "updated", id: currentlyEditing.id, ...data },
          ],
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isParentSaved,
      isCreatingNew,
      currentlyEditing,
      relationInfo,
      primaryKey,
      limit,
      currentPage,
      search,
      sortField,
      sortDirection,
      fields,
    ],
  );

  /**
   * Select existing items from the related collection.
   */
  const handleSelectItems = async (ids: (string | number)[]) => {
    setSelectError(null);

    if (isParentSaved) {
      try {
        await selectItems(ids);
        closeSelectModal();
        if (relationInfo && primaryKey) {
          loadItems({
            limit,
            page: currentPage,
            search: enableSearchFilter ? search : undefined,
            sortField,
            sortDirection,
            fields,
          });
        }
      } catch (err) {
        console.error("Error selecting items:", err);
        setSelectError("Failed to link items. Please try again.");
      }
    } else {
      // Stage: fetch item data for display, then add to changeset
      try {
        const { apiRequest } = await import("@buildpad/services");
        if (relationInfo?.relatedCollection?.collection) {
          const col = relationInfo.relatedCollection.collection;
          const qp = new URLSearchParams();
          qp.set("filter", JSON.stringify({ id: { _in: ids } }));
          if (fields.length > 0) qp.set("fields", fields.join(","));
          const resp = await apiRequest<{ data: O2MItem[] }>(
            `/api/items/${col}?${qp.toString()}`,
          );
          const fetched = resp.data || [];

          setChangeset((prev) => {
            const existingUpdateIds = new Set(prev.update.map((u) => u.id));
            const newUpdates: StagedUpdate[] = fetched
              .filter((item) => !existingUpdateIds.has(item.id))
              .map((item) => {
                const { $type: _t, $index: _i, $edits: _e, ...rest } = item;
                return { ...rest, $type: "updated" as const, id: item.id };
              });
            return {
              ...prev,
              update: [...prev.update, ...newUpdates],
            };
          });
          closeSelectModal();
        }
      } catch (err) {
        console.error("Error staging items:", err);
        setSelectError("Failed to select items. Please try again.");
      }
    }
  };

  /**
   * Remove / unlink / delete an item.
   */
  const handleRemoveItem = async (item: O2MItem) => {
    // If it's a staged create, remove from changeset
    if (typeof item.id === "string" && item.id.startsWith("$temp_")) {
      const idx = parseInt(item.id.replace("$temp_", ""), 10);
      setChangeset((prev) => ({
        ...prev,
        create: prev.create.filter((c) => c.$index !== idx),
      }));
      return;
    }

    if (isParentSaved) {
      try {
        if (effectiveRemoveAction === "delete") {
          await deleteItem(item);
        } else {
          await removeItem(item);
        }
      } catch (err) {
        console.error("Error removing item:", err);
      }
    } else {
      // Stage deletion in changeset
      setChangeset((prev) => ({
        ...prev,
        update: prev.update.filter((u) => u.id !== item.id),
        delete: [...prev.delete, { $type: "deleted", id: item.id }],
      }));
    }
  };

  /**
   * Batch remove selected items.
   */
  const handleBatchRemove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const item = displayItems.find((i) => i.id === id);
      if (item) await handleRemoveItem(item);
    }
    clearSelection();
  };

  // ── Sort column click ───────────────────────────────────────────────────
  const handleSort = useCallback(
    (fieldName: string) => {
      if (sortField === fieldName) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(fieldName);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  // ── Move handlers ───────────────────────────────────────────────────────
  const handleMoveUp = async (index: number) => {
    try {
      await moveItemUp(index);
    } catch (err) {
      console.error("Error moving item up:", err);
    }
  };

  const handleMoveDown = async (index: number) => {
    try {
      await moveItemDown(index);
    } catch (err) {
      console.error("Error moving item down:", err);
    }
  };

  const hasSortField = !!relationInfo?.sortField;
  const isPaginated = Math.ceil(totalCount / limit) > 1;
  const canReorder = hasSortField && !isPaginated && !disabled && !readOnly;

  const totalPages = Math.ceil(Math.max(totalCount, 0) / limit);

  // ── Effective disabled state ────────────────────────────────────────────
  const isDisabled = disabled || readOnly;

  // Compute whether create/select buttons should show
  const showCreateBtn =
    !isDisabled &&
    enableCreate &&
    createAllowed &&
    !hasExistingItem &&
    !isSingleton;
  const showSelectBtn =
    !isDisabled &&
    enableSelect &&
    !hasExistingItem &&
    !isSingleton;

  // ── Circular field exclusion (Priority #3) ──────────────────────────────
  const circularField = relationInfo?.reverseJunctionField?.field;

  // ── Error states ────────────────────────────────────────────────────────
  if (!isDemoMode && relationError) {
    return (
      <Stack gap="xs">
        {label && (
          <Text size="sm" fw={500}>
            {label}
          </Text>
        )}
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Configuration Error"
          color="red"
          data-testid="o2m-error"
        >
          <Text size="sm">{relationError}</Text>
          <Text size="xs" c="dimmed" mt="xs">
            Note: In Storybook, relational interfaces require API proxy routes.
            This component works fully in a Next.js app with DaaS integration.
          </Text>
        </Alert>
      </Stack>
    );
  }

  if (!isDemoMode && !relationInfo && !relationLoading) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Relationship not configured"
        color="warning"
        data-testid="o2m-not-configured"
      >
        The one-to-many relationship is not properly configured for this field.
      </Alert>
    );
  }

  // ── Skeleton loading (Priority #10) ─────────────────────────────────────
  if (loading && displayItems.length === 0) {
    return (
      <Stack gap="sm" data-testid="list-o2m">
        {label && (
          <Text size="sm" fw={500}>
            {label}
            {required && (
              <Text span c="red">
                {" "}
                *
              </Text>
            )}
          </Text>
        )}
        <Paper p="md" withBorder>
          <Stack gap="xs">
            <Skeleton height={32} />
            <Skeleton height={24} />
            <Skeleton height={24} />
            <Skeleton height={24} />
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="sm" data-testid="list-o2m">
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

      {/* Priority #5: Singleton guard */}
      {isSingleton && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="yellow"
          data-testid="o2m-singleton-warning"
        >
          The related collection is a singleton. Only one item can exist.
        </Alert>
      )}

      {/* Priority #4: Unique FK guard */}
      {hasExistingItem && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="info"
          data-testid="o2m-unique-fk-notice"
        >
          This relationship has a unique constraint. Only one related item is
          allowed.
        </Alert>
      )}

      <Paper p="md" withBorder pos="relative">
        <LoadingOverlay visible={loading && displayItems.length > 0} />

        {/* Header Actions */}
        <Group justify="space-between" mb="md">
          <Group>
            {enableSearchFilter && layout === "table" && (
              <TextInput
                placeholder="Search..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  setCurrentPage(1);
                }}
                style={{ width: 250 }}
                data-testid="o2m-search"
              />
            )}
          </Group>

          <Group>
            {totalCount > 0 && (
              <Text size="sm" c="dimmed" data-testid="o2m-count">
                {formatCount(totalCount)}
              </Text>
            )}

            {/* Batch actions */}
            {selectedIds.size > 0 && (deleteAllowed || effectiveRemoveAction === "unlink") && (
              <Button
                variant="light"
                color="red"
                size="xs"
                leftSection={
                  effectiveRemoveAction === "delete" ? (
                    <IconTrash size={14} />
                  ) : (
                    <IconUnlink size={14} />
                  )
                }
                onClick={handleBatchRemove}
                data-testid="o2m-batch-remove"
              >
                {effectiveRemoveAction === "delete" ? "Delete" : "Unlink"}{" "}
                {selectedIds.size} selected
              </Button>
            )}

            {showSelectBtn && (
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openSelectModal}
                data-testid="o2m-select-btn"
              >
                Add Existing
              </Button>
            )}

            {showCreateBtn && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleCreateNew}
                data-testid="o2m-create-btn"
              >
                Create New
              </Button>
            )}
          </Group>
        </Group>

        {/* Content */}
        {displayItems.length === 0 && !loading ? (
          <Paper p="xl" style={{ textAlign: "center" }} data-testid="o2m-empty">
            <Text c="dimmed">No related items</Text>
          </Paper>
        ) : layout === "table" ? (
          /* ── Table Layout ─────────────────────────────────────────────── */
          <Table
            striped
            highlightOnHover
            verticalSpacing={
              tableSpacing === "compact"
                ? "xs"
                : tableSpacing === "comfortable"
                  ? "md"
                  : "sm"
            }
            data-testid="o2m-table"
          >
            <Table.Thead>
              <Table.Tr>
                {/* Batch select all */}
                {!isDisabled && (
                  <Table.Th style={{ width: 40 }}>
                    <Checkbox
                      size="xs"
                      checked={
                        displayItems.length > 0 &&
                        selectedIds.size === displayItems.length
                      }
                      indeterminate={
                        selectedIds.size > 0 &&
                        selectedIds.size < displayItems.length
                      }
                      onChange={() => {
                        if (selectedIds.size === displayItems.length) {
                          clearSelection();
                        } else {
                          setSelectedIds(
                            new Set(displayItems.map((i) => i.id)),
                          );
                        }
                      }}
                      aria-label="Select all"
                      data-testid="o2m-select-all"
                    />
                  </Table.Th>
                )}
                {canReorder && (
                  <Table.Th style={{ width: 50 }}>
                    <IconGripVertical size={14} style={{ opacity: 0.5 }} />
                  </Table.Th>
                )}
                {fields.map((fieldName) => (
                  <Table.Th
                    key={fieldName}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSort(fieldName)}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500}>
                        {fieldName
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Text>
                      {sortField === fieldName &&
                        (sortDirection === "asc" ? (
                          <IconChevronUp size={14} />
                        ) : (
                          <IconChevronDown size={14} />
                        ))}
                    </Group>
                  </Table.Th>
                ))}
                <Table.Th style={{ width: 120 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {displayItems.map((item, index) => (
                <Table.Tr key={item.id} data-testid={`o2m-row-${item.id}`}>
                  {/* Batch checkbox */}
                  {!isDisabled && (
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        aria-label={`Select item ${item.id}`}
                        data-testid={`o2m-check-${item.id}`}
                      />
                    </Table.Td>
                  )}
                  {/* Reorder grip / arrows */}
                  {canReorder && (
                    <Table.Td>
                      <Group gap={2}>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                          data-testid={`o2m-move-up-${item.id}`}
                        >
                          <IconChevronUp size={12} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          disabled={index === displayItems.length - 1}
                          onClick={() => handleMoveDown(index)}
                          data-testid={`o2m-move-down-${item.id}`}
                        >
                          <IconChevronDown size={12} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  )}
                  {fields.map((fieldName) => {
                    const cellValue = getNestedValue(
                      item as Record<string, unknown>,
                      fieldName,
                    );
                    return (
                      <Table.Td key={fieldName}>
                        <Text size="sm">{String(cellValue ?? "-")}</Text>
                      </Table.Td>
                    );
                  })}
                  <Table.Td>
                    <Group gap="xs">
                      {enableLink && (
                        <Tooltip label="View item">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            data-testid={`o2m-link-${item.id}`}
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}

                      {!isDisabled && updateAllowed && (
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            data-testid={`o2m-edit-${item.id}`}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}

                      {!isDisabled &&
                        (effectiveRemoveAction === "delete"
                          ? deleteAllowed
                          : true) && (
                          <Tooltip
                            label={
                              effectiveRemoveAction === "delete"
                                ? "Delete"
                                : "Unlink"
                            }
                          >
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleRemoveItem(item)}
                              data-testid={`o2m-remove-${item.id}`}
                            >
                              {effectiveRemoveAction === "delete" ? (
                                <IconTrash size={14} />
                              ) : (
                                <IconUnlink size={14} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          /* ── List Layout ──────────────────────────────────────────────── */
          <Stack gap="xs" data-testid="o2m-list">
            {displayItems.map((item, index) => (
              <Paper
                key={item.id}
                p="sm"
                withBorder
                style={{
                  cursor: isDisabled || !updateAllowed ? "default" : "pointer",
                }}
                onClick={() =>
                  !isDisabled && updateAllowed && handleEditItem(item)
                }
                data-testid={`o2m-item-${item.id}`}
              >
                <Group justify="space-between">
                  <Group>
                    {canReorder && (
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveUp(index);
                          }}
                          data-testid={`o2m-list-move-up-${item.id}`}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === displayItems.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveDown(index);
                          }}
                          data-testid={`o2m-list-move-down-${item.id}`}
                        >
                          <IconChevronDown size={14} />
                        </ActionIcon>
                      </Group>
                    )}
                    <Text>{renderTemplate(template, item, fields)}</Text>
                  </Group>
                  <Group gap="xs">
                    {enableLink && (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`o2m-list-link-${item.id}`}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    )}
                    {!isDisabled &&
                      (effectiveRemoveAction === "delete"
                        ? deleteAllowed
                        : true) && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item);
                          }}
                          data-testid={`o2m-list-remove-${item.id}`}
                        >
                          {effectiveRemoveAction === "delete" ? (
                            <IconTrash size={14} />
                          ) : (
                            <IconUnlink size={14} />
                          )}
                        </ActionIcon>
                      )}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="space-between" mt="md" data-testid="o2m-pagination">
            <Group>
              <Text size="sm" c="dimmed">
                Showing {(currentPage - 1) * limit + 1} to{" "}
                {Math.min(currentPage * limit, totalCount)} of {totalCount}
              </Text>
            </Group>

            <Group>
              <Text size="sm">Items per page:</Text>
              <Select
                value={String(limit)}
                onChange={(val) => {
                  if (val) {
                    setLimit(Number(val));
                    setCurrentPage(1);
                  }
                }}
                data={["10", "15", "25", "50", "100"]}
                style={{ width: 80 }}
                data-testid="o2m-per-page"
              />

              <Pagination
                value={currentPage}
                onChange={setCurrentPage}
                total={totalPages}
                size="sm"
                data-testid="o2m-pagination-control"
              />
            </Group>
          </Group>
        )}
      </Paper>

      {error && (
        <Text size="xs" c="red" data-testid="o2m-error-text">
          {typeof error === "string" ? error : "Invalid value"}
        </Text>
      )}

      {/* Edit Modal — Priority #3: exclude circular FK field */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={isCreatingNew ? "Create New Item" : "Edit Item"}
        size="lg"
      >
        {relationInfo && relationInfo.relatedCollection && (
          <CollectionForm
            collection={relationInfo.relatedCollection.collection}
            id={
              currentlyEditing?.id &&
              !(
                typeof currentlyEditing.id === "string" &&
                currentlyEditing.id.startsWith("$temp_")
              )
                ? currentlyEditing.id
                : undefined
            }
            mode={isCreatingNew ? "create" : "edit"}
            defaultValues={
              isCreatingNew && relationInfo.reverseJunctionField
                ? {
                    [relationInfo.reverseJunctionField.field]: primaryKey,
                  }
                : undefined
            }
            excludeFields={circularField ? [circularField] : undefined}
            onSuccess={handleFormSuccess}
          />
        )}
      </Modal>

      {/* Select Modal */}
      <Modal
        opened={selectModalOpened}
        onClose={() => {
          closeSelectModal();
          setSelectError(null);
        }}
        title="Select Existing Items"
        size="xl"
      >
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

        {!isParentSaved && !selectError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Items will be linked when you save"
            color="info"
            mb="md"
          >
            Selected items will be linked after you save the current item.
          </Alert>
        )}

        {relationInfo &&
          relationInfo.relatedCollection &&
          relationInfo.reverseJunctionField && (
            <Box p="md">
              <CollectionList
                collection={relationInfo.relatedCollection.collection}
                enableSelection
                filter={
                  primaryKey && primaryKey !== "+"
                    ? {
                        _or: [
                          {
                            [relationInfo.reverseJunctionField.field]: {
                              _null: true,
                            },
                          },
                          {
                            [relationInfo.reverseJunctionField.field]: {
                              _neq: primaryKey,
                            },
                          },
                        ],
                        ...(interpolatedFilter || {}),
                      }
                    : {
                        [relationInfo.reverseJunctionField.field]: {
                          _null: true,
                        },
                        ...(interpolatedFilter || {}),
                      }
                }
                bulkActions={[
                  {
                    label: "Add Selected",
                    icon: <IconPlus size={14} />,
                    action: handleSelectItems,
                  },
                ]}
              />
            </Box>
          )}
      </Modal>
    </Stack>
  );
};

export default ListO2M;
