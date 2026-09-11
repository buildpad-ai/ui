// src/CollectionForm.tsx
import {
  Alert,
  Button,
  Group as Group2,
  LoadingOverlay,
  Modal,
  Paper,
  Stack,
  Text
} from "@mantine/core";
import {
  FieldsService,
  ItemsService,
  PermissionsService,
  apiRequest,
  useBuildpadTranslations as useBuildpadTranslations2
} from "@buildpad/services";
import {
  buildFieldsFromDefinition,
  getDefaultValuesFromFields,
  interpolate as interpolate2,
  isConcealedValue
} from "@buildpad/utils";
import { VForm } from "@buildpad/ui-form";
import { IconAlertCircle, IconCheck as IconCheck2, IconTrash, IconX } from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

// src/SaveOptions.tsx
import {
  Menu,
  ActionIcon,
  Kbd,
  Group
} from "@mantine/core";
import {
  IconPlus,
  IconCopy,
  IconArrowBack,
  IconChevronDown,
  IconDeviceFloppy
} from "@tabler/icons-react";
import { useBuildpadTranslations } from "@buildpad/services";
import { jsx, jsxs } from "react/jsx-runtime";
var SaveOptions = ({
  disabledOptions = [],
  onSaveAndStay,
  onSaveAndAddNew,
  onSaveAsCopy,
  onDiscardAndStay,
  disabled = false,
  platform,
  translations
}) => {
  const t = useBuildpadTranslations((d) => d.collections.saveOptions, translations?.saveOptions);
  const isMac = platform ? platform === "mac" : typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const metaKey = isMac ? "\u2318" : t.kbd.ctrl;
  const isDisabled = (action) => disabledOptions.includes(action);
  return /* @__PURE__ */ jsxs(Menu, { shadow: "md", width: 280, position: "bottom-end", withArrow: true, children: [
    /* @__PURE__ */ jsx(Menu.Target, { children: /* @__PURE__ */ jsx(
      ActionIcon,
      {
        variant: "filled",
        size: "input-sm",
        disabled,
        "aria-label": t.moreOptions,
        style: {
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          marginLeft: -1
        },
        children: /* @__PURE__ */ jsx(IconChevronDown, { size: 14 })
      }
    ) }),
    /* @__PURE__ */ jsxs(Menu.Dropdown, { children: [
      /* @__PURE__ */ jsx(
        Menu.Item,
        {
          leftSection: /* @__PURE__ */ jsx(IconDeviceFloppy, { size: 16 }),
          disabled: isDisabled("save-and-stay"),
          onClick: onSaveAndStay,
          rightSection: /* @__PURE__ */ jsxs(Group, { gap: 2, children: [
            /* @__PURE__ */ jsx(Kbd, { size: "xs", children: metaKey }),
            /* @__PURE__ */ jsx(Kbd, { size: "xs", children: "S" })
          ] }),
          children: t.saveAndStay
        }
      ),
      /* @__PURE__ */ jsx(
        Menu.Item,
        {
          leftSection: /* @__PURE__ */ jsx(IconPlus, { size: 16 }),
          disabled: isDisabled("save-and-add-new"),
          onClick: onSaveAndAddNew,
          rightSection: /* @__PURE__ */ jsxs(Group, { gap: 2, children: [
            /* @__PURE__ */ jsx(Kbd, { size: "xs", children: metaKey }),
            /* @__PURE__ */ jsx(Kbd, { size: "xs", children: "\u21E7" }),
            /* @__PURE__ */ jsx(Kbd, { size: "xs", children: "S" })
          ] }),
          children: t.saveAndCreateNew
        }
      ),
      /* @__PURE__ */ jsx(
        Menu.Item,
        {
          leftSection: /* @__PURE__ */ jsx(IconCopy, { size: 16 }),
          disabled: isDisabled("save-as-copy"),
          onClick: onSaveAsCopy,
          children: t.saveAsCopy
        }
      ),
      /* @__PURE__ */ jsx(Menu.Divider, {}),
      /* @__PURE__ */ jsx(
        Menu.Item,
        {
          leftSection: /* @__PURE__ */ jsx(IconArrowBack, { size: 16 }),
          disabled: isDisabled("discard-and-stay"),
          onClick: onDiscardAndStay,
          color: "red",
          children: t.discardChanges
        }
      )
    ] })
  ] });
};

// src/extras-storage.ts
import { defaultTranslations, interpolate } from "@buildpad/utils";
var EXTRAS_COLUMN = "extras";
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function flattenExtras(values, extrasColumn = EXTRAS_COLUMN) {
  const raw = values[extrasColumn];
  if (isPlainObject(raw)) {
    return { ...values, ...raw };
  }
  return { ...values };
}
function extractExtras(values, extrasFieldNames, extrasColumn = EXTRAS_COLUMN) {
  const rest = {};
  const extras = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === extrasColumn) continue;
    if (extrasFieldNames.has(key)) {
      extras[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { rest, extras };
}
function mergeExtras(prev, changed) {
  const base = isPlainObject(prev) ? prev : {};
  return { ...base, ...changed };
}
function missingExtrasColumnMessage(collection, template = defaultTranslations.collections.form.errors.missingExtrasColumn) {
  return interpolate(template, { collection, extrasColumn: EXTRAS_COLUMN });
}

// src/CollectionForm.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var SYSTEM_FIELDS = /* @__PURE__ */ new Set([
  "id",
  "user_created",
  "user_updated",
  "date_created",
  "date_updated",
  "sort"
]);
var NON_FLAT_RELATIONAL_SPECIALS = /* @__PURE__ */ new Set(["m2a", "m2m", "o2m"]);
var NON_FLAT_RELATIONAL_INTERFACES = /* @__PURE__ */ new Set([
  "list-m2a",
  "list-m2m",
  "list-o2m"
]);
var READ_ONLY_FIELDS = /* @__PURE__ */ new Set([
  "id",
  "user_created",
  "user_updated",
  "date_created",
  "date_updated"
]);
var EMPTY_OBJECT = {};
var EMPTY_ARRAY = [];
function isM2MChangesItem(value) {
  return !!(value && typeof value === "object" && !Array.isArray(value) && "create" in value && "update" in value && "delete" in value);
}
var CollectionForm = ({
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
  definition,
  persist = true,
  translations
}) => {
  const t = useBuildpadTranslations2((d) => d.collections, translations);
  const definitionSignature = useMemo(
    () => definition ? JSON.stringify(definition) : "",
    [definition]
  );
  const stableDefaultValues = useMemo(
    () => defaultValues || EMPTY_OBJECT,
    [defaultValues]
  );
  const stableExcludeFields = useMemo(
    () => excludeFields || EMPTY_ARRAY,
    [excludeFields]
  );
  const stableIncludeFields = useMemo(() => includeFields, [includeFields]);
  const [fields, setFields] = useState([]);
  const [resolvedPk, setResolvedPk] = useState("id");
  const [manualPrimaryKeyField, setManualPrimaryKeyField] = useState(null);
  const [formData, setFormData] = useState(stableDefaultValues);
  const [initialFormData, setInitialFormData] = useState(stableDefaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createAllowed, setCreateAllowed] = useState(true);
  const [updateAllowed, setUpdateAllowed] = useState(true);
  const [deleteAllowed, setDeleteAllowed] = useState(false);
  const [hasExtrasColumn, setHasExtrasColumn] = useState(true);
  const [m2mJunctionMap, setM2mJunctionMap] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const dataLoadedRef = useRef(false);
  const lastLoadKey = useRef("");
  useEffect(() => {
    const loadKey = `${collection}-${id}-${mode}-${definitionSignature}`;
    if (dataLoadedRef.current && lastLoadKey.current === loadKey) {
      return;
    }
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setFieldErrors({});
        const fieldsService = new FieldsService();
        const [allFields, collectionAccess] = await Promise.all([
          fieldsService.readAll(collection),
          PermissionsService.getMyCollectionAccess().catch(() => ({}))
        ]);
        setHasExtrasColumn(allFields.some((f) => f.field === EXTRAS_COLUMN));
        const pkField = allFields.find((f) => f.schema?.is_primary_key);
        const schemaPk = pkField?.field;
        setResolvedPk(schemaPk ?? "id");
        const isPkAutoGenerated = !!pkField && // integer/bigint identity or serial column
        (pkField.schema?.has_auto_increment === true || // uuid PK — DaaS marks generated ones special:["uuid"], but the
        // baseline collection template sets only type:"uuid"
        pkField.type === "uuid" || pkField.meta?.special?.includes("uuid") === true || // DB-side default (gen_random_uuid(), nextval(...)): the column
        // fills itself, and these report has_auto_increment:false
        pkField.schema?.default_value != null || // explicitly not user-writable, so it cannot be user-supplied
        pkField.meta?.readonly === true);
        setManualPrimaryKeyField(
          schemaPk && !isPkAutoGenerated ? schemaPk : null
        );
        const access = collectionAccess?.[collection] || {};
        const readAccess = access.read;
        const createAccess = access.create;
        const updateAccess = access.update;
        const deleteAccess = access.delete;
        const isAdmin = PermissionsService.isAdmin;
        const isEmptyAccess = Object.keys(collectionAccess || {}).length === 0;
        setCreateAllowed(isAdmin || isEmptyAccess || !!createAccess);
        setUpdateAllowed(isAdmin || isEmptyAccess || !!updateAccess);
        setDeleteAllowed(isAdmin || isEmptyAccess || !!deleteAccess);
        let readFields = null;
        if (!isAdmin && !isEmptyAccess && readAccess) {
          readFields = readAccess.fields || null;
          if (readFields && readFields.includes("*")) readFields = null;
        }
        const actionAccess = mode === "create" ? createAccess : updateAccess;
        let writeFields = null;
        if (!isAdmin && !isEmptyAccess && actionAccess) {
          writeFields = actionAccess.fields || null;
          if (writeFields && writeFields.includes("*")) writeFields = null;
        }
        let editableFields = allFields.filter((f) => {
          if (SYSTEM_FIELDS.has(f.field) && (f.field !== schemaPk || isPkAutoGenerated) && !stableDefaultValues[f.field]) {
            return false;
          }
          if (f.type === "alias") {
            const isGroup = f.meta?.special?.includes?.("group");
            const isPresentation = f.meta?.interface === "presentation-divider" || f.meta?.interface === "presentation-notice";
            const isRelationalAlias = f.meta?.special?.includes?.("o2m") || f.meta?.special?.includes?.("m2m") || f.meta?.special?.includes?.("m2a") || f.meta?.special?.includes?.("files");
            if (!isGroup && !isPresentation && !isRelationalAlias) {
              return false;
            }
          }
          if (stableExcludeFields.includes(f.field)) {
            return false;
          }
          if (stableIncludeFields && !stableIncludeFields.includes(f.field)) {
            return false;
          }
          return true;
        });
        if (readFields) {
          const readSet = new Set(readFields);
          editableFields = editableFields.filter(
            (f) => readSet.has(f.field) || f.type === "alias"
          );
        }
        if (writeFields) {
          const writeSet = new Set(writeFields);
          editableFields = editableFields.map((f) => {
            if (f.type === "alias") return f;
            if (!writeSet.has(f.field)) {
              return {
                ...f,
                meta: { ...f.meta, readonly: true }
              };
            }
            return f;
          });
        }
        if (definition) {
          editableFields = buildFieldsFromDefinition(editableFields, definition);
        }
        setFields(editableFields);
        const m2mAliasFields = editableFields.filter(
          (f) => f.type === "alias" && f.meta?.special?.includes?.("m2m")
        );
        if (m2mAliasFields.length > 0) {
          try {
            const relationsResp = await apiRequest("/api/relations");
            const relations = relationsResp.data ?? [];
            const junctionMap = {};
            for (const m2mField of m2mAliasFields) {
              const rel = relations.find(
                (r) => r.meta?.junction_field && (r.related_collection === collection && r.meta.one_field === m2mField.field || r.meta.one_collection === collection && r.meta.one_field === m2mField.field)
              );
              if (rel?.meta?.junction_field) {
                junctionMap[m2mField.field] = {
                  junctionCollection: rel.collection,
                  reverseJunctionField: rel.field,
                  junctionField: rel.meta.junction_field,
                  // Resolved below from the junction collection's own fields.
                  junctionPrimaryKeyField: "id"
                };
              }
            }
            await Promise.all(
              Object.values(junctionMap).map(async (info) => {
                try {
                  const fieldsResp = await apiRequest(`/api/fields/${info.junctionCollection}`);
                  const pk = (fieldsResp.data ?? []).find((f) => f.schema?.is_primary_key);
                  if (pk?.field) info.junctionPrimaryKeyField = pk.field;
                } catch {
                }
              })
            );
            setM2mJunctionMap(junctionMap);
          } catch {
          }
        }
        let initialData = { ...stableDefaultValues };
        if (mode === "create") {
          const seedableFields = editableFields.filter(
            (f) => f.meta?.readonly !== true && f.meta?.hidden !== true && (!writeFields || writeFields.includes(f.field))
          );
          const schemaDefaults = getDefaultValuesFromFields(seedableFields);
          const presets = actionAccess?.presets;
          if (presets && typeof presets === "object") {
            initialData = { ...presets, ...initialData };
          }
          initialData = { ...schemaDefaults, ...initialData };
        }
        if (mode === "edit" && id) {
          const itemsService = new ItemsService(collection);
          const fetchableFields = editableFields.filter((f) => {
            const special = f.meta?.special ?? [];
            const isNonFlatRelational = special.some((s) => NON_FLAT_RELATIONAL_SPECIALS.has(s)) || !!f.meta?.interface && NON_FLAT_RELATIONAL_INTERFACES.has(f.meta.interface);
            return !isNonFlatRelational;
          }).map((f) => f.field);
          const resolvedPkField = schemaPk ?? "id";
          if (!fetchableFields.includes(resolvedPkField)) {
            fetchableFields.unshift(resolvedPkField);
          }
          const item = await itemsService.readOne(id, fetchableFields);
          initialData = { ...initialData, ...item };
        }
        initialData = flattenExtras(initialData, EXTRAS_COLUMN);
        setFormData(initialData);
        setInitialFormData(initialData);
        dataLoadedRef.current = true;
        lastLoadKey.current = loadKey;
      } catch (err) {
        console.error("Error loading form data:", err);
        setError(err instanceof Error ? err.message : t.form.errors.loadFailed);
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
    definition,
    definitionSignature,
    t
  ]);
  const hasEdits = useMemo(() => {
    const keys = /* @__PURE__ */ new Set([
      ...Object.keys(formData),
      ...Object.keys(initialFormData)
    ]);
    for (const key of keys) {
      if (READ_ONLY_FIELDS.has(key) && key !== manualPrimaryKeyField) continue;
      if (formData[key] !== initialFormData[key]) return true;
    }
    return false;
  }, [formData, initialFormData, manualPrimaryKeyField]);
  const saveAllowed = useMemo(() => {
    if (mode === "create") return createAllowed;
    return updateAllowed;
  }, [mode, createAllowed, updateAllowed]);
  const isSavable = useMemo(() => {
    return saveAllowed && (mode === "create" || hasEdits);
  }, [saveAllowed, mode, hasEdits]);
  const extrasFieldNames = useMemo(
    () => new Set(
      fields.filter((f) => f.meta?.store === "extras").map((f) => f.field)
    ),
    [fields]
  );
  const disabledSaveOptions = useMemo(() => {
    const disabled = [];
    if (!isSavable) {
      disabled.push("save-and-stay", "save-and-add-new", "save-as-copy");
    }
    if (mode === "create") {
      disabled.push("save-as-copy");
    }
    if (!hasEdits) {
      disabled.push("discard-and-stay");
    }
    return disabled;
  }, [isSavable, mode, hasEdits]);
  const handleFormUpdate = useCallback((values) => {
    setFormData(values);
    setSuccess(false);
    setFieldErrors({});
  }, []);
  const primaryKey = mode === "create" ? "+" : id;
  const parseValidationErrors = (err) => {
    if (!err || typeof err !== "object") return {};
    const errObj = err;
    if (Array.isArray(errObj.errors)) {
      const fieldErrs = {};
      for (const e of errObj.errors) {
        const field = e?.extensions?.field || e?.field;
        const message = e?.message || t.form.errors.fieldValidationFallback;
        if (field) {
          fieldErrs[String(field)] = String(message);
        }
      }
      return fieldErrs;
    }
    return {};
  };
  const flushM2MChanges = async (parentId, m2mEntries) => {
    for (const { junctionInfo, changes } of m2mEntries) {
      const { junctionCollection, reverseJunctionField, junctionField, junctionPrimaryKeyField } = junctionInfo;
      const junctionService = new ItemsService(junctionCollection);
      for (const entry of changes.create) {
        const relatedValue = entry[junctionField];
        const isSelectEntry = relatedValue && typeof relatedValue === "object" && !Array.isArray(relatedValue) && Object.keys(relatedValue).length === 1 && "id" in relatedValue;
        const flatEntry = isSelectEntry ? { ...entry, [junctionField]: relatedValue.id } : entry;
        await junctionService.createOne({
          [reverseJunctionField]: parentId,
          ...flatEntry
        });
      }
      for (const entry of changes.update) {
        const junctionId = entry[junctionPrimaryKeyField];
        if (junctionId == null) {
          throw new Error(
            interpolate2(t.form.errors.junctionUpdateMissingKey, {
              junctionCollection,
              junctionPrimaryKeyField
            })
          );
        }
        await junctionService.updateOne(junctionId, entry);
      }
      for (const junctionId of changes.delete) {
        await junctionService.deleteOne(junctionId);
      }
    }
  };
  const handleSave = async (afterSave) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    if (!persist) {
      setSuccess(true);
      setSaving(false);
      return;
    }
    try {
      const dataToSave = { ...formData };
      READ_ONLY_FIELDS.forEach((f) => {
        if (f === manualPrimaryKeyField) return;
        if (!stableDefaultValues[f]) {
          delete dataToSave[f];
        }
      });
      const itemsService = new ItemsService(collection);
      const splitData = (source) => {
        const { rest, extras } = extractExtras(
          source,
          extrasFieldNames,
          EXTRAS_COLUMN
        );
        const scalar = {};
        const m2m = [];
        for (const [key, value] of Object.entries(rest)) {
          const ji = m2mJunctionMap[key];
          if (ji && isM2MChangesItem(value)) {
            m2m.push({ junctionInfo: ji, changes: value });
          } else {
            scalar[key] = value;
          }
        }
        return { scalar, m2m, extras };
      };
      if (mode === "edit" && id) {
        const selfPersistingInterfaces = /* @__PURE__ */ new Set(["files"]);
        const allChanged = {};
        for (const [key, value] of Object.entries(dataToSave)) {
          if (initialFormData[key] === value) continue;
          const fieldDef = fields.find((f) => f.field === key);
          if (fieldDef?.meta?.interface && selfPersistingInterfaces.has(fieldDef.meta.interface)) {
            continue;
          }
          allChanged[key] = value;
        }
        const {
          scalar: changedData,
          m2m: m2mEntries,
          extras: changedExtras
        } = splitData(allChanged);
        if (Object.keys(changedExtras).length > 0) {
          if (!hasExtrasColumn) {
            throw new Error(
              missingExtrasColumnMessage(collection, t.form.errors.missingExtrasColumn)
            );
          }
          changedData[EXTRAS_COLUMN] = mergeExtras(
            initialFormData[EXTRAS_COLUMN],
            changedExtras
          );
        }
        if (Object.keys(changedData).length > 0) {
          await itemsService.updateOne(id, changedData);
        }
        await flushM2MChanges(id, m2mEntries);
        const clearedFormData = { ...formData };
        for (const { junctionInfo: ji } of m2mEntries) {
          for (const [k, v] of Object.entries(m2mJunctionMap)) {
            if (v === ji) delete clearedFormData[k];
          }
        }
        if (changedData[EXTRAS_COLUMN] !== void 0) {
          clearedFormData[EXTRAS_COLUMN] = changedData[EXTRAS_COLUMN];
        }
        setSuccess(true);
        setFormData(clearedFormData);
        setInitialFormData(clearedFormData);
        if (afterSave === "copy") {
          const copyData = { ...dataToSave };
          delete copyData[resolvedPk];
          for (const [key, val] of Object.entries(copyData)) {
            if (isConcealedValue(val)) delete copyData[key];
          }
          const copyResult = await itemsService.createOne(copyData);
          onSuccess?.({ ...copyData, id: copyResult?.[resolvedPk] });
          return;
        }
        if (afterSave === "add-new") {
          onNavigateToCreate?.();
          return;
        }
        onSuccess?.({ ...dataToSave, id });
      } else {
        const selfPersistingInterfaces = /* @__PURE__ */ new Set(["files"]);
        const cleanedDataToSave = {};
        for (const [key, value] of Object.entries(dataToSave)) {
          const fieldDef = fields.find((f) => f.field === key);
          if (fieldDef?.meta?.interface && selfPersistingInterfaces.has(fieldDef.meta.interface)) {
            continue;
          }
          cleanedDataToSave[key] = value;
        }
        const {
          scalar: scalarData,
          m2m: m2mEntries,
          extras: createdExtras
        } = splitData(cleanedDataToSave);
        if (Object.keys(createdExtras).length > 0) {
          if (!hasExtrasColumn) {
            throw new Error(
              missingExtrasColumnMessage(collection, t.form.errors.missingExtrasColumn)
            );
          }
          scalarData[EXTRAS_COLUMN] = createdExtras;
        }
        const result = await itemsService.createOne(scalarData);
        const newId = result?.[resolvedPk];
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
        setError(t.form.errors.validationFailed);
      } else {
        setError(err instanceof Error ? err.message : t.form.errors.saveFailed);
      }
    } finally {
      setSaving(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleSave();
  };
  const handleDiscard = useCallback(() => {
    setFormData(initialFormData);
    setFieldErrors({});
    setSuccess(false);
    setError(null);
  }, [initialFormData]);
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
      setError(err instanceof Error ? err.message : t.form.errors.deleteFailed);
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };
  const canShowDelete = (showDelete ?? (mode === "edit" && !!id)) && deleteAllowed;
  if (loading) {
    return /* @__PURE__ */ jsx2(Paper, { p: "md", pos: "relative", mih: 200, children: /* @__PURE__ */ jsx2(LoadingOverlay, { visible: true }) });
  }
  return /* @__PURE__ */ jsxs2(Paper, { p: "md", "data-testid": "collection-form", children: [
    error && /* @__PURE__ */ jsx2(
      Alert,
      {
        icon: /* @__PURE__ */ jsx2(IconAlertCircle, { size: 16 }),
        color: "red",
        mb: "md",
        "data-testid": "form-error",
        children: error
      }
    ),
    success && /* @__PURE__ */ jsx2(
      Alert,
      {
        icon: /* @__PURE__ */ jsx2(IconCheck2, { size: 16 }),
        color: "green",
        mb: "md",
        "data-testid": "form-success",
        children: !persist ? t.form.success.previewOnly : mode === "create" ? t.form.success.created : t.form.success.updated
      }
    ),
    /* @__PURE__ */ jsx2("form", { onSubmit: handleSubmit, children: /* @__PURE__ */ jsxs2(Stack, { gap: "md", children: [
      fields.length === 0 ? /* @__PURE__ */ jsx2(Text, { c: "dimmed", ta: "center", py: "xl", children: !saveAllowed ? interpolate2(
        mode === "create" ? t.form.emptyState.noPermissionCreate : t.form.emptyState.noPermissionEdit,
        { collection }
      ) : interpolate2(t.form.emptyState.noEditableFields, { collection }) }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx2(
          VForm,
          {
            collection,
            fields,
            modelValue: formData,
            initialValues: initialFormData,
            onUpdate: handleFormUpdate,
            primaryKey,
            disabled: saving || !saveAllowed,
            showNoVisibleFields: false
          }
        ),
        Object.keys(fieldErrors).length > 0 && /* @__PURE__ */ jsx2(Stack, { gap: 4, "data-testid": "form-field-errors", children: Object.entries(fieldErrors).map(([field, msg]) => /* @__PURE__ */ jsx2(
          Alert,
          {
            icon: /* @__PURE__ */ jsx2(IconAlertCircle, { size: 14 }),
            color: "red",
            variant: "light",
            p: "xs",
            children: /* @__PURE__ */ jsxs2(Text, { size: "sm", children: [
              /* @__PURE__ */ jsx2("strong", { children: field }),
              ": ",
              msg
            ] })
          },
          field
        )) })
      ] }),
      /* @__PURE__ */ jsxs2(Group2, { justify: "flex-end", mt: "md", children: [
        canShowDelete && /* @__PURE__ */ jsx2(
          Button,
          {
            variant: "subtle",
            color: "red",
            onClick: () => setDeleteConfirmOpen(true),
            leftSection: /* @__PURE__ */ jsx2(IconTrash, { size: 16 }),
            disabled: saving || deleting,
            "data-testid": "form-delete-btn",
            style: { marginRight: "auto" },
            children: t.form.actions.delete
          }
        ),
        onCancel && /* @__PURE__ */ jsx2(
          Button,
          {
            variant: "subtle",
            onClick: onCancel,
            leftSection: /* @__PURE__ */ jsx2(IconX, { size: 16 }),
            disabled: saving,
            "data-testid": "form-cancel-btn",
            children: t.form.actions.cancel
          }
        ),
        /* @__PURE__ */ jsxs2(Group2, { gap: 0, style: { gap: 0 }, children: [
          /* @__PURE__ */ jsx2(
            Button,
            {
              type: "submit",
              loading: saving,
              disabled: !isSavable || fields.length === 0,
              leftSection: /* @__PURE__ */ jsx2(IconCheck2, { size: 16 }),
              "data-testid": "form-submit-btn",
              style: showSaveOptions ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : void 0,
              children: mode === "create" ? t.form.actions.create : t.form.actions.save
            }
          ),
          showSaveOptions && /* @__PURE__ */ jsx2(
            SaveOptions,
            {
              disabledOptions: disabledSaveOptions,
              disabled: saving,
              onSaveAndStay: () => handleSave("stay"),
              onSaveAndAddNew: () => handleSave("add-new"),
              onSaveAsCopy: () => handleSave("copy"),
              onDiscardAndStay: handleDiscard,
              translations
            }
          )
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx2(
      Modal,
      {
        opened: deleteConfirmOpen,
        onClose: () => setDeleteConfirmOpen(false),
        title: t.form.deleteConfirm.title,
        centered: true,
        size: "sm",
        "data-testid": "delete-confirm-modal",
        children: /* @__PURE__ */ jsxs2(Stack, { gap: "md", children: [
          /* @__PURE__ */ jsx2(Text, { size: "sm", children: t.form.deleteConfirm.message }),
          /* @__PURE__ */ jsxs2(Group2, { justify: "flex-end", children: [
            /* @__PURE__ */ jsx2(
              Button,
              {
                variant: "default",
                onClick: () => setDeleteConfirmOpen(false),
                disabled: deleting,
                children: t.form.deleteConfirm.cancel
              }
            ),
            /* @__PURE__ */ jsx2(
              Button,
              {
                color: "red",
                onClick: handleDelete,
                loading: deleting,
                "data-testid": "delete-confirm-btn",
                children: t.form.deleteConfirm.confirm
              }
            )
          ] })
        ] })
      }
    )
  ] });
};

// src/CollectionList.tsx
import {
  ActionIcon as ActionIcon5,
  Alert as Alert2,
  Badge as Badge4,
  Button as Button6,
  Collapse,
  Group as Group8,
  Menu as Menu3,
  Stack as Stack4,
  Text as Text5,
  Tooltip as Tooltip3
} from "@mantine/core";
import {
  FieldsService as FieldsService2,
  ItemsService as ItemsService2,
  PermissionsService as PermissionsService2,
  apiRequest as apiRequest2,
  useBuildpadI18n as useBuildpadI18n4,
  useBuildpadTranslations as useBuildpadTranslations8
} from "@buildpad/services";
import {
  interfaceRequiresChoices,
  interpolate as interpolate3,
  parseChoiceValues,
  resolveChoiceLabel
} from "@buildpad/utils";
import { VTable } from "@buildpad/ui-table";
import {
  IconAlertCircle as IconAlertCircle2,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconCheck as IconCheck3,
  IconEyeOff,
  IconFilterOff,
  IconPlus as IconPlus5,
  IconSortAscending,
  IconSortDescending,
  IconX as IconX5
} from "@tabler/icons-react";
import { useCallback as useCallback3, useEffect as useEffect2, useMemo as useMemo3, useRef as useRef2, useState as useState3 } from "react";

// src/CollectionListFooter.tsx
import {
  Group as Group3,
  Pagination,
  Select,
  Text as Text2
} from "@mantine/core";
import { useBuildpadTranslations as useBuildpadTranslations3 } from "@buildpad/services";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var CollectionListFooter = ({
  itemCountDisplay,
  limit,
  onLimitChange,
  page,
  onPageChange,
  totalPages,
  translations
}) => {
  const t = useBuildpadTranslations3((d) => d.collections, translations);
  return /* @__PURE__ */ jsxs3("div", { className: "collection-list-footer", "data-testid": "collection-list-footer", children: [
    /* @__PURE__ */ jsx3(Text2, { size: "sm", c: "dimmed", "data-testid": "collection-list-footer-count", children: itemCountDisplay }),
    /* @__PURE__ */ jsxs3(Group3, { gap: "sm", children: [
      /* @__PURE__ */ jsxs3(Group3, { gap: 4, children: [
        /* @__PURE__ */ jsx3(Text2, { size: "xs", c: "dimmed", children: t.listFooter.perPage }),
        /* @__PURE__ */ jsx3(
          Select,
          {
            value: String(limit),
            onChange: (value) => {
              if (value) {
                onLimitChange(Number(value));
              }
            },
            data: ["10", "25", "50", "100"],
            size: "xs",
            className: "collection-list-per-page-select",
            "data-testid": "collection-list-per-page"
          }
        )
      ] }),
      totalPages > 1 && /* @__PURE__ */ jsx3(
        Pagination,
        {
          value: page,
          onChange: onPageChange,
          total: totalPages,
          size: "sm",
          "data-testid": "collection-list-pagination-control"
        }
      )
    ] })
  ] });
};

// src/CollectionListToolbar.tsx
import {
  ActionIcon as ActionIcon3,
  Badge as Badge2,
  Button as Button3,
  Group as Group5,
  Select as Select2,
  TextInput,
  Tooltip as Tooltip2
} from "@mantine/core";
import {
  IconArchive,
  IconFilter,
  IconPlus as IconPlus3,
  IconRefresh,
  IconSearch,
  IconX as IconX3
} from "@tabler/icons-react";
import { useBuildpadTranslations as useBuildpadTranslations5 } from "@buildpad/services";

// src/BulkActionsBar.tsx
import {
  ActionIcon as ActionIcon2,
  Badge,
  Button as Button2,
  Group as Group4,
  Tooltip
} from "@mantine/core";
import {
  IconEdit,
  IconPlus as IconPlus2,
  IconTrash as IconTrash2,
  IconX as IconX2
} from "@tabler/icons-react";
import { useBuildpadI18n, useBuildpadTranslations as useBuildpadTranslations4 } from "@buildpad/services";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var BulkActionsBar = ({
  selectedIds,
  selectedRows,
  enableDelete,
  deleteAllowed,
  createAllowed,
  updateAllowed,
  bulkActions,
  onDeleteRequest,
  onClearSelection,
  translations
}) => {
  const t = useBuildpadTranslations4((d) => d.collections, translations);
  const common = useBuildpadTranslations4((d) => d.common);
  const { formatCount } = useBuildpadI18n();
  return /* @__PURE__ */ jsxs4(Group4, { gap: "xs", "data-testid": "collection-list-bulk-actions", children: [
    /* @__PURE__ */ jsx4(Badge, { variant: "light", size: "lg", children: formatCount(selectedIds.length, t.bulkActions.selectedCount) }),
    enableDelete && /* @__PURE__ */ jsx4(Tooltip, { label: deleteAllowed ? t.bulkActions.deleteSelectedTooltip : common.notAllowed, children: /* @__PURE__ */ jsx4(
      Button2,
      {
        variant: "light",
        color: "red",
        size: "compact-sm",
        leftSection: /* @__PURE__ */ jsx4(IconTrash2, { size: 16 }),
        onClick: () => deleteAllowed && onDeleteRequest(selectedIds),
        disabled: !deleteAllowed,
        "data-testid": "bulk-action-delete",
        children: t.bulkActions.delete
      }
    ) }),
    bulkActions.map((action, index) => {
      const permKey = action.requiredPermission;
      const permAllowed = !permKey || permKey === "create" && createAllowed || permKey === "update" && updateAllowed || permKey === "delete" && deleteAllowed;
      return /* @__PURE__ */ jsx4(
        Tooltip,
        {
          label: permAllowed ? action.label : common.notAllowed,
          children: /* @__PURE__ */ jsx4(
            Button2,
            {
              variant: "light",
              color: action.color,
              size: "compact-sm",
              leftSection: action.icon || (action.requiredPermission === "delete" ? /* @__PURE__ */ jsx4(IconTrash2, { size: 16 }) : action.requiredPermission === "update" ? /* @__PURE__ */ jsx4(IconEdit, { size: 16 }) : (
                // NOSONAR: idiomatic tri-state ternary, not confusing nesting
                action.requiredPermission === "create" ? /* @__PURE__ */ jsx4(IconPlus2, { size: 16 }) : (
                  // NOSONAR: idiomatic tri-state ternary, not confusing nesting
                  null
                )
              )),
              onClick: () => permAllowed && action.action(selectedIds, selectedRows),
              disabled: !permAllowed,
              "data-testid": `bulk-action-${index}`,
              children: action.label
            }
          )
        },
        action.label
      );
    }),
    /* @__PURE__ */ jsx4(
      ActionIcon2,
      {
        variant: "subtle",
        onClick: onClearSelection,
        title: t.bulkActions.clearSelection,
        "data-testid": "collection-list-clear-selection",
        children: /* @__PURE__ */ jsx4(IconX2, { size: 16 })
      }
    )
  ] });
};

// src/CollectionListToolbar.tsx
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var CollectionListToolbar = ({
  enableSearch,
  search,
  onSearchChange,
  enableFilter,
  filterPanelOpen,
  activeFilterCount,
  onToggleFilterPanel,
  archiveField,
  archiveFilterMode,
  onArchiveFilterChange,
  onRefresh,
  enableSelection,
  selectedIds,
  selectedRows,
  enableDelete,
  deleteAllowed,
  createAllowed,
  updateAllowed,
  bulkActions,
  onDeleteRequest,
  onClearSelection,
  enableCreate,
  onCreate,
  translations
}) => {
  const t = useBuildpadTranslations5((d) => d.collections, translations);
  const common = useBuildpadTranslations5((d) => d.common);
  const showBulkActions = enableSelection && selectedIds.length > 0;
  return /* @__PURE__ */ jsxs5("div", { className: "collection-list-toolbar", "data-testid": "collection-list-toolbar", children: [
    /* @__PURE__ */ jsxs5(Group5, { gap: "xs", children: [
      enableSearch && /* @__PURE__ */ jsx5(
        TextInput,
        {
          placeholder: t.listToolbar.searchPlaceholder,
          leftSection: /* @__PURE__ */ jsx5(IconSearch, { size: 16 }),
          value: search,
          onChange: (e) => onSearchChange(e.currentTarget.value),
          rightSection: search ? /* @__PURE__ */ jsx5(
            ActionIcon3,
            {
              variant: "subtle",
              size: "xs",
              onClick: () => onSearchChange(""),
              "aria-label": t.listToolbar.clearSearch,
              children: /* @__PURE__ */ jsx5(IconX3, { size: 12 })
            }
          ) : void 0,
          size: "sm",
          className: "collection-list-search",
          "data-testid": "collection-list-search"
        }
      ),
      enableFilter && /* @__PURE__ */ jsx5(Tooltip2, { label: filterPanelOpen ? t.listToolbar.hideFilters : t.listToolbar.showFilters, children: /* @__PURE__ */ jsxs5(
        ActionIcon3,
        {
          variant: activeFilterCount > 0 ? "filled" : "subtle",
          color: activeFilterCount > 0 ? "primary" : void 0,
          onClick: onToggleFilterPanel,
          title: t.listToolbar.toggleFilterPanel,
          "data-testid": "collection-list-filter-toggle",
          pos: "relative",
          children: [
            /* @__PURE__ */ jsx5(IconFilter, { size: 16 }),
            activeFilterCount > 0 && /* @__PURE__ */ jsx5(
              Badge2,
              {
                size: "xs",
                circle: true,
                color: "red",
                className: "collection-list-filter-badge",
                "data-testid": "collection-list-filter-count",
                children: activeFilterCount
              }
            )
          ]
        }
      ) }),
      archiveField && /* @__PURE__ */ jsx5(
        Select2,
        {
          value: archiveFilterMode,
          onChange: (val) => {
            if (val) onArchiveFilterChange(val);
          },
          data: [
            { value: "all", label: t.listToolbar.archive.all },
            { value: "unarchived", label: t.listToolbar.archive.active },
            { value: "archived", label: t.listToolbar.archive.archived }
          ],
          size: "sm",
          leftSection: /* @__PURE__ */ jsx5(IconArchive, { size: 14 }),
          "data-testid": "collection-list-archive-filter",
          style: { width: 160 }
        }
      ),
      /* @__PURE__ */ jsx5(
        ActionIcon3,
        {
          variant: "subtle",
          onClick: onRefresh,
          title: t.listToolbar.refresh,
          "data-testid": "collection-list-refresh",
          children: /* @__PURE__ */ jsx5(IconRefresh, { size: 16 })
        }
      )
    ] }),
    /* @__PURE__ */ jsxs5(Group5, { gap: "xs", children: [
      showBulkActions && /* @__PURE__ */ jsx5(
        BulkActionsBar,
        {
          selectedIds,
          selectedRows,
          enableDelete,
          deleteAllowed,
          createAllowed,
          updateAllowed,
          bulkActions,
          onDeleteRequest,
          onClearSelection,
          translations
        }
      ),
      enableCreate && onCreate && /* @__PURE__ */ jsx5(Tooltip2, { label: createAllowed ? t.listToolbar.createItem : common.notAllowed, children: /* @__PURE__ */ jsx5(
        Button3,
        {
          variant: "filled",
          size: "compact-sm",
          leftSection: /* @__PURE__ */ jsx5(IconPlus3, { size: 18 }),
          onClick: createAllowed ? onCreate : void 0,
          disabled: !createAllowed,
          "data-testid": "collection-list-create",
          "aria-label": createAllowed ? t.listToolbar.createItem : t.listToolbar.createItemNotAllowed,
          children: t.listToolbar.createItem
        }
      ) })
    ] })
  ] });
};

// src/DeleteConfirmModal.tsx
import {
  Button as Button4,
  Group as Group6,
  Modal as Modal2,
  Stack as Stack2,
  Text as Text3
} from "@mantine/core";
import { useBuildpadI18n as useBuildpadI18n2, useBuildpadTranslations as useBuildpadTranslations6 } from "@buildpad/services";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var DeleteConfirmModal = ({
  opened,
  count,
  loading,
  onConfirm,
  onCancel,
  translations
}) => {
  const t = useBuildpadTranslations6((d) => d.collections, translations);
  const { formatCount } = useBuildpadI18n2();
  return /* @__PURE__ */ jsx6(
    Modal2,
    {
      opened,
      onClose: onCancel,
      title: t.deleteConfirm.title,
      centered: true,
      size: "sm",
      "data-testid": "delete-confirm-modal",
      children: /* @__PURE__ */ jsxs6(Stack2, { gap: "md", children: [
        /* @__PURE__ */ jsx6(Text3, { size: "sm", children: formatCount(count, t.deleteConfirm.message) }),
        /* @__PURE__ */ jsxs6(Group6, { justify: "flex-end", children: [
          /* @__PURE__ */ jsx6(
            Button4,
            {
              variant: "default",
              onClick: onCancel,
              disabled: loading,
              children: t.deleteConfirm.cancel
            }
          ),
          /* @__PURE__ */ jsx6(
            Button4,
            {
              color: "red",
              onClick: onConfirm,
              loading,
              "data-testid": "delete-confirm-btn",
              children: t.deleteConfirm.confirm
            }
          )
        ] })
      ] })
    }
  );
};

// src/FilterPanel.tsx
import { useState as useState2, useCallback as useCallback2, useMemo as useMemo2 } from "react";
import {
  Group as Group7,
  Stack as Stack3,
  Button as Button5,
  Text as Text4,
  Select as Select3,
  TextInput as TextInput2,
  NumberInput,
  ActionIcon as ActionIcon4,
  Paper as Paper2,
  Menu as Menu2,
  Badge as Badge3
} from "@mantine/core";
import {
  IconFilter as IconFilter2,
  IconPlus as IconPlus4,
  IconTrash as IconTrash3,
  IconChevronDown as IconChevronDown2,
  IconChevronUp,
  IconX as IconX4
} from "@tabler/icons-react";
import { useBuildpadI18n as useBuildpadI18n3, useBuildpadTranslations as useBuildpadTranslations7 } from "@buildpad/services";
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
var STRING_OPERATORS = [
  { labelKey: "equals", value: "_eq", needsValue: true },
  { labelKey: "notEquals", value: "_neq", needsValue: true },
  { labelKey: "contains", value: "_contains", needsValue: true },
  { labelKey: "doesNotContain", value: "_ncontains", needsValue: true },
  { labelKey: "startsWith", value: "_starts_with", needsValue: true },
  { labelKey: "endsWith", value: "_ends_with", needsValue: true },
  { labelKey: "isEmpty", value: "_empty", needsValue: false },
  { labelKey: "isNotEmpty", value: "_nempty", needsValue: false },
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false }
];
var NUMBER_OPERATORS = [
  { labelKey: "equals", value: "_eq", needsValue: true },
  { labelKey: "notEquals", value: "_neq", needsValue: true },
  { labelKey: "greaterThan", value: "_gt", needsValue: true },
  { labelKey: "greaterOrEqual", value: "_gte", needsValue: true },
  { labelKey: "lessThan", value: "_lt", needsValue: true },
  { labelKey: "lessOrEqual", value: "_lte", needsValue: true },
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false }
];
var BOOLEAN_OPERATORS = [
  { labelKey: "equals", value: "_eq", needsValue: true },
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false }
];
var DATE_OPERATORS = [
  { labelKey: "equals", value: "_eq", needsValue: true },
  { labelKey: "notEquals", value: "_neq", needsValue: true },
  { labelKey: "after", value: "_gt", needsValue: true },
  { labelKey: "onOrAfter", value: "_gte", needsValue: true },
  { labelKey: "before", value: "_lt", needsValue: true },
  { labelKey: "onOrBefore", value: "_lte", needsValue: true },
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false }
];
var UUID_OPERATORS = [
  { labelKey: "equals", value: "_eq", needsValue: true },
  { labelKey: "notEquals", value: "_neq", needsValue: true },
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false }
];
var JSON_OPERATORS = [
  { labelKey: "isNull", value: "_null", needsValue: false },
  { labelKey: "isNotNull", value: "_nnull", needsValue: false },
  { labelKey: "isEmpty", value: "_empty", needsValue: false },
  { labelKey: "isNotEmpty", value: "_nempty", needsValue: false }
];
function getOperatorsForType(type) {
  switch (type) {
    case "string":
    case "text":
    case "csv":
    case "hash":
      return STRING_OPERATORS;
    case "integer":
    case "bigInteger":
    case "float":
    case "decimal":
      return NUMBER_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
    case "timestamp":
    case "dateTime":
    case "date":
    case "time":
      return DATE_OPERATORS;
    case "uuid":
      return UUID_OPERATORS;
    case "json":
      return JSON_OPERATORS;
    default:
      return STRING_OPERATORS;
  }
}
var _filterId = 0;
function uid() {
  return `filter-${++_filterId}`;
}
function rulesToDaaS(rules) {
  return rules.map((r) => {
    if ("logical" in r) {
      return { [r.logical]: rulesToDaaS(r.rules) };
    }
    const boolOps = ["_null", "_nnull", "_empty", "_nempty"];
    const val = boolOps.includes(r.operator) ? true : r.value;
    return { [r.field]: { [r.operator]: val } };
  });
}
function daasToRules(filter) {
  const key = Object.keys(filter)[0];
  if (!key) return [];
  if (key === "_and" || key === "_or") {
    const children = filter[key];
    const rules = children.map((child) => {
      const childKey = Object.keys(child)[0];
      if (childKey === "_and" || childKey === "_or") {
        return {
          id: uid(),
          logical: childKey,
          rules: daasToRules(child)
        };
      }
      return parseFieldRule(child);
    });
    return rules;
  }
  return [parseFieldRule(filter)];
}
function parseFieldRule(node) {
  const field = Object.keys(node)[0];
  const opObj = node[field];
  const operator = Object.keys(opObj)[0];
  const value = opObj[operator];
  return { id: uid(), field, operator, value };
}
var RuleRow = ({ rule, fields, disabled, onChange, onRemove, t }) => {
  const fieldData = useMemo2(
    () => fields.map((f) => ({
      value: f.field,
      label: f.meta?.note || f.field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    })),
    [fields]
  );
  const selectedField = fields.find((f) => f.field === rule.field);
  const operators = getOperatorsForType(selectedField?.type || "string");
  const operatorData = operators.map((o) => ({ value: o.value, label: t.operators[o.labelKey] }));
  const currentOp = operators.find((o) => o.value === rule.operator);
  return /* @__PURE__ */ jsxs7(Group7, { gap: "xs", wrap: "nowrap", "data-testid": "filter-rule", children: [
    /* @__PURE__ */ jsx7(
      Select3,
      {
        value: rule.field,
        onChange: (val) => {
          if (!val) return;
          const newField = fields.find((f) => f.field === val);
          const newOps = getOperatorsForType(newField?.type || "string");
          onChange({ ...rule, field: val, operator: newOps[0].value, value: null });
        },
        data: fieldData,
        placeholder: t.rule.fieldPlaceholder,
        size: "xs",
        style: { minWidth: 130 },
        disabled,
        searchable: true
      }
    ),
    /* @__PURE__ */ jsx7(
      Select3,
      {
        value: rule.operator,
        onChange: (val) => {
          if (!val) return;
          const op = operators.find((o) => o.value === val);
          onChange({ ...rule, operator: val, value: op?.needsValue ? rule.value : true });
        },
        data: operatorData,
        size: "xs",
        style: { minWidth: 130 },
        disabled
      }
    ),
    currentOp?.needsValue && (() => {
      const type = selectedField?.type || "string";
      if (["integer", "bigInteger", "float", "decimal"].includes(type)) {
        return /* @__PURE__ */ jsx7(
          NumberInput,
          {
            value: typeof rule.value === "number" ? rule.value : void 0,
            onChange: (val) => onChange({ ...rule, value: val }),
            placeholder: t.rule.valuePlaceholder,
            size: "xs",
            style: { minWidth: 100, flex: 1 },
            disabled
          }
        );
      }
      if (type === "boolean") {
        return /* @__PURE__ */ jsx7(
          Select3,
          {
            value: rule.value === true ? "true" : rule.value === false ? "false" : "",
            onChange: (val) => onChange({ ...rule, value: val === "true" }),
            data: [{ value: "true", label: t.rule.booleanTrue }, { value: "false", label: t.rule.booleanFalse }],
            size: "xs",
            style: { minWidth: 80 },
            disabled
          }
        );
      }
      return /* @__PURE__ */ jsx7(
        TextInput2,
        {
          value: typeof rule.value === "string" ? rule.value : "",
          onChange: (e) => onChange({ ...rule, value: e.currentTarget.value }),
          placeholder: ["timestamp", "dateTime", "date"].includes(type) ? t.rule.datePlaceholder : t.rule.valuePlaceholder,
          size: "xs",
          style: { minWidth: 120, flex: 1 },
          disabled
        }
      );
    })(),
    /* @__PURE__ */ jsx7(
      ActionIcon4,
      {
        variant: "subtle",
        color: "red",
        size: "sm",
        onClick: onRemove,
        disabled,
        title: t.rule.remove,
        children: /* @__PURE__ */ jsx7(IconTrash3, { size: 14 })
      }
    )
  ] });
};
var FilterPanel = ({
  fields,
  value,
  onChange,
  mode = "panel",
  collapsible = false,
  defaultCollapsed = true,
  disabled = false,
  maxDepth = 3,
  translations
}) => {
  const t = useBuildpadTranslations7((d) => d.collections.filterPanel, translations?.filterPanel);
  const { formatCount } = useBuildpadI18n3();
  const [collapsed, setCollapsed] = useState2(defaultCollapsed);
  const [rootGroup, setRootGroup] = useState2(() => {
    if (value && Object.keys(value).length > 0) {
      const key = Object.keys(value)[0];
      const logical = key === "_or" ? "_or" : "_and";
      return {
        id: uid(),
        logical,
        rules: daasToRules(value)
      };
    }
    return { id: uid(), logical: "_and", rules: [] };
  });
  const emitChange = useCallback2((group) => {
    setRootGroup(group);
    if (group.rules.length === 0) {
      onChange?.(null);
    } else {
      const nodes = rulesToDaaS(group.rules);
      onChange?.({ [group.logical]: nodes });
    }
  }, [onChange]);
  const addGroup = useCallback2(() => {
    const newGroup = {
      id: uid(),
      logical: "_and",
      rules: []
    };
    emitChange({ ...rootGroup, rules: [...rootGroup.rules, newGroup] });
  }, [rootGroup, emitChange]);
  const updateRule = useCallback2((index, updated) => {
    const newRules = [...rootGroup.rules];
    newRules[index] = updated;
    emitChange({ ...rootGroup, rules: newRules });
  }, [rootGroup, emitChange]);
  const removeRule = useCallback2((index) => {
    emitChange({ ...rootGroup, rules: rootGroup.rules.filter((_, i) => i !== index) });
  }, [rootGroup, emitChange]);
  const clearAll = useCallback2(() => {
    emitChange({ ...rootGroup, rules: [] });
  }, [rootGroup, emitChange]);
  const toggleLogical = useCallback2(() => {
    emitChange({ ...rootGroup, logical: rootGroup.logical === "_and" ? "_or" : "_and" });
  }, [rootGroup, emitChange]);
  const filterCount = rootGroup.rules.length;
  if (collapsible && collapsed) {
    return /* @__PURE__ */ jsxs7(Group7, { gap: "xs", "data-testid": "filter-panel-collapsed", children: [
      /* @__PURE__ */ jsx7(
        Button5,
        {
          variant: "subtle",
          size: "xs",
          leftSection: /* @__PURE__ */ jsx7(IconFilter2, { size: 14 }),
          rightSection: filterCount > 0 ? /* @__PURE__ */ jsx7(Badge3, { size: "xs", circle: true, children: filterCount }) : /* @__PURE__ */ jsx7(IconChevronDown2, { size: 14 }),
          onClick: () => setCollapsed(false),
          children: t.title
        }
      ),
      filterCount > 0 && /* @__PURE__ */ jsx7(ActionIcon4, { variant: "subtle", size: "xs", color: "dimmed", onClick: clearAll, title: t.clearAllFilters, children: /* @__PURE__ */ jsx7(IconX4, { size: 12 }) })
    ] });
  }
  const content = /* @__PURE__ */ jsxs7(Stack3, { gap: "xs", "data-testid": "filter-panel", children: [
    /* @__PURE__ */ jsxs7(Group7, { justify: "space-between", children: [
      /* @__PURE__ */ jsxs7(Group7, { gap: "xs", children: [
        /* @__PURE__ */ jsx7(IconFilter2, { size: 16, style: { color: "var(--mantine-color-dimmed)" } }),
        /* @__PURE__ */ jsx7(Text4, { size: "sm", fw: 600, children: t.title }),
        filterCount > 0 && /* @__PURE__ */ jsx7(Badge3, { size: "xs", variant: "light", children: formatCount(filterCount, t.activeCount) })
      ] }),
      /* @__PURE__ */ jsxs7(Group7, { gap: "xs", children: [
        filterCount > 0 && /* @__PURE__ */ jsx7(Button5, { variant: "subtle", size: "xs", color: "dimmed", onClick: clearAll, children: t.clearAll }),
        collapsible && /* @__PURE__ */ jsx7(ActionIcon4, { variant: "subtle", size: "xs", onClick: () => setCollapsed(true), children: /* @__PURE__ */ jsx7(IconChevronUp, { size: 14 }) })
      ] })
    ] }),
    rootGroup.rules.length > 1 && /* @__PURE__ */ jsxs7(Group7, { gap: "xs", children: [
      /* @__PURE__ */ jsx7(Text4, { size: "xs", c: "dimmed", children: t.match }),
      /* @__PURE__ */ jsx7(
        Button5,
        {
          variant: rootGroup.logical === "_and" ? "filled" : "outline",
          size: "compact-xs",
          onClick: () => rootGroup.logical !== "_and" && toggleLogical(),
          children: t.matchAll
        }
      ),
      /* @__PURE__ */ jsx7(
        Button5,
        {
          variant: rootGroup.logical === "_or" ? "filled" : "outline",
          size: "compact-xs",
          onClick: () => rootGroup.logical !== "_or" && toggleLogical(),
          children: t.matchAny
        }
      )
    ] }),
    rootGroup.rules.length === 0 ? /* @__PURE__ */ jsx7(Text4, { size: "sm", c: "dimmed", children: t.emptyState }) : /* @__PURE__ */ jsx7(Stack3, { gap: 6, children: rootGroup.rules.map((rule, index) => {
      if ("logical" in rule) {
        return /* @__PURE__ */ jsxs7(Group7, { gap: "xs", children: [
          /* @__PURE__ */ jsx7(Badge3, { variant: "outline", size: "sm", children: formatCount(rule.rules.length, t.group.summary, {
            logical: rule.logical === "_and" ? t.group.and : t.group.or
          }) }),
          /* @__PURE__ */ jsx7(
            ActionIcon4,
            {
              variant: "subtle",
              color: "red",
              size: "xs",
              onClick: () => removeRule(index),
              disabled,
              children: /* @__PURE__ */ jsx7(IconTrash3, { size: 12 })
            }
          )
        ] }, rule.id);
      }
      return /* @__PURE__ */ jsx7(
        RuleRow,
        {
          rule,
          fields,
          disabled,
          onChange: (updated) => updateRule(index, updated),
          onRemove: () => removeRule(index),
          t
        },
        rule.id
      );
    }) }),
    /* @__PURE__ */ jsxs7(Group7, { gap: "xs", children: [
      /* @__PURE__ */ jsxs7(Menu2, { position: "bottom-start", withArrow: true, shadow: "sm", children: [
        /* @__PURE__ */ jsx7(Menu2.Target, { children: /* @__PURE__ */ jsx7(Button5, { variant: "subtle", size: "xs", leftSection: /* @__PURE__ */ jsx7(IconPlus4, { size: 14 }), children: t.addFilter }) }),
        /* @__PURE__ */ jsx7(Menu2.Dropdown, { children: fields.map((f) => /* @__PURE__ */ jsx7(
          Menu2.Item,
          {
            onClick: () => {
              const ops = getOperatorsForType(f.type);
              const newRule = {
                id: uid(),
                field: f.field,
                operator: ops[0].value,
                value: ops[0].needsValue ? null : true
              };
              emitChange({ ...rootGroup, rules: [...rootGroup.rules, newRule] });
            },
            children: f.meta?.note || f.field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          },
          f.field
        )) })
      ] }),
      maxDepth > 1 && /* @__PURE__ */ jsx7(Button5, { variant: "subtle", size: "xs", color: "dimmed", onClick: addGroup, children: t.addGroup })
    ] })
  ] });
  if (mode === "inline") return content;
  return /* @__PURE__ */ jsx7(Paper2, { withBorder: true, p: "sm", "data-testid": "filter-panel-container", children: content });
};

// src/CollectionList.tsx
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var SYSTEM_FIELDS2 = /* @__PURE__ */ new Set([
  "user_created",
  "user_updated",
  "date_created",
  "date_updated"
]);
var NON_FLAT_RELATIONAL_SPECIALS2 = /* @__PURE__ */ new Set(["m2a", "m2m", "o2m"]);
var NON_FLAT_RELATIONAL_INTERFACES2 = /* @__PURE__ */ new Set([
  "list-m2a",
  "list-m2m",
  "list-o2m"
]);
var SPACING_HEIGHT = {
  compact: 32,
  cozy: 48,
  comfortable: 56
};
var CollectionList = ({
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
  primaryKeyField: primaryKeyFieldProp,
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
  translations,
  exactCount = false
}) => {
  const t = useBuildpadTranslations8((d) => d.collections, translations);
  const { formatDate, formatDateTime, formatNumber, formatCount } = useBuildpadI18n4();
  const [allFields, setAllFields] = useState3([]);
  const [resolvedPk, setResolvedPk] = useState3(null);
  const primaryKeyField = primaryKeyFieldProp ?? resolvedPk ?? "id";
  const [visibleFieldKeys, setVisibleFieldKeys] = useState3([]);
  const [items, setItems] = useState3([]);
  const [totalCount, setTotalCount] = useState3(0);
  const [filterCount, setFilterCount] = useState3(0);
  const [selectedItems, setSelectedItems] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [error, setError] = useState3(null);
  const [page, setPage] = useState3(1);
  const [limit, setLimit] = useState3(initialLimit);
  const [search, setSearch] = useState3("");
  const [sort, setSort] = useState3({ by: null, desc: false });
  const [archiveFilterMode, setArchiveFilterMode] = useState3("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState3(false);
  const [internalFilter, setInternalFilter] = useState3(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState3(false);
  const [deletingIds, setDeletingIds] = useState3([]);
  const [deleteLoading, setDeleteLoading] = useState3(false);
  const [headerOverrides, setHeaderOverrides] = useState3({});
  const loadRequestRef = useRef2(0);
  const exactTotalRef = useRef2(null);
  const rowHeight = rowHeightProp ?? SPACING_HEIGHT[tableSpacing] ?? 48;
  const [createAllowed, setCreateAllowed] = useState3(true);
  const [updateAllowed, setUpdateAllowed] = useState3(true);
  const [deleteAllowed, setDeleteAllowed] = useState3(true);
  useEffect2(() => {
    let cancelled = false;
    const loadFieldsAndPermissions = async () => {
      try {
        const [fieldsResult, collectionAccess] = await Promise.all([
          new FieldsService2().readAll(collection),
          PermissionsService2.getMyCollectionAccess().catch(() => ({}))
        ]);
        if (cancelled) return;
        const accessMap = collectionAccess ?? {};
        const access = accessMap[collection] || {};
        const isAdmin = PermissionsService2.isAdmin;
        const isEmptyAccess = Object.keys(accessMap).length === 0;
        const readAccess = access.read;
        const createAccess = access.create;
        const updateAccess = access.update;
        const deleteAccess = access.delete;
        const canCreate = isAdmin || isEmptyAccess || !!createAccess;
        const canUpdate = isAdmin || isEmptyAccess || !!updateAccess;
        const canDelete = isAdmin || isEmptyAccess || !!deleteAccess;
        setCreateAllowed(canCreate);
        setUpdateAllowed(canUpdate);
        setDeleteAllowed(canDelete);
        let canArchive = false;
        if (archiveField && canUpdate) {
          if (isAdmin || isEmptyAccess) {
            canArchive = true;
          } else if (updateAccess?.fields) {
            canArchive = updateAccess.fields.includes("*") || updateAccess.fields.includes(archiveField);
          }
        }
        if (!cancelled) {
          onPermissionsLoaded?.({
            createAllowed: canCreate,
            readAllowed: isAdmin || isEmptyAccess || !!readAccess,
            updateAllowed: canUpdate,
            deleteAllowed: canDelete,
            archiveAllowed: canArchive
          });
        }
        let permFields = null;
        if (!isAdmin && !isEmptyAccess && readAccess) {
          permFields = readAccess.fields ?? null;
          if (permFields && permFields.includes("*")) permFields = null;
        }
        let visible = fieldsResult.filter((f) => {
          if (SYSTEM_FIELDS2.has(f.field)) return false;
          if (f.type === "alias") return false;
          const special = f.meta?.special ?? [];
          const isNonFlatRelational = special.some((s) => NON_FLAT_RELATIONAL_SPECIALS2.has(s)) || !!f.meta?.interface && NON_FLAT_RELATIONAL_INTERFACES2.has(f.meta.interface);
          if (isNonFlatRelational) return false;
          const isHidden = f.meta?.hidden ?? f.hidden;
          if (isHidden) return false;
          return true;
        });
        const hasRestriction = permFields !== null && permFields.length > 0;
        if (hasRestriction) {
          const accessibleSet = new Set(permFields);
          visible = visible.filter((f) => accessibleSet.has(f.field));
        }
        setAllFields(visible);
        const schemaPk = fieldsResult.find(
          (f) => f.schema?.is_primary_key
        )?.field;
        const pkField = primaryKeyFieldProp ?? schemaPk ?? "id";
        setResolvedPk(schemaPk ?? "id");
        if (displayFields) {
          const keys = hasRestriction ? displayFields.filter((k) => new Set(permFields).has(k)) : displayFields;
          setVisibleFieldKeys(
            keys.length > 0 ? keys : visible.slice(0, 5).map((f) => f.field)
          );
        } else {
          const initial = visible.slice(0, 5).map((f) => f.field);
          if (!initial.includes(pkField) && visible.some((f) => f.field === pkField)) {
            initial.unshift(pkField);
          }
          setVisibleFieldKeys(initial);
        }
        if (visible.length === 0 && !cancelled) {
          setError(interpolate3(t.list.errors.noVisibleFields, { collection }));
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading fields:", err);
        if (!cancelled) {
          setError(t.list.errors.loadFieldsFailed);
          setLoading(false);
        }
      }
    };
    loadFieldsAndPermissions();
    return () => {
      cancelled = true;
    };
  }, [collection, displayFields, primaryKeyFieldProp, t]);
  const mergedFilter = useMemo3(() => {
    const filters = [];
    if (filter && Object.keys(filter).length > 0) filters.push(filter);
    if (internalFilter && Object.keys(internalFilter).length > 0) filters.push(internalFilter);
    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];
    return { _and: filters };
  }, [filter, internalFilter]);
  const activeFilterCount = useMemo3(() => {
    if (!internalFilter) return 0;
    const countRules = (obj) => {
      if (obj._and && Array.isArray(obj._and)) return obj._and.reduce((n, r) => n + countRules(r), 0);
      if (obj._or && Array.isArray(obj._or)) return obj._or.reduce((n, r) => n + countRules(r), 0);
      return 1;
    };
    return countRules(internalFilter);
  }, [internalFilter]);
  useEffect2(() => {
    setSelectedItems([]);
    setInternalFilter(null);
    setFilterPanelOpen(false);
    setSearch("");
    setPage(1);
  }, [collection]);
  useEffect2(() => {
    exactTotalRef.current = null;
  }, [collection, search, mergedFilter, archiveField, archiveFilterMode, archiveValue]);
  const loadItems = useCallback3(async () => {
    if (visibleFieldKeys.length === 0) return;
    const requestId = ++loadRequestRef.current;
    const isStale = () => requestId !== loadRequestRef.current;
    let steppedBack = false;
    try {
      setLoading(true);
      setError(null);
      const query = {
        limit,
        page
      };
      if (exactCount) {
        query.count = "exact";
      }
      const fieldsToFetch = [...visibleFieldKeys];
      if (!fieldsToFetch.includes(primaryKeyField)) {
        fieldsToFetch.unshift(primaryKeyField);
      }
      query.fields = fieldsToFetch.join(",");
      const combinedFilters = [];
      if (mergedFilter && Object.keys(mergedFilter).length > 0) {
        combinedFilters.push(mergedFilter);
      }
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
      if (search) {
        query.search = search;
      }
      if (sort.by) {
        query.sort = sort.desc ? `-${sort.by}` : sort.by;
      }
      const queryString = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== void 0 && v !== null).map(([k, v]) => [
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v)
          // NOSONAR: object case is already handled by this ternary
        ])
      ).toString();
      const rawResponse = await apiRequest2(`/api/items/${collection}${queryString ? `?${queryString}` : ""}`);
      if (isStale()) return;
      if (Array.isArray(rawResponse)) {
        setItems(rawResponse);
        setFilterCount(rawResponse.length);
      } else {
        const reported = rawResponse.meta?.total;
        const fetched = typeof reported === "number" && Number.isFinite(reported) ? reported : null;
        if (fetched !== null && rawResponse.meta?.total_estimated === false) {
          exactTotalRef.current = fetched;
        }
        const total = exactTotalRef.current ?? fetched;
        const lastPage = total === null ? page : Math.max(1, Math.ceil(total / limit));
        if (page > lastPage) {
          steppedBack = true;
          setFilterCount(total ?? 0);
          setPage(lastPage);
          return;
        }
        setItems(rawResponse.data || []);
        setFilterCount(total ?? rawResponse.data?.length ?? 0);
      }
    } catch (err) {
      if (isStale()) return;
      console.error("Error loading items:", err);
      setError(err instanceof Error ? err.message : t.list.errors.loadItemsFailed);
      setItems([]);
    } finally {
      if (!steppedBack && !isStale()) setLoading(false);
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
    exactCount,
    t
  ]);
  const getTotalCount = useCallback3(async () => {
    try {
      const params = new URLSearchParams({
        "aggregate[count]": primaryKeyField
      });
      const response = await apiRequest2(`/api/items/${collection}?${params.toString()}`);
      const count = Number(response.data?.[0]?.count?.[primaryKeyField] ?? 0);
      setTotalCount(count);
    } catch {
    }
  }, [collection, primaryKeyField]);
  useEffect2(() => {
    if (visibleFieldKeys.length > 0) {
      loadItems();
    }
  }, [loadItems, visibleFieldKeys.length]);
  useEffect2(() => {
    if (primaryKeyFieldProp || resolvedPk) {
      getTotalCount();
    }
  }, [getTotalCount, primaryKeyFieldProp, resolvedPk]);
  useEffect2(() => {
    setPage(1);
  }, [search, filter, internalFilter]);
  const permittedFields = useMemo3(() => allFields, [allFields]);
  const choicesByField = useMemo3(() => {
    const map = /* @__PURE__ */ new Map();
    for (const f of permittedFields) {
      if (!interfaceRequiresChoices(f.meta?.interface ?? "")) continue;
      const raw = f.meta?.options?.choices;
      if (!Array.isArray(raw) || raw.length === 0) continue;
      map.set(f.field, raw);
    }
    return map;
  }, [permittedFields]);
  const headers = useMemo3(() => {
    return visibleFieldKeys.map((key) => {
      const fieldMeta = permittedFields.find((f) => f.field === key);
      const overrides = headerOverrides[key] || {};
      const label = fieldMeta?.name || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
      return {
        text: label,
        value: key,
        sortable: enableSort,
        align: overrides.align || "left",
        width: overrides.width ?? null,
        // Attach field metadata for consumers and renderCell
        description: fieldMeta?.meta?.note || void 0,
        field: fieldMeta,
        ...overrides
      };
    });
  }, [visibleFieldKeys, permittedFields, headerOverrides, enableSort]);
  const totalPages = Math.max(1, Math.ceil(filterCount / limit));
  const selectedIds = useMemo3(() => {
    return selectedItems.map(
      (item) => typeof item === "object" && item !== null ? item[primaryKeyField] : item
    );
  }, [selectedItems, primaryKeyField]);
  const addField = useCallback3(
    (fieldKey) => {
      setVisibleFieldKeys((prev) => {
        if (prev.includes(fieldKey)) return prev;
        const next = [...prev, fieldKey];
        onFieldsChange?.(next);
        return next;
      });
    },
    [onFieldsChange]
  );
  const removeField = useCallback3(
    (fieldKey) => {
      setVisibleFieldKeys((prev) => {
        const next = prev.filter((k) => k !== fieldKey);
        onFieldsChange?.(next);
        return next;
      });
    },
    [onFieldsChange]
  );
  const handleAlignChange = useCallback3(
    (fieldKey, align) => {
      setHeaderOverrides((prev) => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], align }
      }));
    },
    []
  );
  const handleSortChange = useCallback3(
    (newSort) => {
      const s = newSort ?? { by: null, desc: false };
      setSort(s);
      onSortChangeProp?.(s);
    },
    [onSortChangeProp]
  );
  const handleHeadersChange = useCallback3((newHeaders) => {
    const overrides = {};
    newHeaders.forEach((h) => {
      overrides[h.value] = {};
      if (h.width) overrides[h.value].width = h.width;
      if (h.align && h.align !== "left") overrides[h.value].align = h.align;
    });
    setHeaderOverrides((prev) => ({ ...prev, ...overrides }));
    setVisibleFieldKeys(newHeaders.map((h) => h.value));
  }, []);
  const renderHeaderContextMenu = useCallback3(
    (header) => {
      if (!enableHeaderMenu) return null;
      return /* @__PURE__ */ jsxs8("div", { className: "collection-list-context-menu", role: "menu", children: [
        /* @__PURE__ */ jsx8(Menu3.Label, { children: t.list.headerMenu.sort }),
        /* @__PURE__ */ jsxs8(
          "div",
          {
            role: "menuitem",
            tabIndex: 0,
            className: "mantine-Menu-item collection-list-context-menu-item",
            onClick: () => handleSortChange({ by: header.value, desc: false }),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSortChange({ by: header.value, desc: false });
              }
            },
            children: [
              /* @__PURE__ */ jsx8(IconSortAscending, { size: 14 }),
              /* @__PURE__ */ jsx8(Text5, { size: "sm", children: t.list.headerMenu.sortAscending })
            ]
          }
        ),
        /* @__PURE__ */ jsxs8(
          "div",
          {
            role: "menuitem",
            tabIndex: 0,
            className: "mantine-Menu-item collection-list-context-menu-item",
            onClick: () => handleSortChange({ by: header.value, desc: true }),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSortChange({ by: header.value, desc: true });
              }
            },
            children: [
              /* @__PURE__ */ jsx8(IconSortDescending, { size: 14 }),
              /* @__PURE__ */ jsx8(Text5, { size: "sm", children: t.list.headerMenu.sortDescending })
            ]
          }
        ),
        /* @__PURE__ */ jsx8("div", { className: "collection-list-context-menu-divider" }),
        /* @__PURE__ */ jsx8(Menu3.Label, { children: t.list.headerMenu.alignment }),
        [
          {
            align: "left",
            icon: /* @__PURE__ */ jsx8(IconAlignLeft, { size: 14 }),
            label: t.list.headerMenu.alignLeft
          },
          {
            align: "center",
            icon: /* @__PURE__ */ jsx8(IconAlignCenter, { size: 14 }),
            label: t.list.headerMenu.alignCenter
          },
          {
            align: "right",
            icon: /* @__PURE__ */ jsx8(IconAlignRight, { size: 14 }),
            label: t.list.headerMenu.alignRight
          }
        ].map(({ align, icon, label }) => /* @__PURE__ */ jsxs8(
          "div",
          {
            role: "menuitem",
            tabIndex: 0,
            className: `mantine-Menu-item collection-list-context-menu-item${header.align === align ? " active" : ""}`,
            onClick: () => handleAlignChange(header.value, align),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleAlignChange(header.value, align);
              }
            },
            children: [
              icon,
              /* @__PURE__ */ jsx8(Text5, { size: "sm", children: label })
            ]
          },
          align
        )),
        /* @__PURE__ */ jsx8("div", { className: "collection-list-context-menu-divider" }),
        /* @__PURE__ */ jsxs8(
          "div",
          {
            role: "menuitem",
            tabIndex: 0,
            className: "mantine-Menu-item collection-list-context-menu-item danger",
            onClick: () => removeField(header.value),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                removeField(header.value);
              }
            },
            children: [
              /* @__PURE__ */ jsx8(IconEyeOff, { size: 14 }),
              /* @__PURE__ */ jsx8(Text5, { size: "sm", children: t.list.headerMenu.hideField })
            ]
          }
        )
      ] });
    },
    [enableHeaderMenu, handleSortChange, handleAlignChange, removeField, t]
  );
  const hiddenFields = useMemo3(() => {
    return permittedFields.filter((f) => !visibleFieldKeys.includes(f.field));
  }, [permittedFields, visibleFieldKeys]);
  const fieldTypeRenderCell = useCallback3(
    (item, header) => {
      if (consumerRenderCell) {
        const consumerResult = consumerRenderCell(item, header);
        if (consumerResult !== null && consumerResult !== void 0) return consumerResult;
      }
      const fieldMeta = permittedFields.find((f) => f.field === header.value);
      if (!fieldMeta) return null;
      const value = item[header.value];
      if (value === null || value === void 0) return null;
      const fieldType = fieldMeta.type;
      const fieldChoices = choicesByField.get(header.value);
      if (fieldChoices) {
        const arrayValue = parseChoiceValues(value, fieldChoices);
        if (arrayValue) {
          const entries = arrayValue.filter((v) => v !== null && v !== void 0);
          if (entries.length === 0) return null;
          return /* @__PURE__ */ jsxs8(Group8, { gap: 4, wrap: "nowrap", children: [
            entries.slice(0, 3).map((v, i) => /* @__PURE__ */ jsx8(
              Badge4,
              {
                variant: "light",
                size: "sm",
                color: "gray",
                style: { textTransform: "none", minWidth: 0 },
                children: resolveChoiceLabel(fieldChoices, v) ?? String(v ?? "")
              },
              `${String(v)}-${i}`
            )),
            entries.length > 3 && // Never the element that gets clipped: it is last in a
            // nowrap row, so in a narrow column the count of what is
            // hidden would itself be the first thing hidden.
            /* @__PURE__ */ jsx8(Text5, { size: "xs", c: "dimmed", style: { flexShrink: 0 }, children: interpolate3(t.list.cell.moreChoices, { count: formatNumber(entries.length - 3) }) })
          ] });
        }
        const label = resolveChoiceLabel(fieldChoices, value);
        if (label !== void 0) {
          if (label === "") return null;
          return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: label });
        }
        if (fieldType !== "json") {
          const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
          if (raw === "") return null;
          return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: raw });
        }
      }
      if (fieldType === "boolean") {
        return value ? /* @__PURE__ */ jsx8(IconCheck3, { size: 16, color: "var(--mantine-color-green-6)", "aria-label": t.list.cell.booleanTrue }) : /* @__PURE__ */ jsx8(IconX5, { size: 16, color: "var(--mantine-color-gray-4)", "aria-label": t.list.cell.booleanFalse });
      }
      if (fieldType === "timestamp" || fieldType === "dateTime" || fieldType === "date") {
        try {
          const dateObj = new Date(value);
          if (Number.isNaN(dateObj.getTime())) return null;
          if (fieldType === "date") {
            return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: formatDate(dateObj, { year: "numeric", month: "numeric", day: "numeric" }) });
          }
          return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: formatDateTime(dateObj, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric"
          }) });
        } catch {
          return null;
        }
      }
      if (fieldType === "integer" || fieldType === "float" || fieldType === "decimal" || fieldType === "bigInteger") {
        const num = Number(value);
        if (!Number.isNaN(num)) {
          return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: formatNumber(num) });
        }
        return null;
      }
      if (fieldType === "json") {
        return /* @__PURE__ */ jsx8(Badge4, { variant: "light", size: "sm", color: "gray", children: t.list.cell.jsonBadge });
      }
      if (fieldType === "uuid") {
        const str = typeof value === "object" ? JSON.stringify(value) : String(value);
        return /* @__PURE__ */ jsx8(Tooltip3, { label: str, openDelay: 300, children: /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", style: { maxWidth: 120 }, children: interpolate3(t.list.cell.truncated, { value: str.substring(0, 8) }) }) });
      }
      if (fieldMeta.meta?.interface === "collection-item-dropdown") {
        let parsed = value;
        if (typeof value === "string" && value.trim().startsWith("{")) {
          try {
            parsed = JSON.parse(value);
          } catch {
          }
        }
        if (typeof parsed === "object" && parsed !== null && "key" in parsed) {
          const keyVal = String(parsed.key);
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(keyVal);
          if (isUuid) {
            return /* @__PURE__ */ jsx8(Tooltip3, { label: keyVal, openDelay: 300, children: /* @__PURE__ */ jsx8(Badge4, { variant: "light", size: "sm", color: "blue", style: { textTransform: "none", maxWidth: 120 }, children: interpolate3(t.list.cell.truncated, { value: keyVal.substring(0, 8) }) }) });
          }
          return /* @__PURE__ */ jsx8(Badge4, { variant: "light", size: "sm", color: "blue", style: { textTransform: "none" }, children: keyVal });
        }
        return /* @__PURE__ */ jsx8(Text5, { size: "sm", truncate: "end", children: typeof value === "object" ? JSON.stringify(value) : String(value) });
      }
      return null;
    },
    [permittedFields, choicesByField, t, formatDate, formatDateTime, formatNumber]
  );
  const renderHeaderAppend = useCallback3(() => {
    if (!enableAddField || hiddenFields.length === 0) return null;
    return /* @__PURE__ */ jsxs8(Menu3, { position: "bottom-end", withArrow: true, shadow: "md", closeOnItemClick: true, children: [
      /* @__PURE__ */ jsx8(Menu3.Target, { children: /* @__PURE__ */ jsx8(ActionIcon5, { variant: "subtle", size: "sm", title: t.list.addField.label, children: /* @__PURE__ */ jsx8(IconPlus5, { size: 16 }) }) }),
      /* @__PURE__ */ jsxs8(Menu3.Dropdown, { children: [
        /* @__PURE__ */ jsx8(Menu3.Label, { children: t.list.addField.label }),
        hiddenFields.map((f) => /* @__PURE__ */ jsx8(Menu3.Item, { onClick: () => addField(f.field), children: f.meta?.note || f.field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) }, f.field))
      ] })
    ] });
  }, [enableAddField, hiddenFields, addField, t]);
  const handleFilterChange = useCallback3(
    (newFilter) => {
      setInternalFilter(newFilter);
      onFilterChange?.(newFilter);
    },
    [onFilterChange]
  );
  const handleClearFilter = useCallback3(() => {
    setInternalFilter(null);
    onFilterChange?.(null);
    setFilterPanelOpen(false);
  }, [onFilterChange]);
  const handleDeleteRequest = useCallback3(
    (ids) => {
      if (ids.length === 0) return;
      setDeletingIds(ids);
      setDeleteConfirmOpen(true);
    },
    []
  );
  const handleDeleteConfirm = useCallback3(async () => {
    if (deletingIds.length === 0) return;
    setDeleteLoading(true);
    try {
      const itemsService = new ItemsService2(collection);
      await itemsService.deleteMany(deletingIds, primaryKeyField);
      setDeleteConfirmOpen(false);
      setDeletingIds([]);
      setSelectedItems([]);
      onDeleteSuccess?.(deletingIds);
      exactTotalRef.current = null;
      loadItems();
      getTotalCount();
    } catch (err) {
      console.error("Error deleting items:", err);
      setError(err instanceof Error ? err.message : t.list.errors.deleteFailed);
      setDeleteConfirmOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingIds, collection, primaryKeyField, loadItems, getTotalCount, onDeleteSuccess, t]);
  const handleRefresh = useCallback3(() => {
    exactTotalRef.current = null;
    loadItems();
  }, [loadItems]);
  const handleDeleteCancel = useCallback3(() => {
    setDeleteConfirmOpen(false);
    setDeletingIds([]);
  }, []);
  const isFiltered = useMemo3(() => {
    return search.trim().length > 0 || filter && Object.keys(filter).length > 0 || internalFilter && Object.keys(internalFilter).length > 0 || archiveField && archiveFilterMode !== "all";
  }, [search, filter, internalFilter, archiveField, archiveFilterMode]);
  const itemCountDisplay = useMemo3(() => {
    const strings = t.list.itemCount;
    if (loading) return strings.loading;
    if (filterCount === 0) return strings.none;
    const from = Math.min((page - 1) * limit + 1, filterCount);
    const to = Math.min(page * limit, filterCount);
    const values = {
      from: formatNumber(from),
      to: formatNumber(to),
      total: formatNumber(totalCount)
    };
    if (isFiltered && filterCount < totalCount) {
      if (filterCount <= limit) {
        return formatCount(filterCount, strings.filteredSinglePage, values);
      }
      return formatCount(filterCount, strings.filteredRange, values);
    }
    if (filterCount <= limit) {
      return formatCount(filterCount, strings.singlePage);
    }
    return formatCount(filterCount, strings.range, values);
  }, [loading, totalCount, filterCount, page, limit, isFiltered, t, formatCount, formatNumber]);
  return /* @__PURE__ */ jsxs8(Stack4, { gap: 0, className: "collection-list", "data-testid": "collection-list", children: [
    /* @__PURE__ */ jsx8(
      CollectionListToolbar,
      {
        enableSearch,
        search,
        onSearchChange: setSearch,
        enableFilter,
        filterPanelOpen,
        activeFilterCount,
        onToggleFilterPanel: () => setFilterPanelOpen((v) => !v),
        archiveField,
        archiveFilterMode,
        onArchiveFilterChange: setArchiveFilterMode,
        onRefresh: handleRefresh,
        enableSelection,
        selectedIds,
        selectedRows: selectedItems,
        enableDelete,
        deleteAllowed,
        createAllowed,
        updateAllowed,
        bulkActions,
        onDeleteRequest: handleDeleteRequest,
        onClearSelection: () => setSelectedItems([]),
        enableCreate,
        onCreate,
        translations
      }
    ),
    enableFilter && /* @__PURE__ */ jsx8(Collapse, { in: filterPanelOpen, children: /* @__PURE__ */ jsxs8("div", { className: "collection-list-filter-panel", "data-testid": "collection-list-filter-panel", children: [
      /* @__PURE__ */ jsxs8(Group8, { justify: "space-between", mb: "xs", children: [
        /* @__PURE__ */ jsx8(Text5, { size: "sm", fw: 600, children: t.list.filterPanel.title }),
        activeFilterCount > 0 && /* @__PURE__ */ jsx8(
          Button6,
          {
            variant: "subtle",
            size: "compact-xs",
            leftSection: /* @__PURE__ */ jsx8(IconFilterOff, { size: 14 }),
            onClick: handleClearFilter,
            "data-testid": "collection-list-clear-filters",
            children: t.list.filterPanel.clearAll
          }
        )
      ] }),
      /* @__PURE__ */ jsx8(
        FilterPanel,
        {
          fields: permittedFields,
          value: internalFilter,
          onChange: handleFilterChange,
          mode: "inline",
          translations
        }
      )
    ] }) }),
    error && /* @__PURE__ */ jsx8(
      Alert2,
      {
        icon: /* @__PURE__ */ jsx8(IconAlertCircle2, { size: 16 }),
        color: "red",
        "data-testid": "collection-list-error",
        mt: "xs",
        children: error
      }
    ),
    /* @__PURE__ */ jsx8(
      VTable,
      {
        headers,
        items,
        itemKey: primaryKeyField,
        sort,
        mustSort: false,
        showSelect: enableSelection ? "multiple" : "none",
        showResize: enableResize,
        allowHeaderReorder: enableReorder,
        value: selectedItems,
        fixedHeader: true,
        loading,
        loadingText: t.list.table.loading,
        noItemsText: isFiltered ? t.list.table.noResultsFiltered : t.list.table.noItems,
        rowHeight,
        selectionUseKeys: true,
        clickable: !!onItemClick,
        renderCell: fieldTypeRenderCell,
        renderHeaderContextMenu: enableHeaderMenu ? renderHeaderContextMenu : void 0,
        renderHeaderAppend: enableAddField ? renderHeaderAppend : void 0,
        renderFooter: () => /* @__PURE__ */ jsx8(
          CollectionListFooter,
          {
            itemCountDisplay,
            limit,
            onLimitChange: (val) => {
              setLimit(val);
              setPage(1);
            },
            page,
            onPageChange: setPage,
            totalPages,
            translations
          }
        ),
        onUpdate: setSelectedItems,
        onSortChange: handleSortChange,
        onHeadersChange: handleHeadersChange,
        onRowClick: onItemClick ? ({ item }) => onItemClick(
          item,
          item[primaryKeyField]
        ) : void 0,
        "data-testid": "collection-list-table"
      }
    ),
    /* @__PURE__ */ jsx8(
      DeleteConfirmModal,
      {
        opened: deleteConfirmOpen,
        count: deletingIds.length,
        loading: deleteLoading,
        onConfirm: handleDeleteConfirm,
        onCancel: handleDeleteCancel,
        translations
      }
    )
  ] });
};

// src/ContentNavigation.tsx
import { useState as useState4, useMemo as useMemo4, useCallback as useCallback4 } from "react";
import {
  NavLink,
  TextInput as TextInput3,
  Stack as Stack5,
  ScrollArea,
  Text as Text6,
  Menu as Menu4,
  ActionIcon as ActionIcon6,
  Group as Group9,
  Box,
  UnstyledButton
} from "@mantine/core";
import {
  IconSearch as IconSearch2,
  IconChevronRight,
  IconFolder,
  IconTable,
  IconEye,
  IconEyeOff as IconEyeOff2,
  IconBookmark,
  IconSettings,
  IconDatabase,
  IconBox
} from "@tabler/icons-react";
import { useBuildpadTranslations as useBuildpadTranslations9 } from "@buildpad/services";
import { Fragment as Fragment2, jsx as jsx9, jsxs as jsxs9 } from "react/jsx-runtime";
function CollectionIcon({ icon, color }) {
  const iconColor = color || void 0;
  const size = 18;
  switch (icon) {
    case "box":
      return /* @__PURE__ */ jsx9(IconBox, { size, color: iconColor });
    case "folder":
    case "folder_open":
      return /* @__PURE__ */ jsx9(IconFolder, { size, color: iconColor });
    case "database":
      return /* @__PURE__ */ jsx9(IconDatabase, { size, color: iconColor });
    default:
      return /* @__PURE__ */ jsx9(IconTable, { size, color: iconColor });
  }
}
function NavigationItem({
  node,
  currentCollection,
  activeGroups,
  onToggleGroup,
  onNavigate,
  bookmarks,
  onBookmarkClick,
  onEditCollection,
  isAdmin,
  search,
  dense,
  t
}) {
  const isGroup = node.children.length > 0;
  const isExpanded = activeGroups.includes(node.collection);
  const isActive = currentCollection === node.collection;
  const isLocked = node.meta?.collapse === "locked";
  const isHidden = node.meta?.hidden;
  const hasSchema = !!node.schema;
  const collectionBookmarks = useMemo4(
    () => (bookmarks || []).filter((b) => b.collection === node.collection),
    [bookmarks, node.collection]
  );
  const hasBookmarks = collectionBookmarks.length > 0;
  const isGroupWithContent = isGroup || hasBookmarks;
  const matchesSearch = useMemo4(() => {
    if (!search || search.length < 3) return true;
    const q = search.toLowerCase();
    const selfMatch = node.collection.toLowerCase().includes(q) || (node.name || "").toLowerCase().includes(q);
    if (selfMatch) return true;
    function childMatches(children) {
      return children.some(
        (child) => child.collection.toLowerCase().includes(q) || (child.name || "").toLowerCase().includes(q) || childMatches(child.children)
      );
    }
    const bookmarkMatch = collectionBookmarks.some(
      (b) => b.bookmark?.toLowerCase().includes(q)
    );
    return childMatches(node.children) || bookmarkMatch;
  }, [search, node, collectionBookmarks]);
  if (!matchesSearch) return null;
  const handleClick = () => {
    if (hasSchema) {
      onNavigate(node.collection);
    }
  };
  const handleGroupToggle = () => {
    if (isGroupWithContent && !isLocked) {
      onToggleGroup(node.collection);
    }
  };
  const label = /* @__PURE__ */ jsx9(Group9, { gap: 4, wrap: "nowrap", children: /* @__PURE__ */ jsx9(
    Text6,
    {
      size: dense ? "sm" : void 0,
      fw: isActive ? 600 : 400,
      c: isHidden ? "dimmed" : void 0,
      truncate: true,
      children: node.name || node.collection
    }
  ) });
  const contextMenu = isAdmin && hasSchema ? /* @__PURE__ */ jsxs9(Menu4, { shadow: "md", width: 200, position: "bottom-start", withArrow: true, children: [
    /* @__PURE__ */ jsx9(Menu4.Target, { children: /* @__PURE__ */ jsx9(
      ActionIcon6,
      {
        variant: "subtle",
        size: "xs",
        onClick: (e) => {
          e.stopPropagation();
        },
        style: { opacity: 0, transition: "opacity 150ms" },
        className: "nav-item-action",
        "aria-label": t.collectionOptions,
        children: /* @__PURE__ */ jsx9(IconSettings, { size: 14 })
      }
    ) }),
    /* @__PURE__ */ jsx9(Menu4.Dropdown, { children: /* @__PURE__ */ jsx9(
      Menu4.Item,
      {
        leftSection: /* @__PURE__ */ jsx9(IconDatabase, { size: 14 }),
        onClick: () => onEditCollection?.(node.collection),
        children: t.editCollection
      }
    ) })
  ] }) : null;
  if (isGroupWithContent) {
    return /* @__PURE__ */ jsx9(Fragment2, { children: /* @__PURE__ */ jsxs9(
      NavLink,
      {
        label,
        leftSection: /* @__PURE__ */ jsx9(CollectionIcon, { icon: node.icon, color: node.color }),
        rightSection: /* @__PURE__ */ jsxs9(Group9, { gap: 4, children: [
          contextMenu,
          !isLocked && /* @__PURE__ */ jsx9(
            IconChevronRight,
            {
              size: 14,
              style: {
                transform: isExpanded ? "rotate(90deg)" : void 0,
                transition: "transform 150ms"
              }
            }
          )
        ] }),
        active: isActive,
        opened: isExpanded,
        onClick: () => {
          handleClick();
          handleGroupToggle();
        },
        py: dense ? 4 : 6,
        styles: {
          root: {
            "&:hover .nav-item-action": {
              opacity: 1
            }
          }
        },
        children: [
          node.children.map((child) => /* @__PURE__ */ jsx9(
            NavigationItem,
            {
              node: child,
              currentCollection,
              activeGroups,
              onToggleGroup,
              onNavigate,
              bookmarks,
              onBookmarkClick,
              onEditCollection,
              isAdmin,
              search,
              dense,
              t
            },
            child.collection
          )),
          collectionBookmarks.map((bookmark) => /* @__PURE__ */ jsx9(
            NavLink,
            {
              label: /* @__PURE__ */ jsx9(Text6, { size: "sm", truncate: true, children: bookmark.bookmark || t.untitledBookmark }),
              leftSection: /* @__PURE__ */ jsx9(
                IconBookmark,
                {
                  size: 16,
                  color: bookmark.color || void 0,
                  fill: bookmark.color || "none"
                }
              ),
              onClick: () => onBookmarkClick?.(bookmark),
              py: dense ? 3 : 5
            },
            bookmark.id
          ))
        ]
      }
    ) });
  }
  return /* @__PURE__ */ jsx9(
    NavLink,
    {
      label,
      leftSection: /* @__PURE__ */ jsx9(CollectionIcon, { icon: node.icon, color: node.color }),
      rightSection: contextMenu,
      active: isActive,
      onClick: handleClick,
      py: dense ? 4 : 6,
      styles: {
        root: {
          "&:hover .nav-item-action": {
            opacity: 1
          }
        }
      }
    }
  );
}
var ContentNavigation = ({
  currentCollection,
  rootCollections,
  activeGroups,
  onToggleGroup,
  showHidden = false,
  onToggleHidden,
  hasHiddenCollections = false,
  showSearch = false,
  dense = false,
  bookmarks,
  onNavigate,
  onBookmarkClick,
  onEditCollection,
  isAdmin = false,
  loading = false,
  onSearchChange,
  translations
}) => {
  const [search, setSearch] = useState4("");
  const t = useBuildpadTranslations9((d) => d.collections.navigation, translations?.navigation);
  const handleSearchChange = useCallback4(
    (value) => {
      setSearch(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );
  if (loading) {
    return /* @__PURE__ */ jsx9(Stack5, { gap: "xs", p: "md", children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ jsx9(
      Box,
      {
        h: dense ? 28 : 36,
        bg: "var(--mantine-color-gray-1)",
        style: { borderRadius: "var(--mantine-radius-sm)", animation: "pulse 1.5s ease-in-out infinite" }
      },
      i
    )) });
  }
  if (rootCollections.length === 0) {
    return /* @__PURE__ */ jsxs9(Stack5, { gap: "md", p: "md", align: "center", justify: "center", style: { minHeight: 200 }, children: [
      /* @__PURE__ */ jsx9(IconBox, { size: 48, color: "var(--mantine-color-gray-5)" }),
      /* @__PURE__ */ jsx9(Text6, { c: "dimmed", ta: "center", size: "sm", children: t.emptyState.title }),
      isAdmin && /* @__PURE__ */ jsx9(Text6, { c: "dimmed", ta: "center", size: "xs", children: t.emptyState.adminHint })
    ] });
  }
  return /* @__PURE__ */ jsxs9(Stack5, { gap: 0, style: { minHeight: "100%" }, children: [
    showSearch && /* @__PURE__ */ jsx9(Box, { p: "sm", pb: 0, style: { position: "sticky", top: 0, zIndex: 1 }, children: /* @__PURE__ */ jsx9(
      TextInput3,
      {
        value: search,
        onChange: (e) => handleSearchChange(e.currentTarget.value),
        placeholder: t.searchPlaceholder,
        leftSection: /* @__PURE__ */ jsx9(IconSearch2, { size: 16 }),
        size: dense ? "xs" : "sm",
        type: "search"
      }
    ) }),
    /* @__PURE__ */ jsx9(ScrollArea, { style: { flex: 1 }, p: "xs", children: /* @__PURE__ */ jsx9("nav", { children: rootCollections.map((node) => /* @__PURE__ */ jsx9(
      NavigationItem,
      {
        node,
        currentCollection,
        activeGroups,
        onToggleGroup,
        onNavigate,
        bookmarks,
        onBookmarkClick,
        onEditCollection,
        isAdmin,
        search,
        dense,
        t
      },
      node.collection
    )) }) }),
    hasHiddenCollections && onToggleHidden && /* @__PURE__ */ jsx9(
      Box,
      {
        p: "xs",
        style: {
          borderTop: "1px solid var(--mantine-color-default-border)",
          position: "sticky",
          bottom: 0
        },
        children: /* @__PURE__ */ jsxs9(
          UnstyledButton,
          {
            onClick: onToggleHidden,
            style: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "4px 8px" },
            children: [
              showHidden ? /* @__PURE__ */ jsx9(IconEyeOff2, { size: 16 }) : /* @__PURE__ */ jsx9(IconEye, { size: 16 }),
              /* @__PURE__ */ jsx9(Text6, { size: "xs", c: "dimmed", children: showHidden ? t.hideHiddenCollections : t.showHiddenCollections })
            ]
          }
        )
      }
    )
  ] });
};

// src/ContentLayout.tsx
import { useCallback as useCallback5 } from "react";
import {
  AppShell,
  Group as Group10,
  ActionIcon as ActionIcon7,
  Title,
  Breadcrumbs,
  Anchor,
  Burger,
  Box as Box2,
  ScrollArea as ScrollArea2,
  Skeleton
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import {
  IconMenu2,
  IconChevronRight as IconChevronRight2
} from "@tabler/icons-react";
import { jsx as jsx10, jsxs as jsxs10 } from "react/jsx-runtime";
var ContentLayout = ({
  title,
  icon,
  iconColor,
  breadcrumbs,
  showBack = false,
  onBack,
  showHeaderShadow = false,
  sidebar,
  sidebarDetail,
  actions,
  titleAppend,
  headline,
  loading = false,
  sidebarWidth = 260,
  detailWidth = 284,
  children
}) => {
  const [sidebarOpened, { toggle: toggleSidebar }] = useDisclosure(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const handleBreadcrumbClick = useCallback5(
    (e, href) => {
      if (!href) e.preventDefault();
    },
    []
  );
  return /* @__PURE__ */ jsxs10(
    AppShell,
    {
      navbar: {
        width: sidebarWidth,
        breakpoint: "sm",
        collapsed: { mobile: !sidebarOpened, desktop: !sidebarOpened }
      },
      aside: sidebarDetail ? {
        width: detailWidth,
        breakpoint: "md",
        collapsed: { mobile: true, desktop: false }
      } : void 0,
      padding: 0,
      children: [
        /* @__PURE__ */ jsx10(AppShell.Navbar, { p: 0, children: /* @__PURE__ */ jsx10(AppShell.Section, { grow: true, component: ScrollArea2, children: sidebar }) }),
        /* @__PURE__ */ jsxs10(AppShell.Main, { children: [
          /* @__PURE__ */ jsxs10(
            Box2,
            {
              py: "sm",
              px: "md",
              style: {
                borderBottom: "1px solid var(--mantine-color-default-border)",
                boxShadow: showHeaderShadow ? "var(--ds-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))" : void 0,
                transition: "box-shadow 150ms ease",
                position: "sticky",
                top: 0,
                zIndex: 100,
                backgroundColor: "var(--mantine-color-body)"
              },
              children: [
                (breadcrumbs || headline) && /* @__PURE__ */ jsxs10(Group10, { gap: 4, mb: 4, children: [
                  isMobile && /* @__PURE__ */ jsx10(
                    Burger,
                    {
                      opened: sidebarOpened,
                      onClick: toggleSidebar,
                      size: "sm",
                      hiddenFrom: "sm"
                    }
                  ),
                  !isMobile && !sidebarOpened && /* @__PURE__ */ jsx10(ActionIcon7, { variant: "subtle", onClick: toggleSidebar, size: "sm", mr: 4, children: /* @__PURE__ */ jsx10(IconMenu2, { size: 16 }) }),
                  breadcrumbs && breadcrumbs.length > 0 && /* @__PURE__ */ jsx10(
                    Breadcrumbs,
                    {
                      separator: /* @__PURE__ */ jsx10(IconChevronRight2, { size: 12 }),
                      style: { fontSize: "var(--mantine-font-size-xs)" },
                      children: breadcrumbs.map((item, idx) => /* @__PURE__ */ jsx10(
                        Anchor,
                        {
                          href: item.href || "#",
                          size: "xs",
                          c: "dimmed",
                          onClick: (e) => handleBreadcrumbClick(e, item.href),
                          children: item.label
                        },
                        `${item.href ?? item.label}-${idx}`
                      ))
                    }
                  ),
                  headline
                ] }),
                /* @__PURE__ */ jsxs10(Group10, { justify: "space-between", wrap: "nowrap", children: [
                  /* @__PURE__ */ jsxs10(Group10, { gap: "sm", wrap: "nowrap", style: { minWidth: 0 }, children: [
                    showBack && onBack && /* @__PURE__ */ jsx10(ActionIcon7, { variant: "subtle", onClick: onBack, size: "md", children: /* @__PURE__ */ jsx10(
                      IconChevronRight2,
                      {
                        size: 18,
                        style: { transform: "rotate(180deg)" }
                      }
                    ) }),
                    icon && /* @__PURE__ */ jsx10(Box2, { c: iconColor, style: { display: "flex", alignItems: "center" }, children: icon }),
                    loading ? /* @__PURE__ */ jsx10(Skeleton, { width: 200, height: 28 }) : title && /* @__PURE__ */ jsx10(Title, { order: 3, lineClamp: 1, style: { minWidth: 0 }, children: title }),
                    titleAppend
                  ] }),
                  actions && /* @__PURE__ */ jsx10(Group10, { gap: "xs", wrap: "nowrap", children: actions })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsx10(Box2, { style: { flex: 1 }, children })
        ] }),
        sidebarDetail && /* @__PURE__ */ jsx10(AppShell.Aside, { p: "md", children: /* @__PURE__ */ jsx10(AppShell.Section, { grow: true, component: ScrollArea2, children: sidebarDetail }) })
      ]
    }
  );
};
export {
  CollectionForm,
  CollectionList,
  ContentLayout,
  ContentNavigation,
  EXTRAS_COLUMN,
  FilterPanel,
  SaveOptions,
  extractExtras,
  flattenExtras,
  mergeExtras,
  missingExtrasColumnMessage
};
