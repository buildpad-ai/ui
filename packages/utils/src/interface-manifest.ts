/**
 * Interface manifest
 *
 * The single table of field-interface identity. Every interface id the
 * system knows has exactly one entry, which records what used to be spread
 * over hand-kept tables in four key spaces:
 *
 *   - `id` — the renderer id: what `getFieldInterface` returns as `type`, and
 *     what the form builder stores in `meta.interface` (`tags`, `map`).
 *   - `aliases` — other ids that name the same interface: registry / DaaS
 *     catalog ids (`input-tags`, `input-map`) and legacy ids found in stored
 *     data (`textarea`, `wysiwyg`, `xtremax-workflow-button`).
 *   - `registryComponent` — the registry entry `buildpad add` installs
 *     (`tags`, `color`, `divider`).
 *   - `exportName` — the component export VForm renders (`Tags`, `Color`).
 *
 * Plus field-type compatibility, the registry group, behaviour flags, the
 * form builder's picker descriptor and how VForm loads the component.
 *
 * DATA ONLY. No React and no component references: a consumer installs only
 * the components it uses, so components are named, never imported. The
 * tables that used to be hand-kept are derived from this one under their old
 * names (`REGISTRY_INTERFACE_ALIASES`, `PROVISIONABLE_INTERFACES`,
 * `CHOICE_INTERFACES`, the concealing set, `isPresentationField`, …).
 *
 * CURRENT BEHAVIOUR, EXACTLY. This table describes how stored records render
 * today, including the known divergences; changing one changes how existing
 * records render, which the 3.0 release deliberately does not do:
 *   - `upload` is a registry interface without a renderer case, and
 *     `presentation-links` is a presentation id without one. A field stored
 *     with either renders through its field type's default (`renders: false`).
 *   - `input-map-gl` (registry component `map-with-real-map`) is an alias of
 *     `map`, so it renders the `Map` placeholder, not MapWithRealMap.
 *   - `one-to-many` is accepted by the o2m relation hook but is not an alias:
 *     the renderer does not resolve it (`relation.hookAliases`).
 *   - `tags` is csv-compatible but is not csv-normalised (`csvMultiValue`).
 *
 * Order matters in one place: provisionable entries appear in picker order,
 * which `PROVISIONABLE_INTERFACES` (and so the form builder's palette) keeps.
 *
 * @module @buildpad/utils/interface-manifest
 */

import type { FieldType, InterfaceGroup } from './interface-types';
import type { FormsTranslations } from './i18n/namespaces/forms';

/** Group buckets shown in the form builder's interface picker. */
export type ProvisionableInterfaceGroup =
  | 'Text'
  | 'Rich content'
  | 'Selection'
  | 'Numeric & date'
  | 'Geospatial';

/**
 * How VForm loads an interface's component.
 *
 *   - `eager` — light; loaded with the form.
 *   - `lazy` — heavy (an editor, a map, a relational table); loaded on demand
 *     when a field needs it.
 *   - `client-only` — heavy and cannot even be evaluated on the server
 *     (EditorJS reads `Element` at import); loaded on demand after mount.
 */
export type InterfaceLoading = 'eager' | 'lazy' | 'client-only';

/** Skeleton height (px) shown while a lazy component loads, unless the entry sets `fallbackHeight`. */
export const DEFAULT_INTERFACE_FALLBACK_HEIGHT = 36;

/** The relation a relational list interface edits; its relation hook checks the field's interface. */
export type InterfaceRelation = 'o2m' | 'm2m' | 'm2a';

/**
 * Ids that `normalizeInterfaceId` resolves to an entry's `id`, so a field
 * stored with one renders exactly like one stored with the `id`.
 */
export interface InterfaceAliases {
  /**
   * Registry / DaaS `/api/interfaces` catalog ids (registry.json
   * `interface.id`) whose renderer id differs. These make up
   * `REGISTRY_INTERFACE_ALIASES`.
   */
  readonly registry?: readonly string[];
  /** Legacy ids found in stored DaaS data. */
  readonly legacy?: readonly string[];
}

/** Behaviour flags. Each one replaces a hand-kept id set (named per flag). */
export interface InterfaceFlags {
  /** Renders a server-concealed value as a mask (`concealingInterface`). */
  readonly concealing?: true;
  /** Needs an author-supplied choices list (`CHOICE_INTERFACES`). */
  readonly choices?: true;
  /** Presentation only: stores no value (`isPresentationField`). */
  readonly presentation?: true;
  /**
   * VForm hands it an array for a csv column's comma-separated string and
   * writes a string back (FormFieldInterface's multi-select normalisation).
   */
  readonly csvMultiValue?: true;
  /**
   * A relational field with no flat column of its own: it cannot be requested
   * as a bare name in a `fields=` fetch (ui-collections' NON_FLAT checks).
   */
  readonly nonFlatRelational?: true;
  /** Saves its own value (junction rows); the collection form leaves it out of the item save. */
  readonly selfPersisting?: true;
}

/** The form builder's picker descriptor for an interface it can put on a real column. */
export interface ProvisionableDescriptor {
  /** English label; the fallback when the dictionary lacks `labelKey`. */
  readonly label: string;
  /** Picker group. */
  readonly group: ProvisionableInterfaceGroup;
  /** Key of the label in the `forms.interfaceCatalog.label` dictionary. */
  readonly labelKey: keyof FormsTranslations['interfaceCatalog']['label'];
}

/** The relation an entry's relation hook manages, and the ids that hook accepts besides `id`. */
export interface InterfaceRelationInfo {
  readonly kind: InterfaceRelation;
  /**
   * Ids the relation hook also accepts for this interface. They are not
   * aliases: the renderer does not resolve them, so a field stored with one
   * renders through its field type's default.
   */
  readonly hookAliases?: readonly string[];
}

interface InterfaceManifestEntryBase {
  /** Renderer id (see the module note). */
  readonly id: string;
  readonly aliases?: InterfaceAliases;
  /** Registry component that ships the interface, or null when none does. */
  readonly registryComponent: string | null;
  /** Compatible field types, as the registry declares them. Order matters: the form builder provisions `types[0]`. */
  readonly types: readonly FieldType[];
  /** Registry interface group. */
  readonly group: InterfaceGroup;
  readonly flags?: InterfaceFlags;
  readonly relation?: InterfaceRelationInfo;
}

/** An interface `getFieldInterface` resolves and VForm renders. */
export interface RenderedInterfaceEntry extends InterfaceManifestEntryBase {
  readonly renders: true;
  /** Export name of the component VForm renders. */
  readonly exportName: string;
  /**
   * Deprecated `InterfaceType` literals that name this interface. The
   * renderer never returns them; VForm still maps them to `exportName`.
   */
  readonly typeLiterals?: readonly string[];
  /** Present when the form builder can put this interface on a real column. */
  readonly provision?: ProvisionableDescriptor;
  readonly loading: InterfaceLoading;
  /** Skeleton height (px) while the component loads; `DEFAULT_INTERFACE_FALLBACK_HEIGHT` if unset. */
  readonly fallbackHeight?: number;
}

/**
 * An id the system knows but `getFieldInterface` does not resolve. A field
 * stored with it renders through its field type's default.
 */
export interface UnrenderedInterfaceEntry extends InterfaceManifestEntryBase {
  readonly renders: false;
  /** Export name of the registry component, or null when there is no component. */
  readonly exportName: string | null;
  readonly typeLiterals?: never;
  readonly provision?: never;
  readonly loading?: never;
  readonly fallbackHeight?: never;
}

export type InterfaceManifestEntry = RenderedInterfaceEntry | UnrenderedInterfaceEntry;

export const INTERFACE_MANIFEST = [
  // ── Provisionable, in picker order ──────────────────────────────────────
  {
    id: 'input',
    renders: true,
    typeLiterals: ['number', 'uuid'],
    exportName: 'Input',
    registryComponent: 'input',
    types: ['string', 'text', 'integer', 'bigInteger', 'float', 'decimal'],
    group: 'standard',
    provision: { label: 'Text input', group: 'Text', labelKey: 'input' },
    loading: 'eager',
  },
  {
    id: 'input-multiline',
    renders: true,
    aliases: { legacy: ['textarea'] },
    typeLiterals: ['textarea'],
    exportName: 'Textarea',
    registryComponent: 'textarea',
    types: ['string', 'text'],
    group: 'standard',
    provision: { label: 'Multiline text', group: 'Text', labelKey: 'inputMultiline' },
    loading: 'eager',
  },
  {
    id: 'input-code',
    renders: true,
    exportName: 'InputCode',
    registryComponent: 'input-code',
    types: ['string', 'text', 'json'],
    group: 'standard',
    provision: { label: 'Code / JSON', group: 'Text', labelKey: 'inputCode' },
    loading: 'eager',
  },
  {
    id: 'input-hash',
    renders: true,
    exportName: 'InputHash',
    registryComponent: 'input-hash',
    types: ['hash'],
    group: 'other',
    flags: { concealing: true },
    provision: { label: 'Hash (masked)', group: 'Text', labelKey: 'inputHash' },
    loading: 'eager',
  },
  {
    id: 'tags',
    renders: true,
    aliases: { registry: ['input-tags'] },
    exportName: 'Tags',
    registryComponent: 'tags',
    types: ['json', 'csv'],
    group: 'standard',
    provision: { label: 'Tags', group: 'Text', labelKey: 'tags' },
    loading: 'eager',
  },
  {
    id: 'input-rich-text-html',
    renders: true,
    aliases: { legacy: ['wysiwyg'] },
    exportName: 'RichTextHTML',
    registryComponent: 'rich-text-html',
    types: ['text'],
    group: 'standard',
    provision: { label: 'Rich text (WYSIWYG)', group: 'Rich content', labelKey: 'inputRichTextHtml' },
    loading: 'lazy',
    fallbackHeight: 240,
  },
  {
    id: 'input-rich-text-md',
    renders: true,
    aliases: { legacy: ['markdown'] },
    exportName: 'RichTextMarkdown',
    registryComponent: 'rich-text-markdown',
    types: ['text'],
    group: 'standard',
    provision: { label: 'Rich text (Markdown)', group: 'Rich content', labelKey: 'inputRichTextMd' },
    loading: 'lazy',
    fallbackHeight: 240,
  },
  {
    id: 'input-block-editor',
    renders: true,
    exportName: 'InputBlockEditor',
    registryComponent: 'input-block-editor',
    types: ['json', 'text'],
    group: 'standard',
    provision: { label: 'Block editor', group: 'Rich content', labelKey: 'inputBlockEditor' },
    loading: 'client-only',
    fallbackHeight: 200,
  },
  {
    id: 'select-dropdown',
    renders: true,
    exportName: 'SelectDropdown',
    registryComponent: 'select-dropdown',
    types: ['string', 'integer', 'bigInteger', 'float', 'decimal'],
    group: 'selection',
    flags: { choices: true },
    provision: { label: 'Dropdown (choices)', group: 'Selection', labelKey: 'selectDropdown' },
    loading: 'eager',
  },
  {
    id: 'select-radio',
    renders: true,
    exportName: 'SelectRadio',
    registryComponent: 'select-radio',
    types: ['string', 'integer'],
    group: 'selection',
    flags: { choices: true },
    provision: { label: 'Radio (choices)', group: 'Selection', labelKey: 'selectRadio' },
    loading: 'eager',
  },
  {
    id: 'select-multiple-checkbox',
    renders: true,
    exportName: 'SelectMultipleCheckbox',
    registryComponent: 'select-multiple-checkbox',
    types: ['json', 'csv'],
    group: 'selection',
    flags: { choices: true, csvMultiValue: true },
    provision: { label: 'Checkboxes (multiple)', group: 'Selection', labelKey: 'selectMultipleCheckbox' },
    loading: 'eager',
  },
  {
    id: 'select-multiple-checkbox-tree',
    renders: true,
    exportName: 'SelectMultipleCheckboxTree',
    registryComponent: 'select-multiple-checkbox-tree',
    types: ['json', 'csv'],
    group: 'selection',
    flags: { choices: true, csvMultiValue: true },
    provision: { label: 'Checkboxes (tree)', group: 'Selection', labelKey: 'selectMultipleCheckboxTree' },
    loading: 'eager',
  },
  {
    id: 'select-multiple-dropdown',
    renders: true,
    exportName: 'SelectMultipleDropdown',
    registryComponent: 'select-multiple-dropdown',
    types: ['json', 'csv'],
    group: 'selection',
    flags: { choices: true, csvMultiValue: true },
    provision: { label: 'Multi-select dropdown', group: 'Selection', labelKey: 'selectMultipleDropdown' },
    loading: 'eager',
  },
  {
    id: 'select-icon',
    renders: true,
    exportName: 'SelectIcon',
    registryComponent: 'select-icon',
    types: ['string'],
    group: 'selection',
    provision: { label: 'Icon picker', group: 'Selection', labelKey: 'selectIcon' },
    loading: 'lazy',
  },
  {
    id: 'select-color',
    renders: true,
    exportName: 'Color',
    registryComponent: 'color',
    types: ['string'],
    group: 'selection',
    provision: { label: 'Color picker', group: 'Selection', labelKey: 'selectColor' },
    loading: 'eager',
  },
  {
    id: 'boolean',
    renders: true,
    exportName: 'Boolean',
    registryComponent: 'boolean',
    types: ['boolean'],
    group: 'standard',
    provision: { label: 'Checkbox', group: 'Selection', labelKey: 'boolean' },
    loading: 'eager',
  },
  {
    id: 'toggle',
    renders: true,
    exportName: 'Toggle',
    registryComponent: 'toggle',
    types: ['boolean'],
    group: 'standard',
    provision: { label: 'Toggle', group: 'Selection', labelKey: 'toggle' },
    loading: 'eager',
  },
  {
    id: 'slider',
    renders: true,
    exportName: 'Slider',
    registryComponent: 'slider',
    types: ['integer', 'bigInteger', 'float', 'decimal'],
    group: 'standard',
    provision: { label: 'Slider', group: 'Numeric & date', labelKey: 'slider' },
    loading: 'eager',
  },
  {
    id: 'datetime',
    renders: true,
    exportName: 'DateTime',
    registryComponent: 'datetime',
    types: ['dateTime', 'date', 'time', 'timestamp'],
    group: 'standard',
    provision: { label: 'Date / time picker', group: 'Numeric & date', labelKey: 'datetime' },
    loading: 'eager',
  },
  {
    // `input-map-gl` is registry component `map-with-real-map`'s id, yet it
    // renders this placeholder `Map`, not MapWithRealMap.
    id: 'map',
    renders: true,
    aliases: { registry: ['input-map', 'input-map-gl'] },
    exportName: 'Map',
    registryComponent: 'map',
    types: ['geometry', 'json', 'text'],
    group: 'standard',
    provision: { label: 'Map (geometry)', group: 'Geospatial', labelKey: 'map' },
    loading: 'lazy',
    fallbackHeight: 500,
  },

  // ── Other inputs ────────────────────────────────────────────────────────
  {
    // Needs meta.options.url etc., so it is not provisionable (see interface-catalog).
    id: 'input-autocomplete-api',
    renders: true,
    exportName: 'AutocompleteAPI',
    registryComponent: 'autocomplete-api',
    types: ['string'],
    group: 'selection',
    loading: 'lazy',
  },

  // ── Relational ──────────────────────────────────────────────────────────
  {
    id: 'select-dropdown-m2o',
    renders: true,
    aliases: { legacy: ['list-m2o'] },
    typeLiterals: ['list-m2o'],
    exportName: 'SelectDropdownM2O',
    registryComponent: 'select-dropdown-m2o',
    types: ['string', 'integer', 'bigInteger', 'uuid'],
    group: 'relational',
    loading: 'eager',
  },
  {
    id: 'list-o2m',
    renders: true,
    exportName: 'ListO2M',
    registryComponent: 'list-o2m',
    types: ['alias'],
    group: 'relational',
    flags: { nonFlatRelational: true },
    relation: { kind: 'o2m', hookAliases: ['one-to-many'] },
    loading: 'lazy',
  },
  {
    id: 'list-m2m',
    renders: true,
    exportName: 'ListM2M',
    registryComponent: 'list-m2m',
    types: ['alias'],
    group: 'relational',
    flags: { nonFlatRelational: true },
    relation: { kind: 'm2m' },
    loading: 'lazy',
  },
  {
    id: 'list-m2a',
    renders: true,
    exportName: 'ListM2A',
    registryComponent: 'list-m2a',
    types: ['alias'],
    group: 'relational',
    flags: { nonFlatRelational: true },
    relation: { kind: 'm2a' },
    loading: 'lazy',
  },
  {
    id: 'collection-item-dropdown',
    renders: true,
    exportName: 'CollectionItemDropdown',
    registryComponent: 'collection-item-dropdown',
    types: ['string', 'integer', 'uuid'],
    group: 'relational',
    loading: 'lazy',
  },
  {
    id: 'file',
    renders: true,
    exportName: 'File',
    registryComponent: 'file',
    types: ['uuid'],
    group: 'relational',
    loading: 'lazy',
  },
  {
    id: 'file-image',
    renders: true,
    exportName: 'FileImage',
    registryComponent: 'file-image',
    types: ['uuid'],
    group: 'relational',
    loading: 'lazy',
    fallbackHeight: 220,
  },
  {
    id: 'files',
    renders: true,
    exportName: 'Files',
    registryComponent: 'files',
    types: ['alias'],
    group: 'relational',
    flags: { selfPersisting: true },
    loading: 'lazy',
  },
  {
    // A registry interface without a renderer case: a field stored with it
    // renders through its field type's default.
    id: 'upload',
    renders: false,
    exportName: 'Upload',
    registryComponent: 'upload',
    types: ['uuid'],
    group: 'relational',
  },

  // ── Presentation ────────────────────────────────────────────────────────
  {
    id: 'presentation-divider',
    renders: true,
    exportName: 'Divider',
    registryComponent: 'divider',
    types: ['alias'],
    group: 'presentation',
    flags: { presentation: true },
    loading: 'eager',
  },
  {
    id: 'presentation-notice',
    renders: true,
    exportName: 'Notice',
    registryComponent: 'notice',
    types: ['alias'],
    group: 'presentation',
    flags: { presentation: true },
    loading: 'eager',
  },
  {
    // Recognised as presentation-only (it stores no value) but has no
    // renderer case, registry entry or component.
    id: 'presentation-links',
    renders: false,
    exportName: null,
    registryComponent: null,
    types: [],
    group: 'presentation',
    flags: { presentation: true },
  },

  // ── Groups ──────────────────────────────────────────────────────────────
  {
    id: 'group-detail',
    renders: true,
    exportName: 'GroupDetail',
    registryComponent: 'group-detail',
    types: ['alias'],
    group: 'group',
    loading: 'eager',
  },
  {
    id: 'group-accordion',
    renders: true,
    exportName: 'GroupAccordion',
    registryComponent: 'group-accordion',
    types: ['alias'],
    group: 'group',
    loading: 'eager',
  },
  {
    id: 'group-raw',
    renders: true,
    exportName: 'GroupRaw',
    registryComponent: 'group-raw',
    types: ['alias'],
    group: 'group',
    loading: 'eager',
  },

  // ── Workflow ────────────────────────────────────────────────────────────
  {
    id: 'workflow-button',
    renders: true,
    aliases: {
      legacy: [
        'xtr-interface-workflow',
        'xtr-interface-workflow-old',
        'xtremax-workflow-button',
        'xtremax-workflow-button-v2',
        'xtremax-workflow-button-scheduled',
      ],
    },
    exportName: 'WorkflowButton',
    registryComponent: 'workflow-button',
    types: ['string', 'uuid'],
    group: 'workflow',
    loading: 'eager',
  },

  // ── System ──────────────────────────────────────────────────────────────
  {
    id: 'system-token',
    renders: true,
    exportName: 'SystemToken',
    registryComponent: 'system-token',
    types: ['hash'],
    group: 'other',
    flags: { concealing: true },
    loading: 'eager',
  },
  {
    id: 'system-permissions',
    renders: true,
    exportName: 'SystemPermissions',
    registryComponent: 'system-permissions',
    types: ['alias'],
    group: 'system',
    loading: 'lazy',
  },
] as const satisfies readonly InterfaceManifestEntry[];

/** An id `getFieldInterface` can return as `type` (a rendered entry's `id`). */
export type ManifestInterfaceId = Extract<(typeof INTERFACE_MANIFEST)[number], { renders: true }>['id'];

// ---------------------------------------------------------------------------
// Lookups and predicates (pure functions over the table above)
// ---------------------------------------------------------------------------

/** The table, widened to the entry type for lookups. */
const ENTRIES: readonly InterfaceManifestEntry[] = INTERFACE_MANIFEST;

const ENTRY_BY_ID: ReadonlyMap<string, InterfaceManifestEntry> = new Map(ENTRIES.map((e) => [e.id, e]));

/** Every registry and legacy alias → its entry's `id`. */
const ID_BY_ALIAS: ReadonlyMap<string, string> = new Map(
  ENTRIES.flatMap((e) =>
    [...(e.aliases?.registry ?? []), ...(e.aliases?.legacy ?? [])].map((alias) => [alias, e.id] as const),
  ),
);

/** Prefix of the DaaS presentation interface ids (`presentation-divider`, …). */
export const PRESENTATION_INTERFACE_PREFIX = 'presentation-';

/**
 * Resolve a registry or legacy alias to its renderer id; any other id comes
 * back unchanged. Matching is exact (no case or whitespace folding).
 */
export function normalizeInterfaceId(interfaceId: string): string {
  return ID_BY_ALIAS.get(interfaceId) ?? interfaceId;
}

/**
 * The manifest entry an interface id names, through its aliases too;
 * undefined for an unknown id or a non-string.
 */
export function getInterfaceManifestEntry(interfaceId: unknown): InterfaceManifestEntry | undefined {
  if (typeof interfaceId !== 'string') return undefined;
  return ENTRY_BY_ID.get(normalizeInterfaceId(interfaceId));
}

/** `alias → id` for one kind of alias, in manifest order. */
export function interfaceAliasMap(kind: keyof InterfaceAliases): Record<string, string> {
  return Object.fromEntries(ENTRIES.flatMap((e) => (e.aliases?.[kind] ?? []).map((alias) => [alias, e.id])));
}

/** Ids of the entries that carry `flag`, in manifest order. */
export function interfaceIdsWithFlag(flag: keyof InterfaceFlags): string[] {
  return ENTRIES.filter((e) => e.flags?.[flag] === true).map((e) => e.id);
}

/** Whether the interface an id names (through its aliases too) carries `flag`. */
export function interfaceHasFlag(interfaceId: unknown, flag: keyof InterfaceFlags): boolean {
  return getInterfaceManifestEntry(interfaceId)?.flags?.[flag] === true;
}

/**
 * Presentation-only interface: stores no value. Includes `presentation-links`,
 * which has no renderer.
 */
export function isPresentationInterface(interfaceId: unknown): boolean {
  return interfaceHasFlag(interfaceId, 'presentation');
}

/** Presentation-only interface that VForm renders (`presentation-divider`, `presentation-notice`). */
export function isRenderedPresentationInterface(interfaceId: unknown): boolean {
  const entry = getInterfaceManifestEntry(interfaceId);
  return !!entry && entry.renders && entry.flags?.presentation === true;
}

/**
 * Any `presentation-*` id, known to the manifest or not (a project's own
 * presentation interface, for one). Wider than `isPresentationInterface`.
 */
export function isPresentationLikeInterface(interfaceId: unknown): boolean {
  return typeof interfaceId === 'string' && interfaceId.startsWith(PRESENTATION_INTERFACE_PREFIX);
}

/** A relational interface with no flat column: not fetchable as a bare field name. */
export function isNonFlatRelationalInterface(interfaceId: unknown): boolean {
  return interfaceHasFlag(interfaceId, 'nonFlatRelational');
}

/** An interface that saves its own value (junction rows) apart from the item save. */
export function isSelfPersistingInterface(interfaceId: unknown): boolean {
  return interfaceHasFlag(interfaceId, 'selfPersisting');
}

/**
 * Whether an id names the list interface of `relation` (`list-o2m`, …), as
 * that relation's hook accepts it: the `id`, its aliases, or a `hookAliases`
 * id (`one-to-many` for o2m).
 */
export function isRelationListInterface(interfaceId: unknown, relation: InterfaceRelation): boolean {
  if (typeof interfaceId !== 'string') return false;
  return ENTRIES.some(
    (e) =>
      e.relation?.kind === relation &&
      (e.id === normalizeInterfaceId(interfaceId) || (e.relation.hookAliases ?? []).includes(interfaceId)),
  );
}
