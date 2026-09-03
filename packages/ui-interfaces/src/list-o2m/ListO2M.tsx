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
import { useBuildpadI18n, useBuildpadTranslations } from "@buildpad/services";
import { interpolate, type DeepPartial, type InterfacesTranslations } from "@buildpad/utils";
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderTemplate, getByPath, DEFAULT_RELATIONAL_FIELDS, resolveDisplayTemplate, resolveRelationFields } from "../list-m2a/render-template";

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
/**
 * An existing related item picked via "Add Existing" while the parent is still
 * unsaved. Carries the fetched display fields so the row can render, but only
 * `id` + the FK are emitted on save — see the emit effect.
 */
interface StagedLink {
  $type: "linked";
  id: string | number;
  [key: string]: unknown;
}

/** The full changeset that tracks all pending mutations */
interface O2MChangeset {
  create: StagedCreate[];
  update: StagedUpdate[];
  delete: StagedDelete[];
  /**
   * Existing related items picked via "Add Existing" while the parent is
   * still unsaved. Unlike `update` (which only applies to items already
   * present in `baseItems`), these carry the item's real id but haven't
   * been linked to the parent yet, so they need their own bucket to be
   * both rendered in `displayItems` and emitted with the FK on save.
   */
  link: StagedLink[];
}

const EMPTY_CHANGESET: O2MChangeset = { create: [], update: [], delete: [], link: [] };

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
  /** Per-instance overrides of the dictionary strings (`interfaces.listO2M`) */
  translations?: DeepPartial<InterfacesTranslations['listO2M']>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

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
      const val = getByPath(parentValues, field);
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
  fields = DEFAULT_RELATIONAL_FIELDS,
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
  translations,
}) => {
  // Precedence: `translations` prop > provider dictionary > English defaults.
  const t = useBuildpadTranslations((d) => d.interfaces.listO2M, translations);
  const { formatCount } = useBuildpadI18n();

  // `value` is accepted for interface parity with the other relational
  // components but is not read: this component is the source of truth for its
  // own pending changes and emits them through `onChange`.
  void valueProp;

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

  // The related collection's real primary key column — not necessarily "id"
  // (e.g. a slug-PK collection). Real (already-loaded) rows must be keyed by
  // this field; hardcoding `.id` silently breaks React keys, the checkbox
  // selection Set, and every staged update/delete match, since `.id` is
  // `undefined` on such collections. Staged local-only rows ($temp_N
  // creates, and the synthetic id given to demo/mock items) intentionally
  // keep using their own `id`/`$temp_` scheme — that's not real collection
  // data, so there's nothing to resolve.
  const pkField = relationInfo?.relatedPrimaryKeyField?.field || "id";
  const getPk = useCallback(
    (item: O2MItem): string | number => {
      if (typeof item.id === "string" && item.id.startsWith("$temp_")) {
        return item.id;
      }
      return (item[pkField] as string | number) ?? item.id;
    },
    [pkField],
  );

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

  // ── Display template resolution ─────────────────────────────────────────
  const displayTemplate = useMemo(
    () => resolveDisplayTemplate(template, relationInfo as Parameters<typeof resolveDisplayTemplate>[1]),
    [template, relationInfo],
  );
  const resolvedFields = useMemo(
    () => resolveRelationFields(displayTemplate, fields, relationInfo?.relatedPrimaryKeyField?.field),
    [displayTemplate, fields, relationInfo],
  );

  // The `fields` prop defaults to the bootstrap ["id"], which is a stand-in
  // for "the primary key" rather than a real column. Rendering it verbatim
  // shows an empty "Id" column — and sorts by a column that doesn't exist —
  // whenever the related PK isn't literally "id". Substitute the resolved PK,
  // the same rule resolveRelationFields applies to the query.
  const displayColumns = useMemo(
    () => fields.map((f) => (f === "id" && pkField !== "id" ? pkField : f)),
    [fields, pkField],
  );

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
  // Ref (not a plain `let`) so the counter survives handleFormSuccess being
  // re-memoized (its deps include currentlyEditing/isCreatingNew, which
  // change on every create/edit) — otherwise interleaved creates can be
  // assigned the same $index/$temp id.
  const createIndexRef = useRef(0);
  // Whether we've ever emitted. Lets the effect below suppress *only* the
  // mount emit: once the user has staged something, going back to an empty
  // changeset must still be emitted so the parent form drops the field edit.
  const hasEmittedRef = useRef(false);
  // Last successfully fetched id set of the parent's currently linked
  // children, keyed by the parent pk it was fetched for. Lets the emit
  // effect deliver a synchronous payload (the parent form snapshots field
  // values at Save-click time, so an emit that lands only after a network
  // round-trip leaves a window where Save submits the previous payload) and
  // gives the failure path a known-good fallback. The direct-API mutation
  // handlers below keep it in sync.
  const preservedIdsRef = useRef<{
    key: string | number;
    ids: (string | number)[];
  } | null>(null);
  // Bumped to force a re-emit after out-of-band mutations (direct unlink /
  // delete, modal create on a saved parent) and by the preserve-error Retry
  // button.
  const [preserveEpoch, setPreserveEpoch] = useState(0);
  // Set when a preserve fetch failed with no cached fallback: the pending
  // change is still rendered in the list but has NOT been handed to the
  // parent form.
  const [preserveError, setPreserveError] = useState<string | null>(null);

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
    let merged = baseItems.filter((item) => !deletedIds.has(getPk(item)));

    // Apply staged updates. Used for both fetched rows and staged links —
    // a link picked while the parent is unsaved can be edited before save,
    // and that edit must show in the row and dedupe against the link entry.
    const applyStagedUpdate = (item: O2MItem): O2MItem => {
      const update = changeset.update.find((u) => u.id === getPk(item));
      if (update) {
        const { $type, ...rest } = update;
        return { ...item, ...rest };
      }
      return item;
    };
    merged = merged.map(applyStagedUpdate);

    // Append staged creates
    const createdItems: O2MItem[] = changeset.create.map((c) => {
      const { $type, $index, ...rest } = c;
      // `rest` carries the real `id` CollectionForm injects on every
      // onSuccess, so the sentinel must be assigned last or it is lost and
      // every `$temp_` guard in this file silently mis-branches.
      return { ...rest, id: `$temp_${$index}` } as O2MItem;
    });

    // Append staged links (existing items picked via "Add Existing" while
    // the parent is unsaved — not in baseItems yet, so `update` above never
    // matches them; they need to be appended here to render at all).
    const alreadyMergedIds = new Set(merged.map((item) => getPk(item)));
    const linkedItems: O2MItem[] = changeset.link
      .filter((l) => !alreadyMergedIds.has(l.id))
      .map((l) => {
        const { $type, ...rest } = l;
        return applyStagedUpdate({ ...rest } as O2MItem);
      });

    return [...merged, ...linkedItems, ...createdItems];
  }, [baseItems, changeset, getPk]);

  // Select-all state must be derived from membership, not from comparing the
  // Set's size to the row count: the Set can hold ids that are no longer on
  // this page, and duplicate/undefined keys collapse it.
  const allSelected =
    displayItems.length > 0 &&
    displayItems.every((item) => selectedIds.has(getPk(item)));
  const someSelected = displayItems.some((item) =>
    selectedIds.has(getPk(item)),
  );

  // F11b: drop selections for rows that are no longer displayed (page change,
  // search, single-row removal) so batch actions can never target nothing.
  useEffect(() => {
    const visible = new Set(displayItems.map((item) => getPk(item)));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [displayItems, getPk]);

  // Reset staged state when the parent record changes. Without this, staged
  // links/updates/deletes from record A are still emitted for record B when
  // the host swaps `primaryKey` without remounting this component.
  const lastParentKeyRef = useRef(primaryKey);
  useEffect(() => {
    if (lastParentKeyRef.current === primaryKey) return;
    lastParentKeyRef.current = primaryKey;
    setChangeset(EMPTY_CHANGESET);
    setSelectedIds(new Set());
    preservedIdsRef.current = null;
    createIndexRef.current = 0;
  }, [primaryKey]);

  const totalCount = isDemoMode
    ? internalMockItems.length
    : hookTotalCount +
      changeset.create.length +
      changeset.link.length -
      changeset.delete.length;
  const loading = isDemoMode ? false : relationLoading || itemsLoading;

  // ── Emit changeset to parent onChange ───────────────────────────────────
  useEffect(() => {
    if (!onChange) return;
    const hasChanges =
      changeset.create.length > 0 ||
      changeset.update.length > 0 ||
      changeset.delete.length > 0 ||
      changeset.link.length > 0;

    // Suppress the mount emit only. Previously this fell through when `value`
    // was already populated (`!hasChanges && value.length === 0` is false for a
    // populated value), so the payload stayed `[]` and the trailing guard
    // (`value.length > 0`) fired onChange([]) on mount, silently clearing an
    // existing O2M value.
    //
    // Bailing on `!hasChanges` alone is not enough: once something has been
    // staged, un-staging it back to empty must still emit `[]`, otherwise the
    // parent form keeps the last payload and saves items the user removed.
    if (!hasChanges && !hasEmittedRef.current) {
      // Nothing staged and nothing ever emitted — any earlier preserve
      // failure is moot (the change it failed to stage is gone).
      setPreserveError((prev) => (prev === null ? prev : null));
      return;
    }

    const fkField = relationInfo?.reverseJunctionField?.field;
    const relatedCol = relationInfo?.relatedCollection?.collection;

    const buildPayload = (preservedIds: (string | number)[] | null) => {
      const payload: (string | number | Record<string, unknown>)[] = [];

      // Creates: emit the item data with FK pointing to parent
      for (const item of changeset.create) {
        const { $type, $index, ...data } = item;
        payload.push({
          ...data,
          ...(fkField ? { [fkField]: primaryKey || "+" } : {}),
        });
      }

      // Links: existing items picked while the parent is unsaved. Emit the
      // reference only (id + FK) — DaaS links by id and fills in the real parent
      // key. The staged entry also carries the fetched display fields so the row
      // can render, but those must NOT be echoed back: when the display template
      // references a nested path (e.g. `{{author_id.name}}`) the fetched row
      // contains a nested object, and DaaS then silently drops the whole entry
      // from the save (201, `posts: []`) instead of linking it.
      //
      // KNOWN LIMIT: every object-shaped entry below is keyed by a literal
      // "id" property, and that is deliberate. The relation writer looks a
      // record up via `itemObj[manyPrimary]`, but `manyPrimary` is
      // `directus_relations.many_primary`, which is `TEXT NOT NULL DEFAULT
      // 'id'` and is hardcoded to "id" at every DaaS write site — this repo
      // never sends it. So `manyPrimary` is always the literal "id" in
      // practice, and re-keying these entries by the related collection's
      // real PK column makes the lookup miss: the writer then falls through
      // to its create branch and INSERTs a row that already exists.
      // Supporting a related collection whose PK isn't "id" needs a backend
      // change (populate `many_primary`), not just a client change.
      const stagedLinkIds = new Set(changeset.link.map((item) => item.id));
      for (const item of changeset.link) {
        // `item.id` already holds the resolved real PK *value* (getPk, set
        // at staging time); only the backend's key name is fixed at "id".
        payload.push({
          id: item.id,
          ...(fkField ? { [fkField]: primaryKey || "+" } : {}),
        });
      }

      // N1 fix: a saved parent with staged links needs every other
      // already-linked child preserved in the payload too, or the relation
      // writer deselects them. Bare primitive entries match its
      // string/number shorthand, which passes the value straight to
      // `recordsToUpdate` without reading any property off it — so unlike
      // the object-shaped entries above they carry no key-name assumption
      // at all (the writer still filters by `manyPrimary`, i.e. "id").
      if (preservedIds) {
        for (const pk of preservedIds) {
          if (!stagedLinkIds.has(pk)) {
            payload.push(pk);
          }
        }
      }

      // Updates: emit the staged `id` plus the changed fields. `data` is
      // spread last on purpose — when the PK column is user-editable the
      // user's new value must survive, so the PK key must not be reasserted
      // over it.
      for (const item of changeset.update) {
        const { $type, ...data } = item;
        payload.push(data);
      }

      // Deletes: emit id with a $delete marker. NOTE: DaaS has no reader for
      // `$delete` — it is dropped as an unknown column and the entry is
      // routed by `itemObj["id"]` like any other, i.e. this re-links the row
      // rather than removing it. Removing a fetched row while the parent is
      // unsaved therefore has no backend representation today.
      for (const item of changeset.delete) {
        payload.push({ id: item.id, $delete: true });
      }

      return payload;
    };

    const emit = (preservedIds: (string | number)[] | null) => {
      hasEmittedRef.current = true;
      onChange(buildPayload(preservedIds));
    };

    // The preserve requirement must NOT be gated on
    // `changeset.link.length > 0` ALONE, or a revert hole opens up: stage a
    // link (preserve runs, hasEmittedRef becomes true) → un-stage it again
    // (change of mind) → changeset is entirely empty, so
    // `changeset.link.length > 0` is false, but the effect still runs (see
    // the bail-out above) and would emit `[]` — the relation writer's
    // empty-array branch then unlinks/deletes every child.
    // `hasEmittedRef.current` is added as an OR so any run after the first
    // real emit also re-preserves, turning the revert into a no-op re-link
    // of the full current id set instead. Dropping the original
    // `changeset.link.length > 0` arm instead of OR-ing would skip the
    // preserve on the very first stage (hasEmittedRef is still false then),
    // reopening the original N1 bug.
    if (
      !isParentSaved ||
      (changeset.link.length === 0 && !hasEmittedRef.current) ||
      !relatedCol ||
      !fkField ||
      !primaryKey
    ) {
      emit(null);
      return;
    }

    const cached =
      preservedIdsRef.current && preservedIdsRef.current.key === primaryKey
        ? preservedIdsRef.current.ids
        : null;

    // Emit synchronously whenever a known-good id set exists. The parent
    // form snapshots its field values at Save-click time, so an emit that
    // only lands after a network round-trip leaves a window where Save
    // submits the PREVIOUS payload — e.g. a link the user just reverted.
    // The fetch below still runs and re-emits only if the server set
    // actually differs from the cache.
    if (cached) {
      emit(cached);
    }

    let cancelled = false;

    const refreshAndReconcile = async () => {
      try {
        const { apiRequest } = await import("@buildpad/services");
        const qp = new URLSearchParams();
        qp.set("filter", JSON.stringify({ [fkField]: { _eq: primaryKey } }));
        qp.set("fields", pkField);
        // `limit=-1` alone is NOT "no limit" here: the route defaults
        // `page` to 1 regardless, and the range branch then computes a
        // broken range for limit=-1. `page=0` is falsy so that branch is
        // skipped entirely, same as passing no page at all.
        qp.set("limit", "-1"); // fetch every linked child, not just the current page
        qp.set("page", "0");
        // An exact count lets us detect a silently capped response (e.g. a
        // server-side max-rows setting): emitting a truncated id set as the
        // authoritative payload would deselect every child beyond the cap.
        qp.set("count", "exact");
        const resp = await apiRequest<{
          data: Record<string, unknown>[];
          meta?: { total_count?: number };
        }>(`/api/items/${relatedCol}?${qp.toString()}`);
        if (cancelled) return;

        const rows = resp.data || [];
        const total = resp.meta?.total_count;
        if (typeof total === "number" && rows.length !== total) {
          throw new Error(
            `preserve fetch returned ${rows.length} of ${total} linked rows (server-side row cap?)`,
          );
        }
        const ids: (string | number)[] = [];
        for (const row of rows) {
          const pk = row[pkField];
          if (pk === undefined || pk === null) {
            // A row we can't key would silently fall out of the payload and
            // be deselected on save (e.g. field permissions stripping the
            // PK column). Treat the whole fetch as unusable instead.
            throw new Error(`linked row is missing its primary key ('${pkField}')`);
          }
          ids.push(pk as string | number);
        }

        preservedIdsRef.current = { key: primaryKey, ids };
        setPreserveError((prev) => (prev === null ? prev : null));

        if (!cached) {
          emit(ids);
        } else {
          const cachedSet = new Set(cached);
          const changed =
            ids.length !== cached.length || ids.some((id) => !cachedSet.has(id));
          if (changed) {
            emit(ids);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch existing children to preserve on save:", err);
        if (!cached) {
          // No known-good id set to fall back on: an emit here would be a
          // links-only payload, which the relation writer treats as
          // authoritative and answers by deselecting every other child.
          // Withhold the emit and surface it — the staged change is visible
          // in the list but has NOT been handed to the parent form.
          setPreserveError(t.errors.preserveFailed);
        }
        // With a cache, the synchronous emit above already delivered the
        // last known-good payload; a failed refresh only skips
        // reconciliation for this round.
      }
    };

    refreshAndReconcile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeset, isParentSaved, primaryKey, relationInfo, preserveEpoch]);

  // ── Priority #4: Unique FK guard ────────────────────────────────────────
  // In demo mode, use mockRelationInfo; otherwise use hookRelationInfo
  const guardInfo = isDemoMode ? mockRelationInfo : (hookRelationInfo as O2MRelationInfo | null);
  const isUniqueConstrained = guardInfo?.isForeignKeyUnique === true;
  const effectiveItemCount = isDemoMode ? internalMockItems.length : hookTotalCount;
  const hasExistingItem =
    (effectiveItemCount > 0 ||
      changeset.create.length > 0 ||
      changeset.link.length > 0) &&
    isUniqueConstrained;

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
        fields: resolvedFields,
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
    resolvedFields,
    enableSearchFilter,
    loadItems,
  ]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCreateNew = () => {
    setCurrentlyEditing(null);
    setIsCreatingNew(true);
    openEditModal();
  };

  // R6.1: resolve via getPk, not the raw `.id` property — for a related
  // collection whose PK isn't literally "id", `currentlyEditing.id` is
  // undefined. A staged local create ($temp_ sentinel) has no server row to
  // edit, so it resolves to undefined on purpose.
  const editingPk =
    currentlyEditing &&
    !(
      typeof currentlyEditing.id === "string" &&
      currentlyEditing.id.startsWith("$temp_")
    )
      ? getPk(currentlyEditing)
      : undefined;

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
            fields: resolvedFields,
          });
        }
        if (isCreatingNew) {
          // A child was just created and born linked (via the FK default in
          // the modal). A previously emitted payload doesn't contain it, and
          // the relation writer treats that payload as authoritative — saving
          // the parent would deselect the new child. Invalidate the snapshot
          // and re-emit so the payload is rebuilt from fresh server state.
          preservedIdsRef.current = null;
          setPreserveEpoch((v) => v + 1);
        }
        return;
      }

      // Parent not saved → stage into changeset
      if (isCreatingNew && data) {
        setChangeset((prev) => ({
          ...prev,
          create: [
            ...prev.create,
            { $type: "created", $index: createIndexRef.current++, ...data },
          ],
        }));
      } else if (
        currentlyEditing &&
        data &&
        typeof currentlyEditing.id === "string" &&
        currentlyEditing.id.startsWith("$temp_")
      ) {
        // Editing a staged-created row — merge into the matching create entry
        // instead of staging an update (a $temp_ id is unresolvable by the backend).
        const idx = parseInt(currentlyEditing.id.replace("$temp_", ""), 10);
        setChangeset((prev) => ({
          ...prev,
          create: prev.create.map((c) =>
            c.$index === idx ? { ...c, ...data } : c,
          ),
        }));
      } else if (currentlyEditing && data) {
        // R6.1: stage the resolved real PK (getPk), not the raw `.id`
        // property — for a related collection whose PK isn't literally
        // "id", `currentlyEditing.id` is undefined, which both broke
        // de-duping against a prior staged update for the same row and
        // fed an undefined id into the emitted payload.
        const editedPk = getPk(currentlyEditing);
        setChangeset((prev) => ({
          ...prev,
          update: [
            ...prev.update.filter((u) => u.id !== editedPk),
            // `id` last: `data` always carries CollectionForm's own literal
            // `id`, which would otherwise overwrite the resolved PK and
            // desynchronise the stored key from the de-dupe filter above.
            { $type: "updated", ...data, id: editedPk },
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
      resolvedFields,
    ],
  );

  /**
   * Select existing items from the related collection.
   *
   * Always stages into the `link` bucket and defers the actual link to the
   * parent form's save, regardless of whether the parent is already saved.
   * Previously, picking an item on an already-saved parent linked it via an
   * immediate API call here — bypassing `onChange` entirely, so the parent
   * form's dirty-tracking never saw the change and the Save button stayed
   * disabled even though the row had already been linked server-side.
   * Staging unconditionally makes the two cases behave the same way: nothing
   * is persisted until the user clicks Save.
   */
  const handleSelectItems = async (ids: (string | number)[]) => {
    setSelectError(null);

    try {
      const { apiRequest } = await import("@buildpad/services");
      if (relationInfo?.relatedCollection?.collection) {
        const col = relationInfo.relatedCollection.collection;
        const qp = new URLSearchParams();
        qp.set("filter", JSON.stringify({ [pkField]: { _in: ids } }));
        if (resolvedFields.length > 0) qp.set("fields", resolvedFields.join(","));
        const resp = await apiRequest<{ data: O2MItem[] }>(
          `/api/items/${col}?${qp.toString()}`,
        );
        const fetched = resp.data || [];

        // Stage into `link`, not `update` — the item may not be in
        // `baseItems` yet (unsaved parent), and even when it is, `update`
        // is reserved for edits to items already linked to this parent.
        // `link` both renders the row and emits the FK on save (see the
        // emit effect above).
        setChangeset((prev) => {
          const existingLinkIds = new Set(prev.link.map((l) => l.id));
          const newLinks: StagedLink[] = fetched
            .filter((item) => !existingLinkIds.has(getPk(item)))
            .map((item) => {
              const { $type: _t, $index: _i, $edits: _e, ...rest } = item;
              return { ...rest, $type: "linked" as const, id: getPk(item) };
            });
          return {
            ...prev,
            link: [...prev.link, ...newLinks],
          };
        });
        closeSelectModal();
      }
    } catch (err) {
      console.error("Error staging items:", err);
      setSelectError(t.errors.selectFailed);
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

    // If it's a staged link (an existing item picked via "Add Existing"
    // that hasn't been saved yet — regardless of whether the parent itself
    // is saved, selection is always deferred now), just un-stage it —
    // nothing was ever linked server-side.
    if (changeset.link.some((l) => l.id === getPk(item))) {
      const pk = getPk(item);
      setChangeset((prev) => ({
        ...prev,
        link: prev.link.filter((l) => l.id !== pk),
        // Drop any edit staged against this row too — otherwise the removed
        // record is still emitted and the writer re-links it on save.
        update: prev.update.filter((u) => u.id !== pk),
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
        // The child is gone server-side, but a previously emitted payload
        // still carries its pk as a preserved entry — saving the parent
        // would re-link it (or reference a deleted row). Drop it from the
        // snapshot and re-emit the corrected payload.
        const removedPk = getPk(item);
        const cache = preservedIdsRef.current;
        if (cache && cache.key === primaryKey) {
          preservedIdsRef.current = {
            key: cache.key,
            ids: cache.ids.filter((id) => id !== removedPk),
          };
        }
        setPreserveEpoch((v) => v + 1);
      } catch (err) {
        console.error("Error removing item:", err);
      }
    } else {
      // Stage deletion in changeset
      const pk = getPk(item);
      setChangeset((prev) => ({
        ...prev,
        update: prev.update.filter((u) => u.id !== pk),
        delete: [...prev.delete, { $type: "deleted", id: pk }],
      }));
    }
  };

  /**
   * Batch remove selected items.
   */
  const handleBatchRemove = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const item = displayItems.find((i) => getPk(i) === id);
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
  // `displayItems` is padded with staged links and creates, but the movers
  // index `baseItems`. Resolve the row's index there and no-op for rows that
  // only exist locally, or the mover swaps in `undefined` and throws.
  const reorderIndexOf = (item: O2MItem) =>
    baseItems.findIndex((r) => getPk(r) === getPk(item));

  const handleMoveUp = async (item: O2MItem) => {
    const index = reorderIndexOf(item);
    if (index <= 0) return;
    try {
      await moveItemUp(index);
    } catch (err) {
      console.error("Error moving item up:", err);
    }
  };

  const handleMoveDown = async (item: O2MItem) => {
    const index = reorderIndexOf(item);
    if (index < 0 || index >= baseItems.length - 1) return;
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
          title={t.configError.title}
          color="red"
          data-testid="o2m-error"
        >
          <Text size="sm">{relationError}</Text>
          <Text size="xs" c="dimmed" mt="xs">
            {t.configError.storybookHint}
          </Text>
        </Alert>
      </Stack>
    );
  }

  if (!isDemoMode && !relationInfo && !relationLoading) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title={t.notConfigured.title}
        color="warning"
        data-testid="o2m-not-configured"
      >
        {t.notConfigured.message}
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
          color="warning"
          data-testid="o2m-singleton-warning"
        >
          {t.singletonWarning}
        </Alert>
      )}

      {/* Priority #4: Unique FK guard */}
      {hasExistingItem && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="info"
          data-testid="o2m-unique-fk-notice"
        >
          {t.uniqueConstraintNotice}
        </Alert>
      )}

      {/* Preserve-fetch failure: the staged change is rendered but was NOT
          handed to the parent form (emitting without the preserved id set
          would deselect every other child on save). */}
      {preserveError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          data-testid="o2m-preserve-error"
        >
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{preserveError}</Text>
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => setPreserveEpoch((v) => v + 1)}
              data-testid="o2m-preserve-retry"
            >
              {t.retry}
            </Button>
          </Group>
        </Alert>
      )}

      <Paper p="md" withBorder pos="relative">
        <LoadingOverlay visible={loading && displayItems.length > 0} />

        {/* Header Actions */}
        <Group justify="space-between" mb="md">
          <Group>
            {enableSearchFilter && layout === "table" && (
              <TextInput
                placeholder={t.searchPlaceholder}
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
                {formatCount(totalCount, t.itemCount)}
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
                {formatCount(
                  selectedIds.size,
                  effectiveRemoveAction === "delete" ? t.batchRemove.delete : t.batchRemove.unlink,
                )}
              </Button>
            )}

            {showSelectBtn && (
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={openSelectModal}
                data-testid="o2m-select-btn"
              >
                {t.addExisting}
              </Button>
            )}

            {showCreateBtn && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleCreateNew}
                data-testid="o2m-create-btn"
              >
                {t.createNew}
              </Button>
            )}
          </Group>
        </Group>

        {/* Content */}
        {displayItems.length === 0 && !loading ? (
          <Paper p="xl" style={{ textAlign: "center" }} data-testid="o2m-empty">
            <Text c="dimmed">{t.noItems}</Text>
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
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={() => {
                        if (allSelected) {
                          clearSelection();
                        } else {
                          // R6.1: individual row checkboxes key selectedIds by
                          // getPk(item) (the resolved real PK), not `.id` —
                          // for a related collection whose PK isn't literally
                          // "id", selecting via this header checkbox put
                          // `undefined` (or the wrong value) into the set for
                          // every row, so per-row checkboxes never matched
                          // and batch actions silently targeted nothing.
                          setSelectedIds(
                            new Set(displayItems.map((i) => getPk(i))),
                          );
                        }
                      }}
                      aria-label={t.selectAll}
                      data-testid="o2m-select-all"
                    />
                  </Table.Th>
                )}
                {canReorder && (
                  <Table.Th style={{ width: 50 }}>
                    <IconGripVertical size={14} style={{ opacity: 0.5 }} />
                  </Table.Th>
                )}
                {displayColumns.map((fieldName) => (
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
                <Table.Th style={{ width: 120 }}>{t.columns.actions}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {displayItems.map((item) => (
                <Table.Tr key={getPk(item)} data-testid={`o2m-row-${getPk(item)}`}>
                  {/* Batch checkbox */}
                  {!isDisabled && (
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        checked={selectedIds.has(getPk(item))}
                        onChange={() => toggleSelection(getPk(item))}
                        aria-label={interpolate(t.selectItem, { id: getPk(item) })}
                        data-testid={`o2m-check-${getPk(item)}`}
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
                          disabled={reorderIndexOf(item) <= 0}
                          onClick={() => handleMoveUp(item)}
                          data-testid={`o2m-move-up-${getPk(item)}`}
                        >
                          <IconChevronUp size={12} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          disabled={
                            reorderIndexOf(item) < 0 ||
                            reorderIndexOf(item) >= baseItems.length - 1
                          }
                          onClick={() => handleMoveDown(item)}
                          data-testid={`o2m-move-down-${getPk(item)}`}
                        >
                          <IconChevronDown size={12} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  )}
                  {displayColumns.map((fieldName) => {
                    const cellValue = getByPath(
                      item as Record<string, unknown>,
                      fieldName,
                    );
                    return (
                      <Table.Td key={fieldName}>
                        <Text size="sm">{String(cellValue ?? t.emptyCell)}</Text>
                      </Table.Td>
                    );
                  })}
                  <Table.Td>
                    <Group gap="xs">
                      {enableLink && (
                        <Tooltip label={t.actions.viewItem}>
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            data-testid={`o2m-link-${getPk(item)}`}
                            aria-label={t.actions.viewItem}
                          >
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}

                      {!isDisabled && updateAllowed && (
                        <Tooltip label={t.actions.edit}>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            data-testid={`o2m-edit-${getPk(item)}`}
                            aria-label={t.actions.editItem}
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
                                ? t.actions.delete
                                : t.actions.unlink
                            }
                          >
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="sm"
                              onClick={() => handleRemoveItem(item)}
                              data-testid={`o2m-remove-${getPk(item)}`}
                              aria-label={
                                effectiveRemoveAction === "delete"
                                  ? t.actions.deleteItem
                                  : t.actions.unlinkItem
                              }
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
            {displayItems.map((item) => (
              <Paper
                key={getPk(item)}
                p="sm"
                withBorder
                style={{
                  cursor: isDisabled || !updateAllowed ? "default" : "pointer",
                }}
                onClick={() =>
                  !isDisabled && updateAllowed && handleEditItem(item)
                }
                data-testid={`o2m-item-${getPk(item)}`}
              >
                <Group justify="space-between">
                  <Group>
                    {canReorder && (
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={reorderIndexOf(item) <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveUp(item);
                          }}
                          data-testid={`o2m-list-move-up-${getPk(item)}`}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={
                            reorderIndexOf(item) < 0 ||
                            reorderIndexOf(item) >= baseItems.length - 1
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveDown(item);
                          }}
                          data-testid={`o2m-list-move-down-${getPk(item)}`}
                        >
                          <IconChevronDown size={14} />
                        </ActionIcon>
                      </Group>
                    )}
                    <Text>{renderTemplate(displayTemplate, item)}</Text>
                  </Group>
                  <Group gap="xs">
                    {enableLink && (
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`o2m-list-link-${getPk(item)}`}
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
                          data-testid={`o2m-list-remove-${getPk(item)}`}
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
                {interpolate(t.showingRange, {
                  start: (currentPage - 1) * limit + 1,
                  end: Math.min(currentPage * limit, totalCount),
                  total: totalCount,
                })}
              </Text>
            </Group>

            <Group>
              <Text size="sm">{t.perPage}</Text>
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
          {typeof error === "string" ? error : t.invalidValue}
        </Text>
      )}

      {/* Edit Modal — Priority #3: exclude circular FK field */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={isCreatingNew ? t.editModal.createTitle : t.editModal.editTitle}
        size="lg"
      >
        {relationInfo && relationInfo.relatedCollection && (
          <CollectionForm
            collection={relationInfo.relatedCollection.collection}
            id={editingPk}
            // `mode` must follow the resolved id: CollectionForm gates its
            // edit path on `mode === "edit" && id`, so an "edit" modal with
            // no id silently routes Save into createOne.
            mode={isCreatingNew || editingPk === undefined ? "create" : "edit"}
            defaultValues={
              // Only pre-fill the reverse FK when the parent is actually saved
              // (primaryKey is a real id, not the "+" new-record placeholder).
              // For an unsaved parent, the link is established later by
              // staging into the changeset on save — pre-filling here would
              // send the literal "+" placeholder as the FK value on create.
              isCreatingNew && relationInfo.reverseJunctionField && isParentSaved
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
        title={t.selectModal.title}
        size="xl"
      >
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
                    label: t.selectModal.addSelected,
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
