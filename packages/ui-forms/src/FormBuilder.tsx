/**
 * FormBuilder
 *
 * Design-time authoring surface for a form definition. Three panes — field
 * palette (left), section/field canvas (center), and field-settings (right) —
 * plus a live-preview tab. Loads the target collection's schema via
 * `FieldsService.readAll`, loads/creates the definition via `useFormDefinitions`,
 * and saves on demand. Reordering is powered by `@dnd-kit/sortable`.
 *
 * Authoring is gated on `create`/`update` permission for the definitions
 * collection (not on `isAdmin`): a non-admin with item write access to the
 * definitions collection can build screens. The runtime renderer
 * (`DynamicForm`/`CollectionForm`) still enforces target-collection permissions
 * independently.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import './FormBuilder.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEye,
  IconLayoutColumns,
} from '@tabler/icons-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CollectionsService, FieldsService, fullBaselineFields } from '@buildpad/services';
import { useFormDefinitions, usePermissions } from '@buildpad/hooks';
import { interfaceForFieldType, interfaceRequiresChoices, PROVISIONABLE_INTERFACES } from '@buildpad/utils';
import type {
  Field,
  FieldSpec,
  FieldStore,
  FormDefinition,
  FormFieldConfig,
  FormSection,
} from '@buildpad/types';
import { FieldPalette, PALETTE_ID_PREFIX, NEWFIELD_ID_PREFIX } from './FieldPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { FieldSettingsPanel } from './FieldSettingsPanel';
import { FormPreview } from './FormPreview';
import { FormsEmptyState } from './FormsEmptyState';
import { AddFieldModal, type AddFieldResult } from './AddFieldModal';
import { NameFieldModal } from './NameFieldModal';
import type { Choice } from './ChoicesInput';
import { FIELD_KEY_PATTERN } from './field-name';
import {
  SECTION_ID_PREFIX,
  SECTION_BODY_ID_PREFIX,
} from './BuilderSection';

export interface FormBuilderProps {
  /**
   * Collection the screen creates/edits items in. Required when creating a new
   * definition; when editing (`definitionId` set) it is taken from the loaded
   * definition, so this may be omitted.
   */
  targetCollection?: string;
  /** Id of an existing definition to edit; omit to create a new one. */
  definitionId?: string | number;
  /** Definitions collection name (default `fb_definitions`). */
  formsCollection?: string;
  /** Called after a successful save with the persisted definition. */
  onSaved?: (def: FormDefinition) => void;
}

/**
 * The single jsonb column that `store:'extras'` answers are written into. Fixed
 * by the hybrid-storage design; mirrors `EXTRAS_COLUMN` in `@buildpad/ui-collections`
 * (kept local so scaffolded consumer code needs no cross-component value import).
 */
const EXTRAS_COLUMN = 'extras';

/** System/auto fields that aren't useful to place on an authored form. */
const PALETTE_EXCLUDE = new Set([
  'id',
  'sort',
  'user_created',
  'user_updated',
  'date_created',
  'date_updated',
  // The `extras` jsonb tail is storage plumbing for `store:'extras'` fields, not
  // a field an author places directly.
  EXTRAS_COLUMN,
]);

/**
 * Collision detection that yields NO target when the pointer is outside every
 * droppable, so releasing off-canvas cancels the drop instead of snapping to the
 * nearest section (the behaviour `closestCenter` produces). Falls back to rect
 * intersection for keyboard dragging, which has no pointer position.
 */
const cancellableCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  // No pointer (keyboard) → use rect overlap; for pointer drags fully outside
  // any droppable this also returns [], leaving `over` null so the drop cancels.
  return args.pointerCoordinates ? [] : rectIntersection(args);
};

/** Generate a stable-ish unique id for new sections. */
function genId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/**
 * Synthesize a builder-side `Field` for a new field so the canvas, settings
 * panel, and preview can render it uniformly before it exists in the schema.
 * Used for `extras` fields (`store:'extras'` → the jsonb tail, never a column)
 * and for **deferred real columns** (`store:'column'`) added before the target
 * collection exists — those are provisioned in `handleSave` when the collection
 * is auto-created, at which point the synth field is replaced by the real one.
 */
function synthField(
  collection: string,
  result: AddFieldResult,
  store: FieldStore,
): Field {
  const { spec, extra } = result;
  return {
    collection,
    field: spec.field,
    type: extra.type,
    meta: {
      id: -1,
      collection,
      field: spec.field,
      interface: extra.interface ?? interfaceForFieldType(extra.type),
      options: extra.options ?? null,
      readonly: false,
      hidden: false,
      width: 'full',
      note: extra.label ?? null,
      required: spec.required ?? false,
      store,
    },
  };
}

/** Slugify a screen name to a snake_case collection base (the `fb_` prefix is
 *  applied by `CollectionsService.createCollection`). */
function toCollectionName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'screen'
  );
}

/** Strip the section/body id prefix to recover the raw section id. */
function sectionIdFrom(id: string): string | null {
  if (id.startsWith(SECTION_ID_PREFIX)) return id.slice(SECTION_ID_PREFIX.length);
  if (id.startsWith(SECTION_BODY_ID_PREFIX))
    return id.slice(SECTION_BODY_ID_PREFIX.length);
  return null;
}

/** Where a new/moved field lands: a section id (null = append to the last
 *  section, creating one if none) and the insert index within it. */
interface DropTarget {
  sectionId: string | null;
  index: number;
}

/**
 * Resolve the drop position from a drag's `over` id: dropping on a section
 * header/body appends to that section; dropping on a field row inserts before
 * it. Returns null when the target can't be resolved (drop is then ignored).
 */
function resolveDropTarget(
  overId: string,
  sections: FormSection[],
): DropTarget | null {
  const overSectionId = sectionIdFrom(overId);
  if (overSectionId != null) {
    const section = sections.find((s) => s.id === overSectionId);
    if (!section) return null;
    return { sectionId: overSectionId, index: section.fields.length };
  }
  const si = sections.findIndex((s) =>
    s.fields.some((f) => f.field === overId),
  );
  if (si === -1) return null;
  const idx = sections[si].fields.findIndex((f) => f.field === overId);
  return { sectionId: sections[si].id, index: idx };
}

/**
 * Insert a placed field config at a drop target. A null `sectionId` appends to
 * the last section (creating a default one when there are none). Deduplicates:
 * a field can only be placed once.
 */
function insertFieldAt(
  sections: FormSection[],
  drop: DropTarget,
  config: FormFieldConfig,
): FormSection[] {
  if (sections.some((s) => s.fields.some((f) => f.field === config.field))) {
    return sections;
  }
  // Append-to-last (click path, or a stale/absent section).
  const targetIdx =
    drop.sectionId == null
      ? -1
      : sections.findIndex((s) => s.id === drop.sectionId);
  if (targetIdx === -1) {
    if (sections.length === 0) {
      return [{ id: genId('section'), title: 'Details', fields: [config] }];
    }
    const next = sections.map((s, i) =>
      i === sections.length - 1 ? { ...s, fields: [...s.fields, config] } : s,
    );
    return next;
  }
  const next = sections.map((s, i) =>
    i === targetIdx ? { ...s, fields: [...s.fields] } : s,
  );
  const pos = Math.min(Math.max(drop.index, 0), next[targetIdx].fields.length);
  next[targetIdx].fields.splice(pos, 0, config);
  return next;
}

/**
 * Visual form-definition builder.
 */
export function FormBuilder({
  targetCollection,
  definitionId,
  formsCollection,
  onSaved,
}: FormBuilderProps) {
  const { get, create, update } = useFormDefinitions(formsCollection);
  const { canPerform, isAdmin, loading: permsLoading } = usePermissions();

  const [schemaFields, setSchemaFields] = useState<Field[]>([]);
  // Effective target collection: the prop for new screens, or the loaded
  // definition's `target_collection` when editing.
  const [collection, setCollection] = useState(targetCollection ?? '');
  const [name, setName] = useState('');
  const [screenKey, setScreenKey] = useState('');
  const [sections, setSections] = useState<FormSection[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  // Id of the item currently being dragged (drives the DragOverlay preview).
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | number | undefined>(
    definitionId,
  );

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [definitionsMissing, setDefinitionsMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  // Quick-add seed: prefills the "Add field" modal's type/interface (null = the
  // plain "Add field" button, which opens with defaults).
  const [addFieldSeed, setAddFieldSeed] = useState<{
    type: string;
    interface: string;
  } | null>(null);
  // Bumped to force a reload (e.g. after creating the definitions collection).
  const [reloadNonce, setReloadNonce] = useState(0);
  const loadedRef = useRef(false);
  // Real-column specs added while no target collection is bound yet. They are
  // provisioned into the collection auto-created on the first save (keyed by
  // field key; only those still placed on the canvas are provisioned).
  const pendingSpecsRef = useRef<Map<string, FieldSpec>>(new Map());
  // Mirror of `sections` for use inside stable (deps-`[]`) drag handlers, which
  // must read the current layout without being re-created on every edit.
  const sectionsRef = useRef<FormSection[]>([]);

  // Pending "name the new field" prompt: a field-type chip was dropped/clicked
  // and we're collecting its column name before placing it. Carries the chip's
  // interface + the resolved drop position. Null = the modal is closed.
  const [pendingDrop, setPendingDrop] = useState<
    { interfaceValue: string; sectionId: string | null; index: number } | null
  >(null);

  // Real-column/collection provisioning (DDL) needs DaaS schema rights. We have
  // no field-grained client signal for those, so gate on `isAdmin` (admins
  // bypass schema policies); everyone else falls back to `extras` (no DDL).
  const canProvisionSchema = isAdmin;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Authoring permission: create (new) or update (existing) on the definitions
  // collection. We allow while permissions are still loading to avoid a flash,
  // and admins always pass.
  const canAuthor =
    permsLoading ||
    isAdmin ||
    canPerform(formsCollection ?? 'fb_definitions', definitionId ? 'update' : 'create') ||
    canPerform(formsCollection ?? 'fb_definitions', 'create') ||
    canPerform(formsCollection ?? 'fb_definitions', 'update');

  // ---- Load schema + (optional) existing definition ----
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        // When editing, the definition is the source of truth for which
        // collection's schema to load. Load it first, then fetch that schema.
        let effectiveCollection = targetCollection ?? '';
        if (definitionId != null) {
          try {
            const def = await get(definitionId);
            effectiveCollection = def.target_collection || effectiveCollection;
            setCollection(effectiveCollection);
            setName(def.name);
            setScreenKey(def.key ?? '');
            setSections(def.sections ?? []);
            setSavedId(def.id ?? definitionId);
          } catch (err) {
            // Most likely the definitions collection doesn't exist yet.
            setDefinitionsMissing(true);
            setLoadError(
              err instanceof Error ? err.message : 'Failed to load definition',
            );
            return;
          }
        } else {
          // Fresh definition: start with a single default section.
          setCollection(effectiveCollection);
          setName('');
          setSections([{ id: genId('section'), title: 'Details', fields: [] }]);
        }

        if (effectiveCollection) {
          const fieldsService = new FieldsService();
          const allFields = await fieldsService.readAll(effectiveCollection);
          setSchemaFields(allFields);
        } else {
          // Auto-create mode (no collection bound yet): seed the palette with the
          // full-storage system fields the new collection will have, so they can
          // be placed and previewed before it exists (only `status` is
          // user-facing; the rest are excluded by PALETTE_EXCLUDE).
          setSchemaFields(fullBaselineFields());
        }
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load collection schema',
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [targetCollection, definitionId, get, reloadNonce]);

  /** Re-run the schema/definition load (e.g. after provisioning the collection). */
  const reload = useCallback(() => {
    loadedRef.current = false;
    setDefinitionsMissing(false);
    setLoadError(null);
    setReloadNonce((n) => n + 1);
  }, []);

  // Keep the sections mirror current for the stable drag handlers.
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // ---- Derived: schema lookup + placed/unplaced field sets ----
  const schemaByKey = useMemo(
    () => new Map(schemaFields.map((f) => [f.field, f])),
    [schemaFields],
  );

  const placedFields = useMemo(() => {
    const set = new Set<string>();
    for (const section of sections) {
      for (const f of section.fields) set.add(f.field);
    }
    return set;
  }, [sections]);

  // All keys that already exist (schema + placed) — passed to the "Add field"
  // modal to prevent provisioning a colliding field.
  const existingFieldNames = useMemo(
    () => new Set([...schemaFields.map((f) => f.field), ...placedFields]),
    [schemaFields, placedFields],
  );

  // A collection is "hybrid" (offers the `extras` opt-in) iff it has an `extras`
  // column; a "full" collection (builder-created, no extras) has none, so every
  // new field must be a real column.
  const supportsExtras = useMemo(
    () => schemaFields.some((f) => f.field === EXTRAS_COLUMN),
    [schemaFields],
  );

  const paletteFields = useMemo(
    () =>
      schemaFields.filter((f) => {
        if (placedFields.has(f.field)) return false;
        if (PALETTE_EXCLUDE.has(f.field)) return false;
        // Skip synthesized group/divider alias fields — sections are our groups.
        if (f.type === 'alias' && f.meta?.special?.includes?.('group')) {
          return false;
        }
        return true;
      }),
    [schemaFields, placedFields],
  );

  // ---- Section / field mutations ----
  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { id: genId('section'), title: `Section ${prev.length + 1}`, fields: [] },
    ]);
  }, []);

  const renameSection = useCallback((sectionId: string, title: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    );
  }, []);

  const removeSection = useCallback(
    (sectionId: string) => {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setSelectedField((cur) => {
        const removed = sections.find((s) => s.id === sectionId);
        if (removed?.fields.some((f) => f.field === cur)) return null;
        return cur;
      });
    },
    [sections],
  );

  // Place a full field config into the last section (creating one if needed).
  const placeConfig = useCallback((config: FormFieldConfig) => {
    setSections((prev) => {
      // Already placed (e.g. a stray click fired right after a drag-drop) — no-op.
      if (prev.some((s) => s.fields.some((f) => f.field === config.field))) {
        return prev;
      }
      if (prev.length === 0) {
        return [{ id: genId('section'), title: 'Details', fields: [config] }];
      }
      // Add to the last section by default.
      const next = prev.map((s) => ({ ...s, fields: [...s.fields] }));
      next[next.length - 1].fields.push(config);
      return next;
    });
    setSelectedField(config.field);
  }, []);

  const addField = useCallback(
    (fieldKey: string) => placeConfig({ field: fieldKey }),
    [placeConfig],
  );

  /** Open the "Add field" modal, optionally prefilled from a quick-add template. */
  const openAddField = useCallback(
    (seed?: { type: string; interface: string }) => {
      setAddFieldSeed(seed ?? null);
      setAddFieldOpen(true);
    },
    [],
  );

  /**
   * Start a new field from a field-type catalog chip (click path). Opens the
   * column-name prompt targeting the **last section** (a new one is created on
   * confirm if there are none). The drag path — dropping a chip on the canvas —
   * is handled in `handleDragEnd`, which resolves an exact drop position.
   */
  const handleAddFieldType = useCallback((interfaceValue: string) => {
    const sects = sectionsRef.current;
    const last = sects[sects.length - 1];
    setPendingDrop({
      interfaceValue,
      sectionId: last ? last.id : null,
      index: last ? last.fields.length : -1,
    });
  }, []);

  /**
   * Confirm the column-name prompt: build the deferred `FieldSpec`, synthesize a
   * local `Field` so it renders immediately, record it in `pendingSpecs` (real
   * columns are provisioned on Save — deferred for bound and auto-create paths
   * alike), insert the field at the stashed drop position, and select it so the
   * settings panel opens for label/choices/etc.
   */
  const handleNameFieldConfirm = useCallback(
    (fieldKey: string) => {
      const drop = pendingDrop;
      if (!drop) return;
      const descriptor = PROVISIONABLE_INTERFACES.find(
        (i) => i.value === drop.interfaceValue,
      );
      const type = descriptor?.types[0] ?? 'string';
      const spec: FieldSpec = {
        field: fieldKey,
        type,
        interface: drop.interfaceValue,
      };
      const result: AddFieldResult = {
        storage: 'column',
        spec,
        extra: { type, interface: drop.interfaceValue },
      };
      const synth = synthField(collection, result, 'column');
      pendingSpecsRef.current.set(fieldKey, spec);
      setSchemaFields((prev) =>
        prev.some((f) => f.field === fieldKey) ? prev : [...prev, synth],
      );
      setSections((prev) =>
        insertFieldAt(prev, drop, { field: fieldKey }),
      );
      setSelectedField(fieldKey);
      setPendingDrop(null);
    },
    [pendingDrop, collection],
  );

  /**
   * Update a deferred (pending) field's **label**: writes it to the pending
   * `FieldSpec` (so the provisioned column carries it) and to the synthesized
   * `Field`'s `meta.note` (so the canvas/preview re-render).
   */
  const handleNewFieldLabelChange = useCallback(
    (fieldKey: string, label: string | undefined) => {
      const spec = pendingSpecsRef.current.get(fieldKey);
      if (!spec) return;
      pendingSpecsRef.current.set(fieldKey, { ...spec, label });
      setSchemaFields((prev) =>
        prev.map((f) =>
          f.field === fieldKey && f.meta
            ? { ...f, meta: { ...f.meta, note: label ?? null } }
            : f,
        ),
      );
    },
    [],
  );

  /**
   * Update a deferred (pending) choice field's **choices**: writes them to the
   * pending `FieldSpec.options` and the synthesized `Field`'s `meta.options`.
   */
  const handleNewFieldChoicesChange = useCallback(
    (fieldKey: string, choices: Choice[] | undefined) => {
      const spec = pendingSpecsRef.current.get(fieldKey);
      if (!spec) return;
      const options = choices?.length ? { choices } : undefined;
      pendingSpecsRef.current.set(fieldKey, { ...spec, options });
      setSchemaFields((prev) =>
        prev.map((f) =>
          f.field === fieldKey && f.meta
            ? { ...f, meta: { ...f.meta, options: options ?? null } }
            : f,
        ),
      );
    },
    [],
  );

  /**
   * Ensure the target collection has the `extras` jsonb column that
   * `store:'extras'` fields write into. Best-effort: with schema rights it
   * provisions the column on demand (once); without them it is a no-op and the
   * runtime surfaces a clear message at save time. Never throws — a failure here
   * must not block placing the extra field the author asked for.
   */
  const ensureExtrasColumn = useCallback(async () => {
    if (schemaFields.some((f) => f.field === EXTRAS_COLUMN)) return;
    if (!canProvisionSchema) return;
    try {
      const created = await new FieldsService().createField(collection, {
        field: EXTRAS_COLUMN,
        type: 'json',
        label: 'Extras',
        hidden: true,
      });
      setSchemaFields((prev) =>
        prev.some((f) => f.field === EXTRAS_COLUMN) ? prev : [...prev, created],
      );
      notifications.show({
        color: 'green',
        title: 'Extras column added',
        message: `Added an “${EXTRAS_COLUMN}” JSON column to ${collection} to hold extra fields.`,
      });
    } catch {
      // Column may already exist server-side, or we lack rights — either way,
      // don't block the author. The save-time guard reports a genuine absence.
    }
  }, [schemaFields, canProvisionSchema, collection]);

  /**
   * Provision and place a brand-new field. Real columns are created via the DDL
   * API (`FieldsService.createField`) and the returned `Field` is injected into
   * the schema; `extras` fields are synthesized locally (no DDL) and carry their
   * descriptor in the config — but we first ensure the collection's `extras`
   * jsonb column exists so the field can actually be saved. Errors propagate to
   * `AddFieldModal`, which keeps the dialog open so the draft isn't lost (Req 10.6).
   */
  const handleCreateField = useCallback(
    async (result: AddFieldResult) => {
      if (result.storage === 'column') {
        // No target collection yet (auto-create flow): defer provisioning until
        // save creates the collection. Synthesize the field locally so it renders
        // and record its spec to provision later.
        if (!collection) {
          pendingSpecsRef.current.set(result.spec.field, result.spec);
          const synth = synthField(collection, result, 'column');
          setSchemaFields((prev) => [...prev, synth]);
          placeConfig({ field: result.spec.field });
          return;
        }
        const created = await new FieldsService().createField(
          collection,
          result.spec,
        );
        setSchemaFields((prev) => [...prev, created]);
        placeConfig({ field: created.field });
        notifications.show({
          color: 'green',
          title: 'Field created',
          message: `“${result.spec.label ?? created.field}” was added to ${collection}.`,
        });
      } else {
        await ensureExtrasColumn();
        const synth = synthField(collection, result, 'extras');
        setSchemaFields((prev) => [...prev, synth]);
        placeConfig({
          field: result.spec.field,
          store: 'extras',
          extra: result.extra,
        });
      }
    },
    [collection, placeConfig, ensureExtrasColumn],
  );

  const removeField = useCallback((fieldKey: string) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.field !== fieldKey),
      })),
    );
    setSelectedField((cur) => (cur === fieldKey ? null : cur));
  }, []);

  const patchField = useCallback(
    (fieldKey: string, patch: Partial<FormSection['fields'][number]>) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          fields: s.fields.map((f) =>
            f.field === fieldKey ? { ...f, ...patch } : f,
          ),
        })),
      );
    },
    [],
  );

  // ---- Drag & drop (sections + fields, incl. cross-section) ----
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // Drag a field-type catalog chip onto the canvas: stash the drop position
    // and open the column-name prompt. Placement is deferred to confirm.
    if (activeId.startsWith(NEWFIELD_ID_PREFIX)) {
      const interfaceValue = activeId.slice(NEWFIELD_ID_PREFIX.length);
      const target = resolveDropTarget(overId, sectionsRef.current);
      if (!target) return;
      setPendingDrop({
        interfaceValue,
        sectionId: target.sectionId,
        index: target.index,
      });
      return;
    }

    // Drag from the palette: insert the unplaced field at the drop position.
    if (activeId.startsWith(PALETTE_ID_PREFIX)) {
      const fieldKey = activeId.slice(PALETTE_ID_PREFIX.length);
      setSections((prev) => {
        // Guard against duplicates (a field can only be placed once).
        if (prev.some((s) => s.fields.some((f) => f.field === fieldKey))) {
          return prev;
        }

        // Resolve target section + insert index from the drop target.
        let targetIdx: number;
        let targetPos: number;
        const overSectionId = sectionIdFrom(overId);
        if (overSectionId != null) {
          // Dropped on a section header/body → append to that section.
          targetIdx = prev.findIndex((s) => s.id === overSectionId);
          targetPos = targetIdx === -1 ? -1 : prev[targetIdx].fields.length;
        } else {
          // Dropped on an existing field row → insert before it.
          targetIdx = prev.findIndex((s) =>
            s.fields.some((f) => f.field === overId),
          );
          targetPos =
            targetIdx === -1
              ? -1
              : prev[targetIdx].fields.findIndex((f) => f.field === overId);
        }
        if (targetIdx === -1 || targetPos === -1) return prev;

        const next = prev.map((s, i) =>
          i === targetIdx ? { ...s, fields: [...s.fields] } : s,
        );
        next[targetIdx].fields.splice(targetPos, 0, { field: fieldKey });
        return next;
      });
      setSelectedField(fieldKey);
      return;
    }

    // Section reorder
    if (activeId.startsWith(SECTION_ID_PREFIX)) {
      const activeSid = activeId.slice(SECTION_ID_PREFIX.length);
      setSections((prev) => {
        const overSid =
          sectionIdFrom(overId) ??
          prev.find((s) => s.fields.some((f) => f.field === overId))?.id;
        if (!overSid) return prev;
        const from = prev.findIndex((s) => s.id === activeSid);
        const to = prev.findIndex((s) => s.id === overSid);
        if (from === -1 || to === -1) return prev;
        return arrayMove(prev, from, to);
      });
      return;
    }

    // Field move/reorder
    setSections((prev) => {
      const sourceIdx = prev.findIndex((s) =>
        s.fields.some((f) => f.field === activeId),
      );
      if (sourceIdx === -1) return prev;

      // Resolve target section + index.
      let targetIdx: number;
      let targetPos: number;
      const overSectionId = sectionIdFrom(overId);
      if (overSectionId != null) {
        targetIdx = prev.findIndex((s) => s.id === overSectionId);
        targetPos = targetIdx === -1 ? -1 : prev[targetIdx].fields.length;
      } else {
        targetIdx = prev.findIndex((s) =>
          s.fields.some((f) => f.field === overId),
        );
        targetPos =
          targetIdx === -1
            ? -1
            : prev[targetIdx].fields.findIndex((f) => f.field === overId);
      }
      if (targetIdx === -1 || targetPos === -1) return prev;

      // Same section: simple reorder.
      if (sourceIdx === targetIdx) {
        const from = prev[sourceIdx].fields.findIndex(
          (f) => f.field === activeId,
        );
        if (from === targetPos) return prev;
        const next = [...prev];
        next[sourceIdx] = {
          ...prev[sourceIdx],
          fields: arrayMove(prev[sourceIdx].fields, from, targetPos),
        };
        return next;
      }

      // Cross-section move.
      const moving = prev[sourceIdx].fields.find((f) => f.field === activeId)!;
      const next = prev.map((s, i) => {
        if (i === sourceIdx) {
          return { ...s, fields: s.fields.filter((f) => f.field !== activeId) };
        }
        if (i === targetIdx) {
          const fields = [...s.fields];
          fields.splice(targetPos, 0, moving);
          return { ...s, fields };
        }
        return s;
      });
      return next;
    });
  }, []);

  // ---- Save ----
  const draft = useMemo<FormDefinition>(
    () => ({
      id: savedId != null ? String(savedId) : undefined,
      name: name.trim() || 'Untitled screen',
      target_collection: collection,
      key: screenKey.trim() || null,
      sections,
    }),
    [savedId, name, screenKey, collection, sections],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    // Distinguishes a target-provisioning failure (keep the builder) from a
    // definitions-store failure (show the create-collection empty state).
    let persistingDefinition = false;
    try {
      // Validate deferred (pending) fields still placed on the canvas BEFORE any
      // DDL, so a bad field blocks the save cleanly (no half-created collection).
      const placedKeys = new Set<string>();
      for (const s of sections) for (const f of s.fields) placedKeys.add(f.field);
      for (const [key, spec] of pendingSpecsRef.current) {
        if (!placedKeys.has(key)) continue;
        if (!FIELD_KEY_PATTERN.test(key)) {
          notifications.show({
            color: 'red',
            title: 'Invalid field name',
            message: `“${key}” isn’t a valid column name (lowercase letters, numbers, underscores; start with a letter).`,
          });
          return;
        }
        if (interfaceRequiresChoices(spec.interface ?? '')) {
          const choices = (spec.options as { choices?: unknown[] } | undefined)
            ?.choices;
          if (!choices || choices.length === 0) {
            notifications.show({
              color: 'red',
              title: 'Choices required',
              message: `“${spec.label || key}” is a choice field — add at least one choice in the settings panel before saving.`,
            });
            return;
          }
        }
      }

      // `collection` (closure value) tells us which path we're on: empty means
      // auto-create; set means bound. It doesn't change under us mid-save.
      const autoCreate = !collection;
      let resolvedCollection = collection;

      // Auto-create the target collection on the first save when none is bound.
      if (autoCreate) {
        if (!canProvisionSchema) {
          throw new Error(
            'No target collection is set, and you lack the schema rights to create one. Bind this screen to an existing collection instead.',
          );
        }
        const screenName = name.trim();
        if (!screenName) {
          notifications.show({
            color: 'red',
            title: 'Name required',
            message:
              'Enter a screen name first — the new collection is named after it.',
          });
          return;
        }

        // `full` strategy → system fields + all real columns, no `extras`. The
        // service applies the `fb_` prefix; use the returned name as the target.
        const created = await new CollectionsService().createCollection({
          collection: toCollectionName(screenName),
          strategy: 'full',
        });
        resolvedCollection = created.collection ?? toCollectionName(screenName);
        setCollection(resolvedCollection);
      }

      // Provision deferred real columns still placed on the canvas, in order —
      // for both the auto-create AND bound-collection paths (Req 10.7). Replace
      // each synth field with the real one and drop it from the pending map.
      const fieldsService = new FieldsService();
      const provisioned: Field[] = [];
      for (const s of sections) {
        for (const f of s.fields) {
          const spec = pendingSpecsRef.current.get(f.field);
          if (spec) {
            provisioned.push(
              await fieldsService.createField(resolvedCollection, spec),
            );
          }
        }
      }
      if (provisioned.length > 0) {
        for (const p of provisioned) pendingSpecsRef.current.delete(p.field);
        const byKey = new Map(provisioned.map((f) => [f.field, f]));
        setSchemaFields((prev) => prev.map((f) => byKey.get(f.field) ?? f));
      }

      if (autoCreate) {
        notifications.show({
          color: 'green',
          title: 'Collection created',
          message: `Created “${resolvedCollection}” with ${provisioned.length} field(s).`,
        });
      } else if (provisioned.length > 0) {
        notifications.show({
          color: 'green',
          title: 'Fields added',
          message: `Provisioned ${provisioned.length} new field(s) on ${resolvedCollection}.`,
        });
      }

      const payload: FormDefinition = {
        id: savedId != null ? String(savedId) : undefined,
        name: name.trim() || 'Untitled screen',
        target_collection: resolvedCollection,
        key: screenKey.trim() || null,
        sections,
      };

      persistingDefinition = true;
      const saved =
        savedId != null
          ? await update(savedId, payload)
          : await create(payload);
      setSavedId(saved.id ?? savedId);
      setDefinitionsMissing(false);
      notifications.show({
        color: 'green',
        title: 'Saved',
        message: `“${saved.name}” has been saved.`,
      });
      onSaved?.(saved);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save definition';
      // A missing definitions collection is the most common *definition*-save
      // failure; don't blow away the builder for a target-provisioning error.
      if (persistingDefinition) setDefinitionsMissing(true);
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message,
      });
    } finally {
      setSaving(false);
    }
  }, [
    collection,
    canProvisionSchema,
    name,
    screenKey,
    sections,
    savedId,
    update,
    create,
    onSaved,
  ]);

  // Human-readable label for the DragOverlay preview of the active drag.
  const activeDragLabel = useMemo(() => {
    if (!activeDragId) return null;
    if (activeDragId.startsWith(PALETTE_ID_PREFIX)) {
      const key = activeDragId.slice(PALETTE_ID_PREFIX.length);
      return schemaByKey.get(key)?.meta?.note || key;
    }
    if (activeDragId.startsWith(NEWFIELD_ID_PREFIX)) {
      const iface = activeDragId.slice(NEWFIELD_ID_PREFIX.length);
      return (
        PROVISIONABLE_INTERFACES.find((i) => i.value === iface)?.label ||
        'New field'
      );
    }
    if (activeDragId.startsWith(SECTION_ID_PREFIX)) {
      const sid = activeDragId.slice(SECTION_ID_PREFIX.length);
      return sections.find((s) => s.id === sid)?.title || 'Section';
    }
    // A placed field row.
    for (const s of sections) {
      const f = s.fields.find((x) => x.field === activeDragId);
      if (f) return f.note || schemaByKey.get(activeDragId)?.meta?.note || activeDragId;
    }
    return activeDragId;
  }, [activeDragId, schemaByKey, sections]);

  // ---- Render ----
  const selectedSchemaField = selectedField
    ? schemaByKey.get(selectedField)
    : undefined;
  const selectedConfig = useMemo(() => {
    if (!selectedField) return undefined;
    for (const s of sections) {
      const f = s.fields.find((x) => x.field === selectedField);
      if (f) return f;
    }
    return undefined;
  }, [selectedField, sections]);

  // Is the selected field a deferred (not-yet-provisioned) new real column? If
  // so, the settings panel edits its label/choices (written back to the pending
  // spec) and locks its name.
  const selectedIsNewColumn = selectedField
    ? pendingSpecsRef.current.has(selectedField)
    : false;
  const selectedRequiresChoices = interfaceRequiresChoices(
    selectedSchemaField?.meta?.interface ?? '',
  );

  if (loading) {
    return (
      <Center mih={240}>
        <Loader />
      </Center>
    );
  }

  if (!canAuthor) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        title="Not allowed"
        data-testid="forms-no-permission"
      >
        You need create or update permission on the{' '}
        <strong>{formsCollection ?? 'fb_definitions'}</strong> collection to
        build forms.
      </Alert>
    );
  }

  if (definitionsMissing) {
    return (
      <FormsEmptyState
        formsCollection={formsCollection}
        error={loadError}
        canCreateCollection={canProvisionSchema}
        onCreated={reload}
      />
    );
  }

  return (
    <Stack gap="md" className="bp-form-builder" data-testid="form-builder">
      {loadError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {loadError}
        </Alert>
      )}

      {/* Header: name / key / save */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Group gap="sm" align="flex-end" style={{ flex: 1 }}>
          <TextInput
            label="Screen name"
            placeholder="e.g. Bug create screen"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 200 }}
            data-testid="form-builder-name"
          />
          <TextInput
            label="Key (optional)"
            description="Screen discriminator"
            placeholder="e.g. bug"
            value={screenKey}
            onChange={(e) => setScreenKey(e.currentTarget.value)}
            style={{ width: 180 }}
          />
        </Group>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          loading={saving}
          onClick={handleSave}
          data-testid="form-builder-save"
        >
          Save
        </Button>
      </Group>

      <Text size="xs" c="dimmed">
        {collection ? (
          <>
            Target collection: <strong>{collection}</strong>
          </>
        ) : (
          <>
            A new <strong>fb_</strong>-prefixed collection will be created from
            the screen name (full storage — every field a real column) when you
            save.
          </>
        )}
      </Text>

      <Tabs defaultValue="build">
        <Tabs.List>
          <Tabs.Tab value="build" leftSection={<IconLayoutColumns size={14} />}>
            Build
          </Tabs.Tab>
          <Tabs.Tab value="preview" leftSection={<IconEye size={14} />}>
            Preview
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="build" pt="md">
          <DndContext
            sensors={sensors}
            collisionDetection={cancellableCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 3 }}>
                <Paper withBorder p="sm" h="100%" mih={360}>
                  <FieldPalette
                    fields={paletteFields}
                    onAddField={addField}
                    onAddNewField={() => openAddField()}
                    onAddFieldType={handleAddFieldType}
                    canProvisionSchema={canProvisionSchema}
                  />
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <ScrollArea.Autosize mah={640} type="auto">
                  <BuilderCanvas
                    sections={sections}
                    schemaByKey={schemaByKey}
                    selectedField={selectedField}
                    onSelectField={setSelectedField}
                    onRemoveField={removeField}
                    onRenameSection={renameSection}
                    onRemoveSection={removeSection}
                    onAddSection={addSection}
                  />
                </ScrollArea.Autosize>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 3 }}>
                <Paper withBorder p="sm" h="100%" mih={360}>
                  {selectedConfig && selectedSchemaField ? (
                    <FieldSettingsPanel
                      schemaField={selectedSchemaField}
                      config={selectedConfig}
                      fields={schemaFields}
                      onChange={(patch) =>
                        patchField(selectedConfig.field, patch)
                      }
                      isNewColumn={selectedIsNewColumn}
                      requiresChoices={selectedRequiresChoices}
                      onNewFieldLabelChange={(label) =>
                        handleNewFieldLabelChange(selectedConfig.field, label)
                      }
                      onNewFieldChoicesChange={(choices) =>
                        handleNewFieldChoicesChange(selectedConfig.field, choices)
                      }
                    />
                  ) : (
                    <Center mih={320}>
                      <Text size="sm" c="dimmed" ta="center">
                        Select a field to edit its width, required/hidden
                        settings, and conditions.
                      </Text>
                    </Center>
                  )}
                </Paper>
              </Grid.Col>
            </Grid>

            <DragOverlay dropAnimation={null}>
              {activeDragLabel ? (
                <Paper
                  withBorder
                  p="xs"
                  radius="sm"
                  shadow="md"
                  style={{ cursor: 'grabbing' }}
                >
                  <Text size="sm" fw={500} lineClamp={1}>
                    {activeDragLabel}
                  </Text>
                </Paper>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Tabs.Panel>

        <Tabs.Panel value="preview" pt="md">
          <Box maw={720} mx="auto">
            <FormPreview definition={draft} schemaFields={schemaFields} />
          </Box>
        </Tabs.Panel>
      </Tabs>

      <AddFieldModal
        opened={addFieldOpen}
        onClose={() => setAddFieldOpen(false)}
        canProvisionSchema={canProvisionSchema}
        supportsExtras={supportsExtras}
        existingFieldNames={existingFieldNames}
        defaultType={addFieldSeed?.type}
        defaultInterface={addFieldSeed?.interface}
        onCreate={handleCreateField}
      />

      <NameFieldModal
        opened={pendingDrop != null}
        onClose={() => setPendingDrop(null)}
        interfaceLabel={
          pendingDrop
            ? PROVISIONABLE_INTERFACES.find(
                (i) => i.value === pendingDrop.interfaceValue,
              )?.label
            : undefined
        }
        existingFieldNames={existingFieldNames}
        onConfirm={handleNameFieldConfirm}
      />
    </Stack>
  );
}

export default FormBuilder;
