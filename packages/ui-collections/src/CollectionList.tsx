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

"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Collapse,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  FieldsService,
  ItemsService,
  PermissionsService,
  apiRequest,
} from "@buildpad/services";
import type { CollectionActionAccess } from "@buildpad/services";
import type { AnyItem, Field } from "@buildpad/types";
import type { Alignment, Header, HeaderRaw, Sort } from "@buildpad/ui-table";
import { VTable } from "@buildpad/ui-table";
import {
  IconAlertCircle,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconCheck,
  IconEyeOff,
  IconFilterOff,
  IconPlus,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from "@tabler/icons-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CollectionListFooter } from "./CollectionListFooter";
import { CollectionListToolbar } from "./CollectionListToolbar";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { FilterPanel } from "./FilterPanel";
import "./CollectionList.css";

export interface BulkAction {
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
export interface ListPermissionState {
  createAllowed: boolean;
  readAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
  archiveAllowed: boolean;
}

/** Archive filter mode for collections with an archive field */
export type ArchiveFilter = "all" | "archived" | "unarchived";

export interface CollectionListProps {
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

// System fields to exclude from default display
const SYSTEM_FIELDS = [
  "user_created",
  "user_updated",
  "date_created",
  "date_updated",
];

// Row height per spacing preset
const SPACING_HEIGHT: Record<string, number> = {
  compact: 32,
  cozy: 48,
  comfortable: 56,
};

/**
 * CollectionList - Dynamic list for displaying collection items.
 * Composes VTable for sorting, resize, reorder, selection, and context menu.
 */
export const CollectionList: React.FC<CollectionListProps> = ({
  collection,
  enableSelection = false,
  filter,
  enableFilter = false,
  bulkActions = [],
  fields: displayFields,
  limit: initialLimit = 10,
  enableSearch = true,
  enableSort = true,
  enableResize = true,
  enableReorder = true,
  enableHeaderMenu = true,
  enableAddField = true,
  enableCreate = false,
  primaryKeyField = "id",
  rowHeight: rowHeightProp,
  tableSpacing = "cozy",
  archiveField,
  archiveValue = "archived",
  unarchiveValue = "draft",
  onItemClick,
  onCreate,
  onEdit,
  enableDelete = false,
  onDeleteSuccess,
  onFieldsChange,
  onSortChange: onSortChangeProp,
  onFilterChange,
  onPermissionsLoaded,
  renderCell: consumerRenderCell,
}) => {
  // ----- Data state -----
  const [allFields, setAllFields] = useState<Field[]>([]);
  const [visibleFieldKeys, setVisibleFieldKeys] = useState<string[]>([]);
  const [items, setItems] = useState<AnyItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterCount, setFilterCount] = useState(0);
  const [selectedItems, setSelectedItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- Pagination & search state -----
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState("");

  // ----- Sort state -----
  const [sort, setSort] = useState<Sort>({ by: null, desc: false });

  // ----- Archive filter state -----
  const [archiveFilterMode, setArchiveFilterMode] = useState<ArchiveFilter>("all");

  // ----- Filter panel state -----
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [internalFilter, setInternalFilter] = useState<Record<string, unknown> | null>(null);

  // ----- Delete state -----
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<(string | number)[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ----- Header state (for resize/reorder persistence) -----
  const [headerOverrides, setHeaderOverrides] = useState<
    Record<string, Partial<HeaderRaw>>
  >({});

  // ----- Computed row height -----
  const rowHeight = rowHeightProp ?? SPACING_HEIGHT[tableSpacing] ?? 48;

  // ----- Permission state (mirrors DaaS useCollectionPermissions) -----
  // Fetched from GET /permissions/me via PermissionsService.getMyCollectionAccess().
  // Empty access map (admin or failed fetch) = assume full access.
  const [readableFields, setReadableFields] = useState<string[] | null>(null);
  const [createAllowed, setCreateAllowed] = useState(true);
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [deleteAllowed, setDeleteAllowed] = useState(true);

  // =========================================================================
  // Load fields + permissions in parallel (avoids race condition)
  // =========================================================================
  useEffect(() => {
    let cancelled = false;

    const loadFieldsAndPermissions = async () => {
      try {
        // Fetch fields + full collection access in parallel
        const [fieldsResult, collectionAccess] = await Promise.all([
          new FieldsService().readAll(collection),
          PermissionsService.getMyCollectionAccess().catch(() => ({})),
        ]);

        if (cancelled) return;

        // ── Derive CRUD permission flags (mirrors DaaS useCollectionPermissions) ──
        // Admin users get full access; otherwise check specific collection permissions.
        const accessMap = (collectionAccess ?? {}) as Record<string, Record<string, CollectionActionAccess>>;
        const access = accessMap[collection] || {};
        const isAdmin = PermissionsService.isAdmin;
        const isEmptyAccess = Object.keys(accessMap).length === 0;

        const readAccess: CollectionActionAccess | undefined = access.read;
        const createAccess: CollectionActionAccess | undefined = access.create;
        const updateAccess: CollectionActionAccess | undefined = access.update;
        const deleteAccess: CollectionActionAccess | undefined = access.delete;

        const canCreate = isAdmin || isEmptyAccess || !!createAccess;
        const canUpdate = isAdmin || isEmptyAccess || !!updateAccess;
        const canDelete = isAdmin || isEmptyAccess || !!deleteAccess;

        setCreateAllowed(canCreate);
        setUpdateAllowed(canUpdate);
        setDeleteAllowed(canDelete);

        // Determine archive permission (like DaaS: requires update + archive field in writable fields)
        let canArchive = false;
        if (archiveField && canUpdate) {
          if (isAdmin || isEmptyAccess) {
            canArchive = true;
          } else if (updateAccess?.fields) {
            canArchive = updateAccess.fields.includes("*") || updateAccess.fields.includes(archiveField);
          }
        }

        // Notify consumer of resolved permissions
        if (!cancelled) {
          onPermissionsLoaded?.({
            createAllowed: canCreate,
            readAllowed: isAdmin || isEmptyAccess || !!readAccess,
            updateAllowed: canUpdate,
            deleteAllowed: canDelete,
            archiveAllowed: canArchive,
          });
        }

        // ── Readable fields (for column filtering) ──
        let permFields: string[] | null = null;
        if (!isAdmin && !isEmptyAccess && readAccess) {
          permFields = readAccess.fields ?? null;
          if (permFields && permFields.includes("*")) permFields = null;
        }
        setReadableFields(permFields);

        // All non-system, non-hidden, non-alias fields
        let visible = fieldsResult.filter((f: Field) => {
          if (SYSTEM_FIELDS.includes(f.field)) return false;
          if (f.type === "alias") return false;
          const isHidden = f.meta?.hidden ?? (f as unknown as Record<string, unknown>).hidden;
          if (isHidden) return false;
          return true;
        });

        // Apply read permission field filter
        const hasRestriction = permFields !== null && permFields.length > 0;
        if (hasRestriction) {
          const accessibleSet = new Set(permFields);
          visible = visible.filter((f) => accessibleSet.has(f.field));
        }

        setAllFields(visible);

        // Set initial visible columns (already permission-filtered)
        if (displayFields) {
          const keys = hasRestriction
            ? displayFields.filter((k) => new Set(permFields!).has(k))
            : displayFields;
          setVisibleFieldKeys(
            keys.length > 0
              ? keys
              : visible.slice(0, 5).map((f: Field) => f.field),
          );
        } else {
          const initial = visible.slice(0, 5).map((f: Field) => f.field);
          // Always include PK if visible
          if (
            !initial.includes(primaryKeyField) &&
            visible.some((f) => f.field === primaryKeyField)
          ) {
            initial.unshift(primaryKeyField);
          }
          setVisibleFieldKeys(initial);
        }

        // If no visible fields remain, stop loading with a clear message
        if (visible.length === 0 && !cancelled) {
          setError(`No visible fields found for collection "${collection}". Verify the collection exists and has non-hidden fields.`);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading fields:", err);
        if (!cancelled) {
          setError(
            "Failed to load collection fields. Make sure the Storybook Host app is running (pnpm dev:host) and connected at http://localhost:3000.",
          );
          setLoading(false);
        }
      }
    };

    loadFieldsAndPermissions();
    return () => {
      cancelled = true;
    };
  }, [collection, displayFields, primaryKeyField]);

  // =========================================================================
  // Merge external filter prop with internal FilterPanel filter
  // =========================================================================
  const mergedFilter = useMemo<Record<string, unknown> | null>(() => {
    const filters: Record<string, unknown>[] = [];
    if (filter && Object.keys(filter).length > 0) filters.push(filter);
    if (internalFilter && Object.keys(internalFilter).length > 0) filters.push(internalFilter);
    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];
    return { _and: filters };
  }, [filter, internalFilter]);

  // Count active filter rules for badge display
  const activeFilterCount = useMemo(() => {
    if (!internalFilter) return 0;
    const countRules = (obj: Record<string, unknown>): number => {
      if (obj._and && Array.isArray(obj._and)) return (obj._and as Record<string, unknown>[]).reduce((n, r) => n + countRules(r), 0);
      if (obj._or && Array.isArray(obj._or)) return (obj._or as Record<string, unknown>[]).reduce((n, r) => n + countRules(r), 0);
      return 1;
    };
    return countRules(internalFilter);
  }, [internalFilter]);

  // Clear selection when collection changes
  useEffect(() => {
    setSelectedItems([]);
    setInternalFilter(null);
    setFilterPanelOpen(false);
    setSearch("");
    setPage(1);
  }, [collection]);

  // =========================================================================
  // Load items (page data only — counts are fetched separately)
  // =========================================================================
  const loadItems = useCallback(async () => {
    if (visibleFieldKeys.length === 0) return;
    try {
      setLoading(true);
      setError(null);

      const query: Record<string, unknown> = {
        limit,
        page,
      };

      // Fields to fetch — always include PK
      const fieldsToFetch = [...visibleFieldKeys];
      if (!fieldsToFetch.includes(primaryKeyField)) {
        fieldsToFetch.unshift(primaryKeyField);
      }
      // DaaS expects CSV format, not JSON arrays
      query.fields = fieldsToFetch.join(',');

      // Filter — combine merged filter (external + internal) with archive filter
      const combinedFilters: Record<string, unknown>[] = [];
      if (mergedFilter && Object.keys(mergedFilter).length > 0) {
        combinedFilters.push(mergedFilter);
      }
      // Archive filter
      if (archiveField && archiveFilterMode !== "all") {
        if (archiveFilterMode === "archived") {
          combinedFilters.push({ [archiveField]: { _eq: archiveValue } });
        } else {
          combinedFilters.push({ [archiveField]: { _neq: archiveValue } });
        }
      }
      if (combinedFilters.length === 1) {
        query.filter = combinedFilters[0];
      } else if (combinedFilters.length > 1) {
        query.filter = { _and: combinedFilters };
      }

      // Search
      if (search) {
        query.search = search;
      }

      // Sort
      if (sort.by) {
        query.sort = sort.desc ? `-${sort.by}` : sort.by;
      }

      const queryString = new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [
            k,
            typeof v === "object" ? JSON.stringify(v) : String(v),
          ]),
      ).toString();

      const rawResponse = await apiRequest<
        { data: Record<string, unknown>[]; meta?: { page?: number; limit?: number; total?: number } } | Record<string, unknown>[]
      >(`/api/items/${collection}${queryString ? `?${queryString}` : ""}`);

      if (Array.isArray(rawResponse)) {
        setItems(rawResponse);
        setFilterCount(rawResponse.length);
      } else {
        setItems(rawResponse.data || []);
        // DaaS returns meta.total = total matching rows (ignoring pagination)
        if (rawResponse.meta?.total != null) {
          setFilterCount(rawResponse.meta.total);
        } else {
          setFilterCount(rawResponse.data?.length ?? 0);
        }
      }
    } catch (err) {
      console.error("Error loading items:", err);
      setError(err instanceof Error ? err.message : "Failed to load items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    collection,
    visibleFieldKeys,
    mergedFilter,
    limit,
    page,
    search,
    sort,
    primaryKeyField,
    archiveField,
    archiveFilterMode,
    archiveValue,
  ]);

  // =========================================================================
  // Aggregate count: total records in the collection (no user filter/search)
  // Filtered count (filterCount) is extracted from meta.total in loadItems.
  // =========================================================================
  const getTotalCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        "aggregate[count]": primaryKeyField,
      });
      const response = await apiRequest<{
        data: Array<{ count: Record<string, number> }>;
      }>(`/api/items/${collection}?${params.toString()}`);
      const count = Number(response.data?.[0]?.count?.[primaryKeyField] ?? 0);
      setTotalCount(count);
    } catch {
      // Non-critical — keep existing totalCount
    }
  }, [collection, primaryKeyField]);

  useEffect(() => {
    if (visibleFieldKeys.length > 0) {
      loadItems();
    }
  }, [loadItems, visibleFieldKeys.length]);

  // Fetch total count when collection changes
  useEffect(() => {
    getTotalCount();
  }, [getTotalCount]);

  // Reset page on search/filter change
  useEffect(() => {
    setPage(1);
  }, [search, filter, internalFilter]);

  // Permission-filtered field list (allFields is already filtered by permissions
  // in the combined load effect above, so permittedFields === allFields)
  const permittedFields = useMemo<Field[]>(() => allFields, [allFields]);

  // =========================================================================
  // Build VTable headers from field metadata
  // =========================================================================
  const headers = useMemo<HeaderRaw[]>(() => {
    return visibleFieldKeys.map((key) => {
      const fieldMeta = permittedFields.find((f) => f.field === key);
      const overrides = headerOverrides[key] || {};
      // Use field.meta?.field (display name) or humanize the key.
      // DaaS uses field `name` for display; DaaS uses meta.note as a tooltip.
      // The header text should be the humanized field name, not the note.
      const label =
        (fieldMeta as Record<string, unknown> | undefined)?.name as string ||
        key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      return {
        text: label,
        value: key,
        sortable: enableSort,
        align: (overrides.align as Alignment) || "left",
        width: overrides.width ?? null,
        // Attach field metadata for consumers and renderCell
        description: fieldMeta?.meta?.note || undefined,
        field: fieldMeta,
        ...overrides,
      } as HeaderRaw;
    });
  }, [visibleFieldKeys, permittedFields, headerOverrides, enableSort]);

  // =========================================================================
  // Derived / computed
  // =========================================================================
  // Pagination is driven by filterCount (= items matching current filter/search),
  // mirroring DaaS: totalPages = ceil(itemCount / limit)
  const totalPages = Math.max(1, Math.ceil(filterCount / limit));
  const selectedIds = useMemo(() => {
    return selectedItems.map((item) =>
      typeof item === "object" && item !== null
        ? (item as AnyItem)[primaryKeyField]
        : item,
    ) as (string | number)[];
  }, [selectedItems, primaryKeyField]);

  // =========================================================================
  // Field add/remove helpers
  // =========================================================================
  const addField = useCallback(
    (fieldKey: string) => {
      setVisibleFieldKeys((prev) => {
        if (prev.includes(fieldKey)) return prev;
        const next = [...prev, fieldKey];
        onFieldsChange?.(next);
        return next;
      });
    },
    [onFieldsChange],
  );

  const removeField = useCallback(
    (fieldKey: string) => {
      setVisibleFieldKeys((prev) => {
        const next = prev.filter((k) => k !== fieldKey);
        onFieldsChange?.(next);
        return next;
      });
    },
    [onFieldsChange],
  );

  // =========================================================================
  // Header context menu actions
  // =========================================================================
  const handleAlignChange = useCallback(
    (fieldKey: string, align: Alignment) => {
      setHeaderOverrides((prev) => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], align },
      }));
    },
    [],
  );

  const handleSortChange = useCallback(
    (newSort: Sort | null) => {
      const s = newSort ?? { by: null, desc: false };
      setSort(s);
      onSortChangeProp?.(s);
    },
    [onSortChangeProp],
  );

  const handleHeadersChange = useCallback((newHeaders: HeaderRaw[]) => {
    // Persist width/align overrides
    const overrides: Record<string, Partial<HeaderRaw>> = {};
    newHeaders.forEach((h) => {
      overrides[h.value] = {};
      if (h.width) overrides[h.value].width = h.width;
      if (h.align && h.align !== "left") overrides[h.value].align = h.align;
    });
    setHeaderOverrides((prev) => ({ ...prev, ...overrides }));
    // Update visible field order
    setVisibleFieldKeys(newHeaders.map((h) => h.value));
  }, []);

  // =========================================================================
  // Render header context menu (right-click)
  // =========================================================================
  const renderHeaderContextMenu = useCallback(
    (header: Header) => {
      if (!enableHeaderMenu) return null;
      return (
        <div className="collection-list-context-menu" role="menu">
          {/* Sort */}
          <Menu.Label>Sort</Menu.Label>
          <div
            role="menuitem"
            className="mantine-Menu-item collection-list-context-menu-item"
            onClick={() => handleSortChange({ by: header.value, desc: false })}
          >
            <IconSortAscending size={14} />
            <Text size="sm">Sort ascending</Text>
          </div>
          <div
            role="menuitem"
            className="mantine-Menu-item collection-list-context-menu-item"
            onClick={() => handleSortChange({ by: header.value, desc: true })}
          >
            <IconSortDescending size={14} />
            <Text size="sm">Sort descending</Text>
          </div>

          <div className="collection-list-context-menu-divider" />

          {/* Alignment */}
          <Menu.Label>Alignment</Menu.Label>
          {[
            {
              align: "left" as Alignment,
              icon: <IconAlignLeft size={14} />,
              label: "Align left",
            },
            {
              align: "center" as Alignment,
              icon: <IconAlignCenter size={14} />,
              label: "Align center",
            },
            {
              align: "right" as Alignment,
              icon: <IconAlignRight size={14} />,
              label: "Align right",
            },
          ].map(({ align, icon, label }) => (
            <div
              key={align}
              role="menuitem"
              className={`mantine-Menu-item collection-list-context-menu-item${
                header.align === align ? " active" : ""
              }`}
              onClick={() => handleAlignChange(header.value, align)}
            >
              {icon}
              <Text size="sm">{label}</Text>
            </div>
          ))}

          <div className="collection-list-context-menu-divider" />

          {/* Hide field */}
          <div
            role="menuitem"
            className="mantine-Menu-item collection-list-context-menu-item danger"
            onClick={() => removeField(header.value)}
          >
            <IconEyeOff size={14} />
            <Text size="sm">Hide field</Text>
          </div>
        </div>
      );
    },
    [enableHeaderMenu, handleSortChange, handleAlignChange, removeField],
  );

  // =========================================================================
  // "Add field" button for header append slot
  // =========================================================================
  const hiddenFields = useMemo(() => {
    return permittedFields.filter((f) => !visibleFieldKeys.includes(f.field));
  }, [permittedFields, visibleFieldKeys]);

  // =========================================================================
  // =========================================================================
  // Field-type-aware cell renderer
  // Mirrors DaaS adjustFieldsForDisplays — booleans show icons,
  // dates/timestamps are formatted, numbers use locale, relations show FK.
  // Consumer renderCell is called first; if it returns non-null the result is used.
  // =========================================================================
  const fieldTypeRenderCell = useCallback(
    (item: Record<string, unknown>, header: Header): React.ReactNode | null => {
      if (consumerRenderCell) {
        const consumerResult = consumerRenderCell(item as AnyItem, header);
        if (consumerResult !== null && consumerResult !== undefined) return consumerResult;
      }
      const fieldMeta = permittedFields.find((f) => f.field === header.value);
      if (!fieldMeta) return null; // fall back to VTable default

      const value = item[header.value];
      if (value === null || value === undefined) return null; // VTable shows "—"

      const fieldType = fieldMeta.type;

      // ---------- Boolean ----------
      if (fieldType === "boolean") {
        return value ? (
          <IconCheck size={16} color="var(--mantine-color-green-6)" aria-label="Yes" />
        ) : (
          <IconX size={16} color="var(--mantine-color-gray-4)" aria-label="No" />
        );
      }

      // ---------- Datetime / Timestamp / Date ----------
      if (
        fieldType === "timestamp" ||
        fieldType === "dateTime" ||
        fieldType === "date"
      ) {
        try {
          const dateObj = new Date(value as string);
          if (isNaN(dateObj.getTime())) return null;
          if (fieldType === "date") {
            return (
              <Text size="sm" truncate="end">
                {dateObj.toLocaleDateString()}
              </Text>
            );
          }
          return (
            <Text size="sm" truncate="end">
              {dateObj.toLocaleString()}
            </Text>
          );
        } catch {
          return null;
        }
      }

      // ---------- Integer / Float / Decimal / BigInteger ----------
      if (
        fieldType === "integer" ||
        fieldType === "float" ||
        fieldType === "decimal" ||
        fieldType === "bigInteger"
      ) {
        const num = Number(value);
        if (!isNaN(num)) {
          return (
            <Text size="sm" truncate="end">
              {num.toLocaleString()}
            </Text>
          );
        }
        return null;
      }

      // ---------- JSON (display as badge) ----------
      if (fieldType === "json") {
        return (
          <Badge variant="light" size="sm" color="gray">
            JSON
          </Badge>
        );
      }

      // ---------- UUID (truncate) ----------
      if (fieldType === "uuid") {
        const str = String(value);
        return (
          <Tooltip label={str} openDelay={300}>
            <Text size="sm" truncate="end" style={{ maxWidth: 120 }}>
              {str.substring(0, 8)}…
            </Text>
          </Tooltip>
        );
      }

      // ---------- Default: let VTable handle it ----------
      return null;
    },
    [permittedFields],
  );

  const renderHeaderAppend = useCallback(() => {
    if (!enableAddField || hiddenFields.length === 0) return null;
    return (
      <Menu position="bottom-end" withArrow shadow="md" closeOnItemClick>
        <Menu.Target>
          <ActionIcon variant="subtle" size="sm" title="Add field">
            <IconPlus size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Add field</Menu.Label>
          {hiddenFields.map((f) => (
            <Menu.Item key={f.field} onClick={() => addField(f.field)}>
              {f.meta?.note ||
                f.field
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    );
  }, [enableAddField, hiddenFields, addField]);

  // =========================================================================
  // Filter panel handler
  // =========================================================================
  const handleFilterChange = useCallback(
    (newFilter: Record<string, unknown> | null) => {
      setInternalFilter(newFilter);
      onFilterChange?.(newFilter);
    },
    [onFilterChange],
  );

  const handleClearFilter = useCallback(() => {
    setInternalFilter(null);
    onFilterChange?.(null);
    setFilterPanelOpen(false);
  }, [onFilterChange]);

  // =========================================================================
  // Delete handlers
  // =========================================================================
  const handleDeleteRequest = useCallback(
    (ids: (string | number)[]) => {
      if (ids.length === 0) return;
      setDeletingIds(ids);
      setDeleteConfirmOpen(true);
    },
    [],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (deletingIds.length === 0) return;

    setDeleteLoading(true);
    try {
      const itemsService = new ItemsService(collection);
      await itemsService.deleteMany(deletingIds, primaryKeyField);
      setDeleteConfirmOpen(false);
      setDeletingIds([]);
      setSelectedItems([]);
      onDeleteSuccess?.(deletingIds);
      // Refresh list and counts (loadItems also updates filterCount via meta.total)
      loadItems();
      getTotalCount();
    } catch (err) {
      console.error("Error deleting items:", err);
      setError(err instanceof Error ? err.message : "Failed to delete items");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingIds, collection, primaryKeyField, loadItems, getTotalCount, onDeleteSuccess]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setDeletingIds([]);
  }, []);

  // =========================================================================
  // Item count display (mirrors DaaS "X-Y of Z items (N filtered)")
  // =========================================================================
  // Mirrors DaaS formatItemsCountPaginated:
  //   currentItems = filterCount (filtered result set)
  //   totalItems   = totalCount  (all records in collection)
  //   isFiltered   = true when a user filter/search narrows the set
  const isFiltered = useMemo(() => {
    return (
      search.trim().length > 0 ||
      (filter && Object.keys(filter).length > 0) ||
      (internalFilter && Object.keys(internalFilter).length > 0) ||
      (archiveField && archiveFilterMode !== "all")
    );
  }, [search, filter, internalFilter, archiveField, archiveFilterMode]);

  const itemCountDisplay = useMemo(() => {
    if (loading) return "Loading...";
    if (filterCount === 0) return "No items";
    const from = Math.min((page - 1) * limit + 1, filterCount);
    const to = Math.min(page * limit, filterCount);
    // When filtered and result set is smaller than total, show both
    if (isFiltered && filterCount < totalCount) {
      if (filterCount <= limit) {
        return `${filterCount} item${filterCount !== 1 ? "s" : ""} (filtered from ${totalCount})`;
      }
      return `${from}–${to} of ${filterCount} items (filtered from ${totalCount})`;
    }
    // Single page — just show count
    if (filterCount <= limit) {
      return `${filterCount} item${filterCount !== 1 ? "s" : ""}`;
    }
    return `${from}–${to} of ${filterCount} items`;
  }, [loading, totalCount, filterCount, page, limit, isFiltered]);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <Stack gap={0} className="collection-list" data-testid="collection-list">
      {/* ── Action Toolbar ── */}
      <CollectionListToolbar
        enableSearch={enableSearch}
        search={search}
        onSearchChange={setSearch}
        enableFilter={enableFilter}
        filterPanelOpen={filterPanelOpen}
        activeFilterCount={activeFilterCount}
        onToggleFilterPanel={() => setFilterPanelOpen((v) => !v)}
        archiveField={archiveField}
        archiveFilterMode={archiveFilterMode}
        onArchiveFilterChange={setArchiveFilterMode}
        onRefresh={loadItems}
        enableSelection={enableSelection}
        selectedIds={selectedIds}
        enableDelete={enableDelete}
        deleteAllowed={deleteAllowed}
        createAllowed={createAllowed}
        updateAllowed={updateAllowed}
        bulkActions={bulkActions}
        onDeleteRequest={handleDeleteRequest}
        onClearSelection={() => setSelectedItems([])}
        enableCreate={enableCreate}
        onCreate={onCreate}
      />

      {/* ── Inline Filter Panel (collapsible) ── */}
      {enableFilter && (
        <Collapse in={filterPanelOpen}>
          <div className="collection-list-filter-panel" data-testid="collection-list-filter-panel">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600}>Filters</Text>
              {activeFilterCount > 0 && (
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconFilterOff size={14} />}
                  onClick={handleClearFilter}
                  data-testid="collection-list-clear-filters"
                >
                  Clear all
                </Button>
              )}
            </Group>
            <FilterPanel
              fields={permittedFields}
              value={internalFilter}
              onChange={handleFilterChange}
              mode="inline"
            />
          </div>
        </Collapse>
      )}

      {/* Error Alert */}
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          data-testid="collection-list-error"
          mt="xs"
        >
          {error}
        </Alert>
      )}

      {/* ── Bottom Pagination (above VTable for visibility) ── */}

      {/* ── VTable ── */}
      <VTable
        headers={headers}
        items={items}
        itemKey={primaryKeyField}
        sort={sort}
        mustSort={false}
        showSelect={enableSelection ? "multiple" : "none"}
        showResize={enableResize}
        allowHeaderReorder={enableReorder}
        value={selectedItems}
        fixedHeader
        loading={loading}
        loadingText="Loading items..."
        noItemsText={
          isFiltered
            ? "No results — try adjusting your search or filters"
            : "No items in this collection"
        }
        rowHeight={rowHeight}
        selectionUseKeys
        clickable={!!onItemClick}
        renderCell={fieldTypeRenderCell}
        renderHeaderContextMenu={
          enableHeaderMenu ? renderHeaderContextMenu : undefined
        }
        renderHeaderAppend={enableAddField ? renderHeaderAppend : undefined}
        renderFooter={() => (
          <CollectionListFooter
            itemCountDisplay={itemCountDisplay}
            limit={limit}
            onLimitChange={(val) => { setLimit(val); setPage(1); }}
            page={page}
            onPageChange={setPage}
            totalPages={totalPages}
          />
        )}
        onUpdate={setSelectedItems}
        onSortChange={handleSortChange}
        onHeadersChange={handleHeadersChange}
        onRowClick={
          onItemClick ? ({ item }) => onItemClick(item as AnyItem) : undefined
        }
        data-testid="collection-list-table"
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        opened={deleteConfirmOpen}
        count={deletingIds.length}
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Stack>
  );
};

export default CollectionList;
