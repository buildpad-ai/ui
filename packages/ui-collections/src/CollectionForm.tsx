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
import type { CollectionActionAccess } from "@buildpad/services";
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
          PermissionsService.getMyCollectionAccess().catch(() => ({})),
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
          // Exclude alias fields UNLESS they are group interfaces
          if (f.type === "alias") {
            const isGroup = f.meta?.special?.includes?.("group");
            const isPresentation =
              f.meta?.interface === "presentation-divider" ||
              f.meta?.interface === "presentation-notice";
            if (!isGroup && !isPresentation) {
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

      // Only send changed fields in edit mode (PATCH semantics)
      const itemsService = new ItemsService(collection);

      if (mode === "edit" && id) {
        const changedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(dataToSave)) {
          if (initialFormData[key] !== value) {
            changedData[key] = value;
          }
        }

        await itemsService.updateOne(id, changedData);

        setSuccess(true);
        setInitialFormData({ ...formData }); // Reset "hasEdits" baseline

        if (afterSave === "copy") {
          // Save as copy: create a new item with current data (without id)
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
        // Create mode
        const result = await itemsService.createOne(dataToSave);
        const newId = result?.id;
        setSuccess(true);

        if (afterSave === "add-new") {
          onSuccess?.({ ...dataToSave, id: newId });
          onNavigateToCreate?.();
          return;
        }

        onSuccess?.({ ...dataToSave, id: newId });
      }
    } catch (err) {
      console.error("Error saving item:", err);
      // Try to parse per-field validation errors
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
