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

"use client";

import {
  Alert,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { FieldsService, ItemsService, PermissionsService, apiRequest } from "@buildpad/services";
import type { CollectionActionAccess, CollectionAccess } from "@buildpad/services";
import type { Field } from "@buildpad/types";
import { VForm } from "@buildpad/ui-form";
import { IconAlertCircle, IconCheck, IconTrash, IconX } from "@tabler/icons-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SaveOptions, type SaveAction } from "./SaveOptions";

export interface CollectionFormProps {
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
export interface FormPermissionState {
  createAllowed: boolean;
  updateAllowed: boolean;
  deleteAllowed: boolean;
  saveAllowed: boolean;
  hasEdits: boolean;
  isSavable: boolean;
}

// System fields that should be auto-generated
const SYSTEM_FIELDS = [
  "id",
  "user_created",
  "user_updated",
  "date_created",
  "date_updated",
  "sort",
];

// Fields that are read-only by nature
const READ_ONLY_FIELDS = [
  "id",
  "user_created",
  "user_updated",
  "date_created",
  "date_updated",
];

// Stable empty references to prevent re-renders
const EMPTY_OBJECT: Record<string, unknown> = {};
const EMPTY_ARRAY: string[] = [];

/** Junction metadata resolved from /api/relations for a single M2M alias field */
interface M2MJunctionInfo {
  /** The junction/through collection (e.g. "tasks_tags") */
  junctionCollection: string;
  /** FK in junction pointing back to the parent (e.g. "tasks_id") */
  reverseJunctionField: string;
  /** FK in junction pointing to the related collection (e.g. "tags_id") */
  junctionField: string;
}

/** Narrow-check: is value a staged M2M changes object? */
function isM2MChangesItem(value: unknown): value is {
  create: Record<string, unknown>[];
  update: Record<string, unknown>[];
  delete: (string | number)[];
} {
  return !!(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "create" in (value as object) &&
    "update" in (value as object) &&
    "delete" in (value as object)
  );
}

/**
 * CollectionForm - Dynamic form for creating/editing collection items
 */
export const CollectionForm: React.FC<CollectionFormProps> = ({
  collection,
  id,
  mode = "create",
  defaultValues,
  onSuccess,
  onCancel,
  onNavigateToCreate,
  onDelete,
  excludeFields,
  includeFields,
  showSaveOptions = false,
  showDelete,
}) => {
  // Use stable references for optional props
  const stableDefaultValues = useMemo(
    () => defaultValues || EMPTY_OBJECT,
    [defaultValues],
  );
  const stableExcludeFields = useMemo(
    () => excludeFields || EMPTY_ARRAY,
    [excludeFields],
  );
  const stableIncludeFields = useMemo(() => includeFields, [includeFields]);

  const [fields, setFields] = useState<Field[]>([]);
  const [formData, setFormData] =
    useState<Record<string, unknown>>(stableDefaultValues);
  const [initialFormData, setInitialFormData] =
    useState<Record<string, unknown>>(stableDefaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ----- Permission state -----
  const [createAllowed, setCreateAllowed] = useState(true);
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [deleteAllowed, setDeleteAllowed] = useState(false);
  const [readableFieldNames, setReadableFieldNames] = useState<string[] | null>(null);
  const [writableFieldNames, setWritableFieldNames] = useState<string[] | null>(null);

  // ----- M2M junction map (fieldName → junction metadata) -----
  const [m2mJunctionMap, setM2mJunctionMap] = useState<Record<string, M2MJunctionInfo>>({});

  // ----- Delete state -----
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Track if data has been loaded to prevent re-fetching
  const dataLoadedRef = useRef(false);
  const lastLoadKey = useRef<string>("");

  // =========================================================================
  // Permission-aware field + item loading
  // =========================================================================
  useEffect(() => {
    const loadKey = `${collection}-${id}-${mode}`;
    if (dataLoadedRef.current && lastLoadKey.current === loadKey) {
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setFieldErrors({});

        // Fetch fields + permissions in parallel
        const fieldsService = new FieldsService();
        const [allFields, collectionAccess] = await Promise.all([
          fieldsService.readAll(collection),
          PermissionsService.getMyCollectionAccess().catch(() => ({} as CollectionAccess)),
        ]);

        const access = collectionAccess?.[collection] || {};
        const readAccess: CollectionActionAccess | undefined = access.read;
        const createAccess: CollectionActionAccess | undefined = access.create;
        const updateAccess: CollectionActionAccess | undefined = access.update;
        const deleteAccess: CollectionActionAccess | undefined = access.delete;

        // Determine create/update/delete allowed
        // Admin users get full access; empty map (failed fetch) also assumes full access
        const isAdmin = PermissionsService.isAdmin;
        const isEmptyAccess = Object.keys(collectionAccess || {}).length === 0;
        setCreateAllowed(isAdmin || isEmptyAccess || !!createAccess);
        setUpdateAllowed(isAdmin || isEmptyAccess || !!updateAccess);
        setDeleteAllowed(isAdmin || isEmptyAccess || !!deleteAccess);

        // Compute readable field names
        let readFields: string[] | null = null;
        if (!isAdmin && !isEmptyAccess && readAccess) {
          readFields = readAccess.fields || null; // null = wildcard
          if (readFields && readFields.includes("*")) readFields = null;
        }
        setReadableFieldNames(readFields);

        // Compute writable field names for the current action
        const actionAccess = mode === "create" ? createAccess : updateAccess;
        let writeFields: string[] | null = null;
        if (!isAdmin && !isEmptyAccess && actionAccess) {
          writeFields = actionAccess.fields || null;
          if (writeFields && writeFields.includes("*")) writeFields = null;
        }
        setWritableFieldNames(writeFields);

        // Filter fields based on read permissions, system fields, etc.
        let editableFields = allFields.filter((f) => {
          // Exclude system fields unless they're in defaultValues
          if (
            SYSTEM_FIELDS.includes(f.field) &&
            !stableDefaultValues[f.field]
          ) {
            return false;
          }
          // Exclude alias fields UNLESS they are group, presentation, or system interfaces
          if (f.type === "alias") {
            const isGroup = f.meta?.special?.includes?.("group");
            const isPresentation =
              f.meta?.interface === "presentation-divider" ||
              f.meta?.interface === "presentation-notice";
            const isRelationalAlias =
              f.meta?.special?.includes?.("o2m") ||
              f.meta?.special?.includes?.("m2m") ||
              f.meta?.special?.includes?.("m2a") ||
              f.meta?.special?.includes?.("files");
            if (!isGroup && !isPresentation && !isRelationalAlias) {
              return false;
            }
          }
          // Apply exclude list
          if (stableExcludeFields.includes(f.field)) {
            return false;
          }
          // Apply include list if provided
          if (stableIncludeFields && !stableIncludeFields.includes(f.field)) {
            return false;
          }
          return true;
        });

        // Apply read permission filter — only show fields the user can read
        if (readFields) {
          const readSet = new Set(readFields);
          editableFields = editableFields.filter(
            (f) => readSet.has(f.field) || f.type === "alias",
          );
        }

        // Mark non-writable fields as readonly
        if (writeFields) {
          const writeSet = new Set(writeFields);
          editableFields = editableFields.map((f) => {
            if (f.type === "alias") return f; // groups aren't data fields
            if (!writeSet.has(f.field)) {
              return {
                ...f,
                meta: { ...f.meta!, readonly: true },
              };
            }
            return f;
          });
        }

        setFields(editableFields);

        // Resolve junction metadata for M2M alias fields so handleSave can
        // flush creates/updates/deletes via the junction collection directly.
        const m2mAliasFields = editableFields.filter(
          (f) => f.type === "alias" && f.meta?.special?.includes?.("m2m"),
        );
        if (m2mAliasFields.length > 0) {
          try {
            const relationsResp = await apiRequest<{
              data: Array<{
                collection: string;
                field: string;
                related_collection: string | null;
                meta: {
                  one_field?: string | null;
                  one_collection?: string | null;
                  junction_field?: string | null;
                } | null;
              }>;
            }>("/api/relations");
            const relations = relationsResp.data ?? [];
            const junctionMap: Record<string, M2MJunctionInfo> = {};
            for (const m2mField of m2mAliasFields) {
              const rel = relations.find(
                (r) =>
                  r.meta?.junction_field &&
                  ((r.related_collection === collection &&
                    r.meta.one_field === m2mField.field) ||
                    (r.meta.one_collection === collection &&
                      r.meta.one_field === m2mField.field)),
              );
              if (rel?.meta?.junction_field) {
                junctionMap[m2mField.field] = {
                  junctionCollection: rel.collection,
                  reverseJunctionField: rel.field,
                  junctionField: rel.meta.junction_field,
                };
              }
            }
            setM2mJunctionMap(junctionMap);
          } catch {
            // Non-fatal: M2M save falls back to including in PATCH body
          }
        }

        // Build initial form data
        let initialData: Record<string, unknown> = { ...stableDefaultValues };

        // Apply permission presets as defaults on create
        if (mode === "create") {
          const presets = actionAccess?.presets;
          if (presets && typeof presets === "object") {
            initialData = { ...presets, ...initialData };
          }
        }

        // If editing, load the existing item
        if (mode === "edit" && id) {
          const itemsService = new ItemsService(collection);
          const item = await itemsService.readOne(id);
          initialData = { ...initialData, ...item };
        }

        setFormData(initialData);
        setInitialFormData(initialData);

        // Mark as loaded
        dataLoadedRef.current = true;
        lastLoadKey.current = loadKey;
      } catch (err) {
        console.error("Error loading form data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load form data",
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [
    collection,
    id,
    mode,
    stableDefaultValues,
    stableExcludeFields,
    stableIncludeFields,
  ]);

  // =========================================================================
  // Derived state: hasEdits, saveAllowed, isSavable
  // =========================================================================
  const hasEdits = useMemo(() => {
    // Compare current formData to initialFormData
    const keys = new Set([
      ...Object.keys(formData),
      ...Object.keys(initialFormData),
    ]);
    for (const key of keys) {
      if (READ_ONLY_FIELDS.includes(key)) continue;
      if (formData[key] !== initialFormData[key]) return true;
    }
    return false;
  }, [formData, initialFormData]);

  const saveAllowed = useMemo(() => {
    if (mode === "create") return createAllowed;
    return updateAllowed;
  }, [mode, createAllowed, updateAllowed]);

  const isSavable = useMemo(() => {
    return saveAllowed && (mode === "create" || hasEdits);
  }, [saveAllowed, mode, hasEdits]);

  // =========================================================================
  // Compute disabledOptions for SaveOptions
  // =========================================================================
  const disabledSaveOptions = useMemo<SaveAction[]>(() => {
    const disabled: SaveAction[] = [];
    if (!isSavable) {
      disabled.push("save-and-stay", "save-and-add-new", "save-as-copy");
    }
    if (mode === "create") {
      disabled.push("save-as-copy"); // Can't copy an item that doesn't exist yet
    }
    if (!hasEdits) {
      disabled.push("discard-and-stay");
    }
    return disabled;
  }, [isSavable, mode, hasEdits]);

  // Update form field - used by VForm's onUpdate callback
  const handleFormUpdate = useCallback((values: Record<string, unknown>) => {
    setFormData((prev) => ({
      ...prev,
      ...values,
    }));
    setSuccess(false);
    setFieldErrors({}); // Clear field errors when user edits
  }, []);

  // Compute primary key for VForm context
  const primaryKey = mode === "create" ? "+" : id;

  // =========================================================================
  // Parse DaaS validation errors into per-field errors
  // =========================================================================
  const parseValidationErrors = (err: unknown): Record<string, string> => {
    if (!err || typeof err !== "object") return {};
    const errObj = err as Record<string, unknown>;

    // DaaS returns: { errors: [{ message, extensions: { code, field } }] }
    if (Array.isArray(errObj.errors)) {
      const fieldErrs: Record<string, string> = {};
      for (const e of errObj.errors) {
        const field = e?.extensions?.field || e?.field;
        const message = e?.message || "Validation failed";
        if (field) {
          fieldErrs[String(field)] = String(message);
        }
      }
      return fieldErrs;
    }
    return {};
  };

  // =========================================================================
  // M2M flush helper — creates/updates/deletes junction records directly
  // instead of relying on DaaS to process nested M2M payloads in the parent
  // PATCH, which is not reliably supported.
  // =========================================================================
  const flushM2MChanges = async (
    parentId: string | number,
    m2mEntries: Array<{
      junctionInfo: M2MJunctionInfo;
      changes: {
        create: Record<string, unknown>[];
        update: Record<string, unknown>[];
        delete: (string | number)[];
      };
    }>,
  ) => {
    for (const { junctionInfo, changes } of m2mEntries) {
      const { junctionCollection, reverseJunctionField, junctionField } = junctionInfo;
      const junctionService = new ItemsService(junctionCollection);

      for (const entry of changes.create) {
        // selectItems stages entries as {[junctionField]: {id: "uuid"}} — a
        // nested object wrapping the related PK. Flatten it to the bare PK
        // before sending to the junction API; PostgreSQL can't parse the JSON
        // object as a uuid column value.
        // createItem entries have richer related data (e.g., {name: "..."}) and
        // are intentionally left as-is so DaaS deep-creates the related record.
        const relatedValue = entry[junctionField];
        const isSelectEntry =
          relatedValue &&
          typeof relatedValue === "object" &&
          !Array.isArray(relatedValue) &&
          Object.keys(relatedValue as object).length === 1 &&
          "id" in (relatedValue as object);

        const flatEntry = isSelectEntry
          ? { ...entry, [junctionField]: (relatedValue as Record<string, unknown>).id }
          : entry;

        await junctionService.createOne({
          [reverseJunctionField]: parentId,
          ...flatEntry,
        });
      }

      for (const entry of changes.update) {
        const junctionId = entry.id as string | number | undefined;
        if (junctionId != null) {
          await junctionService.updateOne(junctionId, entry);
        }
      }

      for (const junctionId of changes.delete) {
        await junctionService.deleteOne(junctionId);
      }
    }
  };

  // =========================================================================
  // Save handler
  // =========================================================================
  const handleSave = async (afterSave?: "stay" | "add-new" | "copy") => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    setFieldErrors({});

    try {
      // Remove read-only fields from data
      const dataToSave = { ...formData };
      READ_ONLY_FIELDS.forEach((f) => {
        if (!stableDefaultValues[f]) {
          delete dataToSave[f];
        }
      });

      const itemsService = new ItemsService(collection);

      // Helper: split dataToSave into scalar fields and M2M changes.
      // M2M changes ({create, update, delete}) are flushed via the junction
      // collection API rather than embedded in the parent PATCH body, because
      // DaaS does not reliably process nested M2M payloads.
      const splitData = (source: Record<string, unknown>) => {
        const scalar: Record<string, unknown> = {};
        const m2m: Array<{
          junctionInfo: M2MJunctionInfo;
          changes: {
            create: Record<string, unknown>[];
            update: Record<string, unknown>[];
            delete: (string | number)[];
          };
        }> = [];
        for (const [key, value] of Object.entries(source)) {
          const ji = m2mJunctionMap[key];
          if (ji && isM2MChangesItem(value)) {
            m2m.push({ junctionInfo: ji, changes: value });
          } else {
            scalar[key] = value;
          }
        }
        return { scalar, m2m };
      };

      if (mode === "edit" && id) {
        // Collect only changed fields, excluding self-persisting interfaces
        // (e.g. "files" manages its own junction table independently)
        const selfPersistingInterfaces = new Set(['files']);
        const allChanged: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dataToSave)) {
          if (initialFormData[key] === value) continue;
          const fieldDef = fields.find(f => f.field === key);
          if (fieldDef?.meta?.interface && selfPersistingInterfaces.has(fieldDef.meta.interface)) {
            continue;
          }
          allChanged[key] = value;
        }

        const { scalar: changedData, m2m: m2mEntries } = splitData(allChanged);

        // Skip the PATCH when nothing scalar changed — avoids an unnecessary
        // round-trip (the backend skips the DB write and returns 200, but
        // the network call still costs latency).
        if (Object.keys(changedData).length > 0) {
          await itemsService.updateOne(id, changedData);
        }

        // Flush M2M changes via junction collection APIs
        await flushM2MChanges(id, m2mEntries);

        // Clear M2M keys from form state so child interfaces (e.g. ListM2M)
        // receive value=undefined and reset their staged changes — prevents
        // stale "NEW" rows appearing alongside the just-fetched server records.
        const clearedFormData: Record<string, unknown> = { ...formData };
        for (const { junctionInfo: ji } of m2mEntries) {
          // find field name for this junction
          for (const [k, v] of Object.entries(m2mJunctionMap)) {
            if (v === ji) delete clearedFormData[k];
          }
        }

        setSuccess(true);
        setFormData(clearedFormData);
        setInitialFormData(clearedFormData); // Reset "hasEdits" baseline

        if (afterSave === "copy") {
          const copyData = { ...dataToSave };
          delete copyData.id;
          const copyResult = await itemsService.createOne(copyData);
          onSuccess?.({ ...copyData, id: copyResult?.id });
          return;
        }

        if (afterSave === "add-new") {
          onNavigateToCreate?.();
          return;
        }

        onSuccess?.({ ...dataToSave, id });
      } else {
        // Create mode: split out M2M before creating the parent record.
        // Also strip self-persisting interfaces (e.g. "files") that manage
        // their own junction table persistence.
        const selfPersistingInterfaces = new Set(['files']);
        const cleanedDataToSave: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dataToSave)) {
          const fieldDef = fields.find(f => f.field === key);
          if (fieldDef?.meta?.interface && selfPersistingInterfaces.has(fieldDef.meta.interface)) {
            continue;
          }
          cleanedDataToSave[key] = value;
        }
        const { scalar: scalarData, m2m: m2mEntries } = splitData(cleanedDataToSave);

        const result = await itemsService.createOne(scalarData);
        const newId = result?.id as string | number | undefined;

        // Flush M2M changes now that we have the parent PK
        if (newId != null && m2mEntries.length > 0) {
          await flushM2MChanges(newId, m2mEntries);
        }

        setSuccess(true);

        if (afterSave === "add-new") {
          onSuccess?.({ ...scalarData, id: newId });
          onNavigateToCreate?.();
          return;
        }

        onSuccess?.({ ...scalarData, id: newId });
      }
    } catch (err) {
      console.error("Error saving item:", err);
      const perFieldErrors = parseValidationErrors(err);
      if (Object.keys(perFieldErrors).length > 0) {
        setFieldErrors(perFieldErrors);
        setError("Validation failed. Please fix the highlighted fields.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save item");
      }
    } finally {
      setSaving(false);
    }
  };

  // Submit form (primary save)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave();
  };

  // Discard changes
  const handleDiscard = useCallback(() => {
    setFormData(initialFormData);
    setFieldErrors({});
    setSuccess(false);
    setError(null);
  }, [initialFormData]);

  // =========================================================================
  // Delete handler
  // =========================================================================
  const handleDelete = async () => {
    if (!id || mode !== "edit") return;

    setDeleting(true);
    setError(null);

    try {
      const itemsService = new ItemsService(collection);
      await itemsService.deleteOne(id);
      setDeleteConfirmOpen(false);
      onDelete?.();
    } catch (err) {
      console.error("Error deleting item:", err);
      setError(err instanceof Error ? err.message : "Failed to delete item");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  // Whether to show the delete button
  const canShowDelete =
    (showDelete ?? (mode === "edit" && !!id)) && deleteAllowed;

  if (loading) {
    return (
      <Paper p="md" pos="relative" mih={200}>
        <LoadingOverlay visible />
      </Paper>
    );
  }

  return (
    <Paper p="md" data-testid="collection-form">
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mb="md"
          data-testid="form-error"
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          icon={<IconCheck size={16} />}
          color="green"
          mb="md"
          data-testid="form-success"
        >
          {mode === "create"
            ? "Item created successfully!"
            : "Item updated successfully!"}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {fields.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {!saveAllowed
                ? `You don't have permission to ${mode} items in ${collection}`
                : `No editable fields found for ${collection}`}
            </Text>
          ) : (
            <>
              <VForm
                collection={collection}
                fields={fields}
                modelValue={formData}
                initialValues={defaultValues}
                onUpdate={handleFormUpdate}
                primaryKey={primaryKey}
                disabled={saving || !saveAllowed}
                loading={saving}
                showNoVisibleFields={false}
              />
              {/* Per-field validation errors */}
              {Object.keys(fieldErrors).length > 0 && (
                <Stack gap={4} data-testid="form-field-errors">
                  {Object.entries(fieldErrors).map(([field, msg]) => (
                    <Alert
                      key={field}
                      icon={<IconAlertCircle size={14} />}
                      color="red"
                      variant="light"
                      p="xs"
                    >
                      <Text size="sm">
                        <strong>{field}</strong>: {msg}
                      </Text>
                    </Alert>
                  ))}
                </Stack>
              )}
            </>
          )}

          <Group justify="flex-end" mt="md">
            {canShowDelete && (
              <Button
                variant="subtle"
                color="red"
                onClick={() => setDeleteConfirmOpen(true)}
                leftSection={<IconTrash size={16} />}
                disabled={saving || deleting}
                data-testid="form-delete-btn"
                style={{ marginRight: "auto" }}
              >
                Delete
              </Button>
            )}
            {onCancel && (
              <Button
                variant="subtle"
                onClick={onCancel}
                leftSection={<IconX size={16} />}
                disabled={saving}
                data-testid="form-cancel-btn"
              >
                Cancel
              </Button>
            )}
            <Group gap={0}>
              <Button
                type="submit"
                loading={saving}
                disabled={!isSavable || fields.length === 0}
                leftSection={<IconCheck size={16} />}
                data-testid="form-submit-btn"
                style={showSaveOptions ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : undefined}
              >
                {mode === "create" ? "Create" : "Save"}
              </Button>
              {showSaveOptions && (
                <SaveOptions
                  disabledOptions={disabledSaveOptions}
                  disabled={saving}
                  onSaveAndStay={() => handleSave("stay")}
                  onSaveAndAddNew={() => handleSave("add-new")}
                  onSaveAsCopy={() => handleSave("copy")}
                  onDiscardAndStay={handleDiscard}
                />
              )}
            </Group>
          </Group>
        </Stack>
      </form>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Delete"
        centered
        size="sm"
        data-testid="delete-confirm-modal"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete this item? This action cannot be
            undone.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleDelete}
              loading={deleting}
              data-testid="delete-confirm-btn"
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
};

export default CollectionForm;
