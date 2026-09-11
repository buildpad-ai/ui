"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CollectionForm: () => CollectionForm,
  CollectionList: () => CollectionList,
  ContentLayout: () => ContentLayout,
  ContentNavigation: () => ContentNavigation,
  EXTRAS_COLUMN: () => EXTRAS_COLUMN,
  FilterPanel: () => FilterPanel,
  SaveOptions: () => SaveOptions,
  extractExtras: () => extractExtras,
  flattenExtras: () => flattenExtras,
  mergeExtras: () => mergeExtras,
  missingExtrasColumnMessage: () => missingExtrasColumnMessage
});
module.exports = __toCommonJS(index_exports);

// src/CollectionForm.tsx
var import_core2 = require("@mantine/core");
var import_services2 = require("@buildpad/services");
var import_utils2 = require("@buildpad/utils");
var import_ui_form = require("@buildpad/ui-form");
var import_icons_react2 = require("@tabler/icons-react");
var import_react = require("react");

// src/SaveOptions.tsx
var import_core = require("@mantine/core");
var import_icons_react = require("@tabler/icons-react");
var import_services = require("@buildpad/services");
var import_jsx_runtime = require("react/jsx-runtime");
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
  const t = (0, import_services.useBuildpadTranslations)((d) => d.collections.saveOptions, translations?.saveOptions);
  const isMac = platform ? platform === "mac" : typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const metaKey = isMac ? "\u2318" : t.kbd.ctrl;
  const isDisabled = (action) => disabledOptions.includes(action);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_core.Menu, { shadow: "md", width: 280, position: "bottom-end", withArrow: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Menu.Target, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_core.ActionIcon,
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
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_icons_react.IconChevronDown, { size: 14 })
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_core.Menu.Dropdown, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_core.Menu.Item,
        {
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_icons_react.IconDeviceFloppy, { size: 16 }),
          disabled: isDisabled("save-and-stay"),
          onClick: onSaveAndStay,
          rightSection: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_core.Group, { gap: 2, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Kbd, { size: "xs", children: metaKey }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Kbd, { size: "xs", children: "S" })
          ] }),
          children: t.saveAndStay
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_core.Menu.Item,
        {
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_icons_react.IconPlus, { size: 16 }),
          disabled: isDisabled("save-and-add-new"),
          onClick: onSaveAndAddNew,
          rightSection: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_core.Group, { gap: 2, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Kbd, { size: "xs", children: metaKey }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Kbd, { size: "xs", children: "\u21E7" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Kbd, { size: "xs", children: "S" })
          ] }),
          children: t.saveAndCreateNew
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_core.Menu.Item,
        {
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_icons_react.IconCopy, { size: 16 }),
          disabled: isDisabled("save-as-copy"),
          onClick: onSaveAsCopy,
          children: t.saveAsCopy
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Menu.Divider, {}),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_core.Menu.Item,
        {
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_icons_react.IconArrowBack, { size: 16 }),
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
var import_utils = require("@buildpad/utils");
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
function missingExtrasColumnMessage(collection, template = import_utils.defaultTranslations.collections.form.errors.missingExtrasColumn) {
  return (0, import_utils.interpolate)(template, { collection, extrasColumn: EXTRAS_COLUMN });
}

// src/CollectionForm.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  const t = (0, import_services2.useBuildpadTranslations)((d) => d.collections, translations);
  const definitionSignature = (0, import_react.useMemo)(
    () => definition ? JSON.stringify(definition) : "",
    [definition]
  );
  const stableDefaultValues = (0, import_react.useMemo)(
    () => defaultValues || EMPTY_OBJECT,
    [defaultValues]
  );
  const stableExcludeFields = (0, import_react.useMemo)(
    () => excludeFields || EMPTY_ARRAY,
    [excludeFields]
  );
  const stableIncludeFields = (0, import_react.useMemo)(() => includeFields, [includeFields]);
  const [fields, setFields] = (0, import_react.useState)([]);
  const [resolvedPk, setResolvedPk] = (0, import_react.useState)("id");
  const [manualPrimaryKeyField, setManualPrimaryKeyField] = (0, import_react.useState)(null);
  const [formData, setFormData] = (0, import_react.useState)(stableDefaultValues);
  const [initialFormData, setInitialFormData] = (0, import_react.useState)(stableDefaultValues);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [success, setSuccess] = (0, import_react.useState)(false);
  const [fieldErrors, setFieldErrors] = (0, import_react.useState)({});
  const [createAllowed, setCreateAllowed] = (0, import_react.useState)(true);
  const [updateAllowed, setUpdateAllowed] = (0, import_react.useState)(true);
  const [deleteAllowed, setDeleteAllowed] = (0, import_react.useState)(false);
  const [hasExtrasColumn, setHasExtrasColumn] = (0, import_react.useState)(true);
  const [m2mJunctionMap, setM2mJunctionMap] = (0, import_react.useState)({});
  const [deleting, setDeleting] = (0, import_react.useState)(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = (0, import_react.useState)(false);
  const dataLoadedRef = (0, import_react.useRef)(false);
  const lastLoadKey = (0, import_react.useRef)("");
  (0, import_react.useEffect)(() => {
    const loadKey = `${collection}-${id}-${mode}-${definitionSignature}`;
    if (dataLoadedRef.current && lastLoadKey.current === loadKey) {
      return;
    }
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setFieldErrors({});
        const fieldsService = new import_services2.FieldsService();
        const [allFields, collectionAccess] = await Promise.all([
          fieldsService.readAll(collection),
          import_services2.PermissionsService.getMyCollectionAccess().catch(() => ({}))
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
        const isAdmin = import_services2.PermissionsService.isAdmin;
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
          editableFields = (0, import_utils2.buildFieldsFromDefinition)(editableFields, definition);
        }
        setFields(editableFields);
        const m2mAliasFields = editableFields.filter(
          (f) => f.type === "alias" && f.meta?.special?.includes?.("m2m")
        );
        if (m2mAliasFields.length > 0) {
          try {
            const relationsResp = await (0, import_services2.apiRequest)("/api/relations");
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
                  const fieldsResp = await (0, import_services2.apiRequest)(`/api/fields/${info.junctionCollection}`);
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
          const schemaDefaults = (0, import_utils2.getDefaultValuesFromFields)(seedableFields);
          const presets = actionAccess?.presets;
          if (presets && typeof presets === "object") {
            initialData = { ...presets, ...initialData };
          }
          initialData = { ...schemaDefaults, ...initialData };
        }
        if (mode === "edit" && id) {
          const itemsService = new import_services2.ItemsService(collection);
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
  const hasEdits = (0, import_react.useMemo)(() => {
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
  const saveAllowed = (0, import_react.useMemo)(() => {
    if (mode === "create") return createAllowed;
    return updateAllowed;
  }, [mode, createAllowed, updateAllowed]);
  const isSavable = (0, import_react.useMemo)(() => {
    return saveAllowed && (mode === "create" || hasEdits);
  }, [saveAllowed, mode, hasEdits]);
  const extrasFieldNames = (0, import_react.useMemo)(
    () => new Set(
      fields.filter((f) => f.meta?.store === "extras").map((f) => f.field)
    ),
    [fields]
  );
  const disabledSaveOptions = (0, import_react.useMemo)(() => {
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
  const handleFormUpdate = (0, import_react.useCallback)((values) => {
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
      const junctionService = new import_services2.ItemsService(junctionCollection);
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
            (0, import_utils2.interpolate)(t.form.errors.junctionUpdateMissingKey, {
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
      const itemsService = new import_services2.ItemsService(collection);
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
            if ((0, import_utils2.isConcealedValue)(val)) delete copyData[key];
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
  const handleDiscard = (0, import_react.useCallback)(() => {
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
      const itemsService = new import_services2.ItemsService(collection);
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
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Paper, { p: "md", pos: "relative", mih: 200, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.LoadingOverlay, { visible: true }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Paper, { p: "md", "data-testid": "collection-form", children: [
    error && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_core2.Alert,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconAlertCircle, { size: 16 }),
        color: "red",
        mb: "md",
        "data-testid": "form-error",
        children: error
      }
    ),
    success && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_core2.Alert,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconCheck, { size: 16 }),
        color: "green",
        mb: "md",
        "data-testid": "form-success",
        children: !persist ? t.form.success.previewOnly : mode === "create" ? t.form.success.created : t.form.success.updated
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("form", { onSubmit: handleSubmit, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Stack, { gap: "md", children: [
      fields.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Text, { c: "dimmed", ta: "center", py: "xl", children: !saveAllowed ? (0, import_utils2.interpolate)(
        mode === "create" ? t.form.emptyState.noPermissionCreate : t.form.emptyState.noPermissionEdit,
        { collection }
      ) : (0, import_utils2.interpolate)(t.form.emptyState.noEditableFields, { collection }) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_ui_form.VForm,
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
        Object.keys(fieldErrors).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Stack, { gap: 4, "data-testid": "form-field-errors", children: Object.entries(fieldErrors).map(([field, msg]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_core2.Alert,
          {
            icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconAlertCircle, { size: 14 }),
            color: "red",
            variant: "light",
            p: "xs",
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Text, { size: "sm", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: field }),
              ": ",
              msg
            ] })
          },
          field
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Group, { justify: "flex-end", mt: "md", children: [
        canShowDelete && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_core2.Button,
          {
            variant: "subtle",
            color: "red",
            onClick: () => setDeleteConfirmOpen(true),
            leftSection: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconTrash, { size: 16 }),
            disabled: saving || deleting,
            "data-testid": "form-delete-btn",
            style: { marginRight: "auto" },
            children: t.form.actions.delete
          }
        ),
        onCancel && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_core2.Button,
          {
            variant: "subtle",
            onClick: onCancel,
            leftSection: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconX, { size: 16 }),
            disabled: saving,
            "data-testid": "form-cancel-btn",
            children: t.form.actions.cancel
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Group, { gap: 0, style: { gap: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            import_core2.Button,
            {
              type: "submit",
              loading: saving,
              disabled: !isSavable || fields.length === 0,
              leftSection: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_icons_react2.IconCheck, { size: 16 }),
              "data-testid": "form-submit-btn",
              style: showSaveOptions ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : void 0,
              children: mode === "create" ? t.form.actions.create : t.form.actions.save
            }
          ),
          showSaveOptions && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_core2.Modal,
      {
        opened: deleteConfirmOpen,
        onClose: () => setDeleteConfirmOpen(false),
        title: t.form.deleteConfirm.title,
        centered: true,
        size: "sm",
        "data-testid": "delete-confirm-modal",
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Stack, { gap: "md", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Text, { size: "sm", children: t.form.deleteConfirm.message }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Group, { justify: "flex-end", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_core2.Button,
              {
                variant: "default",
                onClick: () => setDeleteConfirmOpen(false),
                disabled: deleting,
                children: t.form.deleteConfirm.cancel
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              import_core2.Button,
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
var import_core8 = require("@mantine/core");
var import_services8 = require("@buildpad/services");
var import_utils3 = require("@buildpad/utils");
var import_ui_table = require("@buildpad/ui-table");
var import_icons_react6 = require("@tabler/icons-react");
var import_react3 = require("react");

// src/CollectionListFooter.tsx
var import_core3 = require("@mantine/core");
var import_services3 = require("@buildpad/services");
var import_jsx_runtime3 = require("react/jsx-runtime");
var CollectionListFooter = ({
  itemCountDisplay,
  limit,
  onLimitChange,
  page,
  onPageChange,
  totalPages,
  translations
}) => {
  const t = (0, import_services3.useBuildpadTranslations)((d) => d.collections, translations);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "collection-list-footer", "data-testid": "collection-list-footer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_core3.Text, { size: "sm", c: "dimmed", "data-testid": "collection-list-footer-count", children: itemCountDisplay }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_core3.Group, { gap: "sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_core3.Group, { gap: 4, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_core3.Text, { size: "xs", c: "dimmed", children: t.listFooter.perPage }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_core3.Select,
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
      totalPages > 1 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_core3.Pagination,
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
var import_core5 = require("@mantine/core");
var import_icons_react4 = require("@tabler/icons-react");
var import_services5 = require("@buildpad/services");

// src/BulkActionsBar.tsx
var import_core4 = require("@mantine/core");
var import_icons_react3 = require("@tabler/icons-react");
var import_services4 = require("@buildpad/services");
var import_jsx_runtime4 = require("react/jsx-runtime");
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
  const t = (0, import_services4.useBuildpadTranslations)((d) => d.collections, translations);
  const common = (0, import_services4.useBuildpadTranslations)((d) => d.common);
  const { formatCount } = (0, import_services4.useBuildpadI18n)();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_core4.Group, { gap: "xs", "data-testid": "collection-list-bulk-actions", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_core4.Badge, { variant: "light", size: "lg", children: formatCount(selectedIds.length, t.bulkActions.selectedCount) }),
    enableDelete && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_core4.Tooltip, { label: deleteAllowed ? t.bulkActions.deleteSelectedTooltip : common.notAllowed, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_core4.Button,
      {
        variant: "light",
        color: "red",
        size: "compact-sm",
        leftSection: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_icons_react3.IconTrash, { size: 16 }),
        onClick: () => deleteAllowed && onDeleteRequest(selectedIds),
        disabled: !deleteAllowed,
        "data-testid": "bulk-action-delete",
        children: t.bulkActions.delete
      }
    ) }),
    bulkActions.map((action, index) => {
      const permKey = action.requiredPermission;
      const permAllowed = !permKey || permKey === "create" && createAllowed || permKey === "update" && updateAllowed || permKey === "delete" && deleteAllowed;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        import_core4.Tooltip,
        {
          label: permAllowed ? action.label : common.notAllowed,
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            import_core4.Button,
            {
              variant: "light",
              color: action.color,
              size: "compact-sm",
              leftSection: action.icon || (action.requiredPermission === "delete" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_icons_react3.IconTrash, { size: 16 }) : action.requiredPermission === "update" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_icons_react3.IconEdit, { size: 16 }) : (
                // NOSONAR: idiomatic tri-state ternary, not confusing nesting
                action.requiredPermission === "create" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_icons_react3.IconPlus, { size: 16 }) : (
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
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_core4.ActionIcon,
      {
        variant: "subtle",
        onClick: onClearSelection,
        title: t.bulkActions.clearSelection,
        "data-testid": "collection-list-clear-selection",
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_icons_react3.IconX, { size: 16 })
      }
    )
  ] });
};

// src/CollectionListToolbar.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
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
  const t = (0, import_services5.useBuildpadTranslations)((d) => d.collections, translations);
  const common = (0, import_services5.useBuildpadTranslations)((d) => d.common);
  const showBulkActions = enableSelection && selectedIds.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "collection-list-toolbar", "data-testid": "collection-list-toolbar", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_core5.Group, { gap: "xs", children: [
      enableSearch && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_core5.TextInput,
        {
          placeholder: t.listToolbar.searchPlaceholder,
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconSearch, { size: 16 }),
          value: search,
          onChange: (e) => onSearchChange(e.currentTarget.value),
          rightSection: search ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            import_core5.ActionIcon,
            {
              variant: "subtle",
              size: "xs",
              onClick: () => onSearchChange(""),
              "aria-label": t.listToolbar.clearSearch,
              children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconX, { size: 12 })
            }
          ) : void 0,
          size: "sm",
          className: "collection-list-search",
          "data-testid": "collection-list-search"
        }
      ),
      enableFilter && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_core5.Tooltip, { label: filterPanelOpen ? t.listToolbar.hideFilters : t.listToolbar.showFilters, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        import_core5.ActionIcon,
        {
          variant: activeFilterCount > 0 ? "filled" : "subtle",
          color: activeFilterCount > 0 ? "primary" : void 0,
          onClick: onToggleFilterPanel,
          title: t.listToolbar.toggleFilterPanel,
          "data-testid": "collection-list-filter-toggle",
          pos: "relative",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconFilter, { size: 16 }),
            activeFilterCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              import_core5.Badge,
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
      archiveField && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_core5.Select,
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
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconArchive, { size: 14 }),
          "data-testid": "collection-list-archive-filter",
          style: { width: 160 }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_core5.ActionIcon,
        {
          variant: "subtle",
          onClick: onRefresh,
          title: t.listToolbar.refresh,
          "data-testid": "collection-list-refresh",
          children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconRefresh, { size: 16 })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_core5.Group, { gap: "xs", children: [
      showBulkActions && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
      enableCreate && onCreate && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_core5.Tooltip, { label: createAllowed ? t.listToolbar.createItem : common.notAllowed, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        import_core5.Button,
        {
          variant: "filled",
          size: "compact-sm",
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_icons_react4.IconPlus, { size: 18 }),
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
var import_core6 = require("@mantine/core");
var import_services6 = require("@buildpad/services");
var import_jsx_runtime6 = require("react/jsx-runtime");
var DeleteConfirmModal = ({
  opened,
  count,
  loading,
  onConfirm,
  onCancel,
  translations
}) => {
  const t = (0, import_services6.useBuildpadTranslations)((d) => d.collections, translations);
  const { formatCount } = (0, import_services6.useBuildpadI18n)();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_core6.Modal,
    {
      opened,
      onClose: onCancel,
      title: t.deleteConfirm.title,
      centered: true,
      size: "sm",
      "data-testid": "delete-confirm-modal",
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Stack, { gap: "md", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Text, { size: "sm", children: formatCount(count, t.deleteConfirm.message) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Group, { justify: "flex-end", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            import_core6.Button,
            {
              variant: "default",
              onClick: onCancel,
              disabled: loading,
              children: t.deleteConfirm.cancel
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            import_core6.Button,
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
var import_react2 = require("react");
var import_core7 = require("@mantine/core");
var import_icons_react5 = require("@tabler/icons-react");
var import_services7 = require("@buildpad/services");
var import_jsx_runtime7 = require("react/jsx-runtime");
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
  const fieldData = (0, import_react2.useMemo)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", wrap: "nowrap", "data-testid": "filter-rule", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_core7.Select,
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
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_core7.Select,
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
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          import_core7.NumberInput,
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
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          import_core7.Select,
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
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_core7.TextInput,
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
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_core7.ActionIcon,
      {
        variant: "subtle",
        color: "red",
        size: "sm",
        onClick: onRemove,
        disabled,
        title: t.rule.remove,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconTrash, { size: 14 })
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
  const t = (0, import_services7.useBuildpadTranslations)((d) => d.collections.filterPanel, translations?.filterPanel);
  const { formatCount } = (0, import_services7.useBuildpadI18n)();
  const [collapsed, setCollapsed] = (0, import_react2.useState)(defaultCollapsed);
  const [rootGroup, setRootGroup] = (0, import_react2.useState)(() => {
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
  const emitChange = (0, import_react2.useCallback)((group) => {
    setRootGroup(group);
    if (group.rules.length === 0) {
      onChange?.(null);
    } else {
      const nodes = rulesToDaaS(group.rules);
      onChange?.({ [group.logical]: nodes });
    }
  }, [onChange]);
  const addGroup = (0, import_react2.useCallback)(() => {
    const newGroup = {
      id: uid(),
      logical: "_and",
      rules: []
    };
    emitChange({ ...rootGroup, rules: [...rootGroup.rules, newGroup] });
  }, [rootGroup, emitChange]);
  const updateRule = (0, import_react2.useCallback)((index, updated) => {
    const newRules = [...rootGroup.rules];
    newRules[index] = updated;
    emitChange({ ...rootGroup, rules: newRules });
  }, [rootGroup, emitChange]);
  const removeRule = (0, import_react2.useCallback)((index) => {
    emitChange({ ...rootGroup, rules: rootGroup.rules.filter((_, i) => i !== index) });
  }, [rootGroup, emitChange]);
  const clearAll = (0, import_react2.useCallback)(() => {
    emitChange({ ...rootGroup, rules: [] });
  }, [rootGroup, emitChange]);
  const toggleLogical = (0, import_react2.useCallback)(() => {
    emitChange({ ...rootGroup, logical: rootGroup.logical === "_and" ? "_or" : "_and" });
  }, [rootGroup, emitChange]);
  const filterCount = rootGroup.rules.length;
  if (collapsible && collapsed) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", "data-testid": "filter-panel-collapsed", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_core7.Button,
        {
          variant: "subtle",
          size: "xs",
          leftSection: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconFilter, { size: 14 }),
          rightSection: filterCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Badge, { size: "xs", circle: true, children: filterCount }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconChevronDown, { size: 14 }),
          onClick: () => setCollapsed(false),
          children: t.title
        }
      ),
      filterCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.ActionIcon, { variant: "subtle", size: "xs", color: "dimmed", onClick: clearAll, title: t.clearAllFilters, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconX, { size: 12 }) })
    ] });
  }
  const content = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Stack, { gap: "xs", "data-testid": "filter-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { justify: "space-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconFilter, { size: 16, style: { color: "var(--mantine-color-dimmed)" } }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "sm", fw: 600, children: t.title }),
        filterCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Badge, { size: "xs", variant: "light", children: formatCount(filterCount, t.activeCount) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", children: [
        filterCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Button, { variant: "subtle", size: "xs", color: "dimmed", onClick: clearAll, children: t.clearAll }),
        collapsible && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.ActionIcon, { variant: "subtle", size: "xs", onClick: () => setCollapsed(true), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconChevronUp, { size: 14 }) })
      ] })
    ] }),
    rootGroup.rules.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "xs", c: "dimmed", children: t.match }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_core7.Button,
        {
          variant: rootGroup.logical === "_and" ? "filled" : "outline",
          size: "compact-xs",
          onClick: () => rootGroup.logical !== "_and" && toggleLogical(),
          children: t.matchAll
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_core7.Button,
        {
          variant: rootGroup.logical === "_or" ? "filled" : "outline",
          size: "compact-xs",
          onClick: () => rootGroup.logical !== "_or" && toggleLogical(),
          children: t.matchAny
        }
      )
    ] }),
    rootGroup.rules.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "sm", c: "dimmed", children: t.emptyState }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Stack, { gap: 6, children: rootGroup.rules.map((rule, index) => {
      if ("logical" in rule) {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Badge, { variant: "outline", size: "sm", children: formatCount(rule.rules.length, t.group.summary, {
            logical: rule.logical === "_and" ? t.group.and : t.group.or
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            import_core7.ActionIcon,
            {
              variant: "subtle",
              color: "red",
              size: "xs",
              onClick: () => removeRule(index),
              disabled,
              children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconTrash, { size: 12 })
            }
          )
        ] }, rule.id);
      }
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Menu, { position: "bottom-start", withArrow: true, shadow: "sm", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Menu.Target, { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Button, { variant: "subtle", size: "xs", leftSection: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_icons_react5.IconPlus, { size: 14 }), children: t.addFilter }) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Menu.Dropdown, { children: fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          import_core7.Menu.Item,
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
      maxDepth > 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Button, { variant: "subtle", size: "xs", color: "dimmed", onClick: addGroup, children: t.addGroup })
    ] })
  ] });
  if (mode === "inline") return content;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Paper, { withBorder: true, p: "sm", "data-testid": "filter-panel-container", children: content });
};

// src/CollectionList.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
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
  const t = (0, import_services8.useBuildpadTranslations)((d) => d.collections, translations);
  const { formatDate, formatDateTime, formatNumber, formatCount } = (0, import_services8.useBuildpadI18n)();
  const [allFields, setAllFields] = (0, import_react3.useState)([]);
  const [resolvedPk, setResolvedPk] = (0, import_react3.useState)(null);
  const primaryKeyField = primaryKeyFieldProp ?? resolvedPk ?? "id";
  const [visibleFieldKeys, setVisibleFieldKeys] = (0, import_react3.useState)([]);
  const [items, setItems] = (0, import_react3.useState)([]);
  const [totalCount, setTotalCount] = (0, import_react3.useState)(0);
  const [filterCount, setFilterCount] = (0, import_react3.useState)(0);
  const [selectedItems, setSelectedItems] = (0, import_react3.useState)([]);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [error, setError] = (0, import_react3.useState)(null);
  const [page, setPage] = (0, import_react3.useState)(1);
  const [limit, setLimit] = (0, import_react3.useState)(initialLimit);
  const [search, setSearch] = (0, import_react3.useState)("");
  const [sort, setSort] = (0, import_react3.useState)({ by: null, desc: false });
  const [archiveFilterMode, setArchiveFilterMode] = (0, import_react3.useState)("all");
  const [filterPanelOpen, setFilterPanelOpen] = (0, import_react3.useState)(false);
  const [internalFilter, setInternalFilter] = (0, import_react3.useState)(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = (0, import_react3.useState)(false);
  const [deletingIds, setDeletingIds] = (0, import_react3.useState)([]);
  const [deleteLoading, setDeleteLoading] = (0, import_react3.useState)(false);
  const [headerOverrides, setHeaderOverrides] = (0, import_react3.useState)({});
  const loadRequestRef = (0, import_react3.useRef)(0);
  const exactTotalRef = (0, import_react3.useRef)(null);
  const rowHeight = rowHeightProp ?? SPACING_HEIGHT[tableSpacing] ?? 48;
  const [createAllowed, setCreateAllowed] = (0, import_react3.useState)(true);
  const [updateAllowed, setUpdateAllowed] = (0, import_react3.useState)(true);
  const [deleteAllowed, setDeleteAllowed] = (0, import_react3.useState)(true);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    const loadFieldsAndPermissions = async () => {
      try {
        const [fieldsResult, collectionAccess] = await Promise.all([
          new import_services8.FieldsService().readAll(collection),
          import_services8.PermissionsService.getMyCollectionAccess().catch(() => ({}))
        ]);
        if (cancelled) return;
        const accessMap = collectionAccess ?? {};
        const access = accessMap[collection] || {};
        const isAdmin = import_services8.PermissionsService.isAdmin;
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
          setError((0, import_utils3.interpolate)(t.list.errors.noVisibleFields, { collection }));
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
  const mergedFilter = (0, import_react3.useMemo)(() => {
    const filters = [];
    if (filter && Object.keys(filter).length > 0) filters.push(filter);
    if (internalFilter && Object.keys(internalFilter).length > 0) filters.push(internalFilter);
    if (filters.length === 0) return null;
    if (filters.length === 1) return filters[0];
    return { _and: filters };
  }, [filter, internalFilter]);
  const activeFilterCount = (0, import_react3.useMemo)(() => {
    if (!internalFilter) return 0;
    const countRules = (obj) => {
      if (obj._and && Array.isArray(obj._and)) return obj._and.reduce((n, r) => n + countRules(r), 0);
      if (obj._or && Array.isArray(obj._or)) return obj._or.reduce((n, r) => n + countRules(r), 0);
      return 1;
    };
    return countRules(internalFilter);
  }, [internalFilter]);
  (0, import_react3.useEffect)(() => {
    setSelectedItems([]);
    setInternalFilter(null);
    setFilterPanelOpen(false);
    setSearch("");
    setPage(1);
  }, [collection]);
  (0, import_react3.useEffect)(() => {
    exactTotalRef.current = null;
  }, [collection, search, mergedFilter, archiveField, archiveFilterMode, archiveValue]);
  const loadItems = (0, import_react3.useCallback)(async () => {
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
      const rawResponse = await (0, import_services8.apiRequest)(`/api/items/${collection}${queryString ? `?${queryString}` : ""}`);
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
  const getTotalCount = (0, import_react3.useCallback)(async () => {
    try {
      const params = new URLSearchParams({
        "aggregate[count]": primaryKeyField
      });
      const response = await (0, import_services8.apiRequest)(`/api/items/${collection}?${params.toString()}`);
      const count = Number(response.data?.[0]?.count?.[primaryKeyField] ?? 0);
      setTotalCount(count);
    } catch {
    }
  }, [collection, primaryKeyField]);
  (0, import_react3.useEffect)(() => {
    if (visibleFieldKeys.length > 0) {
      loadItems();
    }
  }, [loadItems, visibleFieldKeys.length]);
  (0, import_react3.useEffect)(() => {
    if (primaryKeyFieldProp || resolvedPk) {
      getTotalCount();
    }
  }, [getTotalCount, primaryKeyFieldProp, resolvedPk]);
  (0, import_react3.useEffect)(() => {
    setPage(1);
  }, [search, filter, internalFilter]);
  const permittedFields = (0, import_react3.useMemo)(() => allFields, [allFields]);
  const choicesByField = (0, import_react3.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    for (const f of permittedFields) {
      if (!(0, import_utils3.interfaceRequiresChoices)(f.meta?.interface ?? "")) continue;
      const raw = f.meta?.options?.choices;
      if (!Array.isArray(raw) || raw.length === 0) continue;
      map.set(f.field, raw);
    }
    return map;
  }, [permittedFields]);
  const headers = (0, import_react3.useMemo)(() => {
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
  const selectedIds = (0, import_react3.useMemo)(() => {
    return selectedItems.map(
      (item) => typeof item === "object" && item !== null ? item[primaryKeyField] : item
    );
  }, [selectedItems, primaryKeyField]);
  const addField = (0, import_react3.useCallback)(
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
  const removeField = (0, import_react3.useCallback)(
    (fieldKey) => {
      setVisibleFieldKeys((prev) => {
        const next = prev.filter((k) => k !== fieldKey);
        onFieldsChange?.(next);
        return next;
      });
    },
    [onFieldsChange]
  );
  const handleAlignChange = (0, import_react3.useCallback)(
    (fieldKey, align) => {
      setHeaderOverrides((prev) => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], align }
      }));
    },
    []
  );
  const handleSortChange = (0, import_react3.useCallback)(
    (newSort) => {
      const s = newSort ?? { by: null, desc: false };
      setSort(s);
      onSortChangeProp?.(s);
    },
    [onSortChangeProp]
  );
  const handleHeadersChange = (0, import_react3.useCallback)((newHeaders) => {
    const overrides = {};
    newHeaders.forEach((h) => {
      overrides[h.value] = {};
      if (h.width) overrides[h.value].width = h.width;
      if (h.align && h.align !== "left") overrides[h.value].align = h.align;
    });
    setHeaderOverrides((prev) => ({ ...prev, ...overrides }));
    setVisibleFieldKeys(newHeaders.map((h) => h.value));
  }, []);
  const renderHeaderContextMenu = (0, import_react3.useCallback)(
    (header) => {
      if (!enableHeaderMenu) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "collection-list-context-menu", role: "menu", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Menu.Label, { children: t.list.headerMenu.sort }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconSortAscending, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", children: t.list.headerMenu.sortAscending })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconSortDescending, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", children: t.list.headerMenu.sortDescending })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "collection-list-context-menu-divider" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Menu.Label, { children: t.list.headerMenu.alignment }),
        [
          {
            align: "left",
            icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconAlignLeft, { size: 14 }),
            label: t.list.headerMenu.alignLeft
          },
          {
            align: "center",
            icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconAlignCenter, { size: 14 }),
            label: t.list.headerMenu.alignCenter
          },
          {
            align: "right",
            icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconAlignRight, { size: 14 }),
            label: t.list.headerMenu.alignRight
          }
        ].map(({ align, icon, label }) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", children: label })
            ]
          },
          align
        )),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "collection-list-context-menu-divider" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
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
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconEyeOff, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", children: t.list.headerMenu.hideField })
            ]
          }
        )
      ] });
    },
    [enableHeaderMenu, handleSortChange, handleAlignChange, removeField, t]
  );
  const hiddenFields = (0, import_react3.useMemo)(() => {
    return permittedFields.filter((f) => !visibleFieldKeys.includes(f.field));
  }, [permittedFields, visibleFieldKeys]);
  const fieldTypeRenderCell = (0, import_react3.useCallback)(
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
        const arrayValue = (0, import_utils3.parseChoiceValues)(value, fieldChoices);
        if (arrayValue) {
          const entries = arrayValue.filter((v) => v !== null && v !== void 0);
          if (entries.length === 0) return null;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_core8.Group, { gap: 4, wrap: "nowrap", children: [
            entries.slice(0, 3).map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
              import_core8.Badge,
              {
                variant: "light",
                size: "sm",
                color: "gray",
                style: { textTransform: "none", minWidth: 0 },
                children: (0, import_utils3.resolveChoiceLabel)(fieldChoices, v) ?? String(v ?? "")
              },
              `${String(v)}-${i}`
            )),
            entries.length > 3 && // Never the element that gets clipped: it is last in a
            // nowrap row, so in a narrow column the count of what is
            // hidden would itself be the first thing hidden.
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "xs", c: "dimmed", style: { flexShrink: 0 }, children: (0, import_utils3.interpolate)(t.list.cell.moreChoices, { count: formatNumber(entries.length - 3) }) })
          ] });
        }
        const label = (0, import_utils3.resolveChoiceLabel)(fieldChoices, value);
        if (label !== void 0) {
          if (label === "") return null;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: label });
        }
        if (fieldType !== "json") {
          const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
          if (raw === "") return null;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: raw });
        }
      }
      if (fieldType === "boolean") {
        return value ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconCheck, { size: 16, color: "var(--mantine-color-green-6)", "aria-label": t.list.cell.booleanTrue }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconX, { size: 16, color: "var(--mantine-color-gray-4)", "aria-label": t.list.cell.booleanFalse });
      }
      if (fieldType === "timestamp" || fieldType === "dateTime" || fieldType === "date") {
        try {
          const dateObj = new Date(value);
          if (Number.isNaN(dateObj.getTime())) return null;
          if (fieldType === "date") {
            return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: formatDate(dateObj, { year: "numeric", month: "numeric", day: "numeric" }) });
          }
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: formatDateTime(dateObj, {
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
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: formatNumber(num) });
        }
        return null;
      }
      if (fieldType === "json") {
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Badge, { variant: "light", size: "sm", color: "gray", children: t.list.cell.jsonBadge });
      }
      if (fieldType === "uuid") {
        const str = typeof value === "object" ? JSON.stringify(value) : String(value);
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Tooltip, { label: str, openDelay: 300, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", style: { maxWidth: 120 }, children: (0, import_utils3.interpolate)(t.list.cell.truncated, { value: str.substring(0, 8) }) }) });
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
            return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Tooltip, { label: keyVal, openDelay: 300, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Badge, { variant: "light", size: "sm", color: "blue", style: { textTransform: "none", maxWidth: 120 }, children: (0, import_utils3.interpolate)(t.list.cell.truncated, { value: keyVal.substring(0, 8) }) }) });
          }
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Badge, { variant: "light", size: "sm", color: "blue", style: { textTransform: "none" }, children: keyVal });
        }
        return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", truncate: "end", children: typeof value === "object" ? JSON.stringify(value) : String(value) });
      }
      return null;
    },
    [permittedFields, choicesByField, t, formatDate, formatDateTime, formatNumber]
  );
  const renderHeaderAppend = (0, import_react3.useCallback)(() => {
    if (!enableAddField || hiddenFields.length === 0) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_core8.Menu, { position: "bottom-end", withArrow: true, shadow: "md", closeOnItemClick: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Menu.Target, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.ActionIcon, { variant: "subtle", size: "sm", title: t.list.addField.label, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconPlus, { size: 16 }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_core8.Menu.Dropdown, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Menu.Label, { children: t.list.addField.label }),
        hiddenFields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Menu.Item, { onClick: () => addField(f.field), children: f.meta?.note || f.field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) }, f.field))
      ] })
    ] });
  }, [enableAddField, hiddenFields, addField, t]);
  const handleFilterChange = (0, import_react3.useCallback)(
    (newFilter) => {
      setInternalFilter(newFilter);
      onFilterChange?.(newFilter);
    },
    [onFilterChange]
  );
  const handleClearFilter = (0, import_react3.useCallback)(() => {
    setInternalFilter(null);
    onFilterChange?.(null);
    setFilterPanelOpen(false);
  }, [onFilterChange]);
  const handleDeleteRequest = (0, import_react3.useCallback)(
    (ids) => {
      if (ids.length === 0) return;
      setDeletingIds(ids);
      setDeleteConfirmOpen(true);
    },
    []
  );
  const handleDeleteConfirm = (0, import_react3.useCallback)(async () => {
    if (deletingIds.length === 0) return;
    setDeleteLoading(true);
    try {
      const itemsService = new import_services8.ItemsService(collection);
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
  const handleRefresh = (0, import_react3.useCallback)(() => {
    exactTotalRef.current = null;
    loadItems();
  }, [loadItems]);
  const handleDeleteCancel = (0, import_react3.useCallback)(() => {
    setDeleteConfirmOpen(false);
    setDeletingIds([]);
  }, []);
  const isFiltered = (0, import_react3.useMemo)(() => {
    return search.trim().length > 0 || filter && Object.keys(filter).length > 0 || internalFilter && Object.keys(internalFilter).length > 0 || archiveField && archiveFilterMode !== "all";
  }, [search, filter, internalFilter, archiveField, archiveFilterMode]);
  const itemCountDisplay = (0, import_react3.useMemo)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_core8.Stack, { gap: 0, className: "collection-list", "data-testid": "collection-list", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
    enableFilter && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Collapse, { in: filterPanelOpen, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "collection-list-filter-panel", "data-testid": "collection-list-filter-panel", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_core8.Group, { justify: "space-between", mb: "xs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "sm", fw: 600, children: t.list.filterPanel.title }),
        activeFilterCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          import_core8.Button,
          {
            variant: "subtle",
            size: "compact-xs",
            leftSection: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconFilterOff, { size: 14 }),
            onClick: handleClearFilter,
            "data-testid": "collection-list-clear-filters",
            children: t.list.filterPanel.clearAll
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
    error && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_core8.Alert,
      {
        icon: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_icons_react6.IconAlertCircle, { size: 16 }),
        color: "red",
        "data-testid": "collection-list-error",
        mt: "xs",
        children: error
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_ui_table.VTable,
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
        renderFooter: () => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
var import_react4 = require("react");
var import_core9 = require("@mantine/core");
var import_icons_react7 = require("@tabler/icons-react");
var import_services9 = require("@buildpad/services");
var import_jsx_runtime9 = require("react/jsx-runtime");
function CollectionIcon({ icon, color }) {
  const iconColor = color || void 0;
  const size = 18;
  switch (icon) {
    case "box":
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconBox, { size, color: iconColor });
    case "folder":
    case "folder_open":
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconFolder, { size, color: iconColor });
    case "database":
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconDatabase, { size, color: iconColor });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconTable, { size, color: iconColor });
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
  const collectionBookmarks = (0, import_react4.useMemo)(
    () => (bookmarks || []).filter((b) => b.collection === node.collection),
    [bookmarks, node.collection]
  );
  const hasBookmarks = collectionBookmarks.length > 0;
  const isGroupWithContent = isGroup || hasBookmarks;
  const matchesSearch = (0, import_react4.useMemo)(() => {
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
  const label = /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Group, { gap: 4, wrap: "nowrap", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_core9.Text,
    {
      size: dense ? "sm" : void 0,
      fw: isActive ? 600 : 400,
      c: isHidden ? "dimmed" : void 0,
      truncate: true,
      children: node.name || node.collection
    }
  ) });
  const contextMenu = isAdmin && hasSchema ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Menu, { shadow: "md", width: 200, position: "bottom-start", withArrow: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Target, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_core9.ActionIcon,
      {
        variant: "subtle",
        size: "xs",
        onClick: (e) => {
          e.stopPropagation();
        },
        style: { opacity: 0, transition: "opacity 150ms" },
        className: "nav-item-action",
        "aria-label": t.collectionOptions,
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconSettings, { size: 14 })
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Dropdown, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_core9.Menu.Item,
      {
        leftSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconDatabase, { size: 14 }),
        onClick: () => onEditCollection?.(node.collection),
        children: t.editCollection
      }
    ) })
  ] }) : null;
  if (isGroupWithContent) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_jsx_runtime9.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      import_core9.NavLink,
      {
        label,
        leftSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CollectionIcon, { icon: node.icon, color: node.color }),
        rightSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Group, { gap: 4, children: [
          contextMenu,
          !isLocked && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            import_icons_react7.IconChevronRight,
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
          node.children.map((child) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
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
          collectionBookmarks.map((bookmark) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            import_core9.NavLink,
            {
              label: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { size: "sm", truncate: true, children: bookmark.bookmark || t.untitledBookmark }),
              leftSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                import_icons_react7.IconBookmark,
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
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_core9.NavLink,
    {
      label,
      leftSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CollectionIcon, { icon: node.icon, color: node.color }),
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
  const [search, setSearch] = (0, import_react4.useState)("");
  const t = (0, import_services9.useBuildpadTranslations)((d) => d.collections.navigation, translations?.navigation);
  const handleSearchChange = (0, import_react4.useCallback)(
    (value) => {
      setSearch(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Stack, { gap: "xs", p: "md", children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_core9.Box,
      {
        h: dense ? 28 : 36,
        bg: "var(--mantine-color-gray-1)",
        style: { borderRadius: "var(--mantine-radius-sm)", animation: "pulse 1.5s ease-in-out infinite" }
      },
      i
    )) });
  }
  if (rootCollections.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Stack, { gap: "md", p: "md", align: "center", justify: "center", style: { minHeight: 200 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconBox, { size: 48, color: "var(--mantine-color-gray-5)" }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { c: "dimmed", ta: "center", size: "sm", children: t.emptyState.title }),
      isAdmin && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { c: "dimmed", ta: "center", size: "xs", children: t.emptyState.adminHint })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Stack, { gap: 0, style: { minHeight: "100%" }, children: [
    showSearch && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Box, { p: "sm", pb: 0, style: { position: "sticky", top: 0, zIndex: 1 }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_core9.TextInput,
      {
        value: search,
        onChange: (e) => handleSearchChange(e.currentTarget.value),
        placeholder: t.searchPlaceholder,
        leftSection: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconSearch, { size: 16 }),
        size: dense ? "xs" : "sm",
        type: "search"
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.ScrollArea, { style: { flex: 1 }, p: "xs", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("nav", { children: rootCollections.map((node) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
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
    hasHiddenCollections && onToggleHidden && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_core9.Box,
      {
        p: "xs",
        style: {
          borderTop: "1px solid var(--mantine-color-default-border)",
          position: "sticky",
          bottom: 0
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          import_core9.UnstyledButton,
          {
            onClick: onToggleHidden,
            style: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "4px 8px" },
            children: [
              showHidden ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconEyeOff, { size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_icons_react7.IconEye, { size: 16 }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { size: "xs", c: "dimmed", children: showHidden ? t.hideHiddenCollections : t.showHiddenCollections })
            ]
          }
        )
      }
    )
  ] });
};

// src/ContentLayout.tsx
var import_react5 = require("react");
var import_core10 = require("@mantine/core");
var import_hooks = require("@mantine/hooks");
var import_icons_react8 = require("@tabler/icons-react");
var import_jsx_runtime10 = require("react/jsx-runtime");
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
  const [sidebarOpened, { toggle: toggleSidebar }] = (0, import_hooks.useDisclosure)(true);
  const isMobile = (0, import_hooks.useMediaQuery)("(max-width: 768px)");
  const handleBreadcrumbClick = (0, import_react5.useCallback)(
    (e, href) => {
      if (!href) e.preventDefault();
    },
    []
  );
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    import_core10.AppShell,
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
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AppShell.Navbar, { p: 0, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AppShell.Section, { grow: true, component: import_core10.ScrollArea, children: sidebar }) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.AppShell.Main, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
            import_core10.Box,
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
                (breadcrumbs || headline) && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { gap: 4, mb: 4, children: [
                  isMobile && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    import_core10.Burger,
                    {
                      opened: sidebarOpened,
                      onClick: toggleSidebar,
                      size: "sm",
                      hiddenFrom: "sm"
                    }
                  ),
                  !isMobile && !sidebarOpened && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.ActionIcon, { variant: "subtle", onClick: toggleSidebar, size: "sm", mr: 4, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_icons_react8.IconMenu2, { size: 16 }) }),
                  breadcrumbs && breadcrumbs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    import_core10.Breadcrumbs,
                    {
                      separator: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_icons_react8.IconChevronRight, { size: 12 }),
                      style: { fontSize: "var(--mantine-font-size-xs)" },
                      children: breadcrumbs.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                        import_core10.Anchor,
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
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { justify: "space-between", wrap: "nowrap", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { gap: "sm", wrap: "nowrap", style: { minWidth: 0 }, children: [
                    showBack && onBack && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.ActionIcon, { variant: "subtle", onClick: onBack, size: "md", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                      import_icons_react8.IconChevronRight,
                      {
                        size: 18,
                        style: { transform: "rotate(180deg)" }
                      }
                    ) }),
                    icon && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Box, { c: iconColor, style: { display: "flex", alignItems: "center" }, children: icon }),
                    loading ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { width: 200, height: 28 }) : title && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Title, { order: 3, lineClamp: 1, style: { minWidth: 0 }, children: title }),
                    titleAppend
                  ] }),
                  actions && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Group, { gap: "xs", wrap: "nowrap", children: actions })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Box, { style: { flex: 1 }, children })
        ] }),
        sidebarDetail && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AppShell.Aside, { p: "md", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AppShell.Section, { grow: true, component: import_core10.ScrollArea, children: sidebarDetail }) })
      ]
    }
  );
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
