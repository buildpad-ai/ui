/**
 * Provisionable interface catalog
 *
 * The curated set of DaaS interfaces the form-builder can put on a **real,
 * provisioned column** — the scalar/selection subset of `@buildpad/ui-interfaces`.
 * Used to drive a **type-aware** interface picker: only interfaces whose `types`
 * include the selected field type are offered (mirroring how the DaaS data-model
 * UI filters interfaces).
 *
 * Two ids conventions exist in the stack and they don't fully agree:
 *   - `registry.json` / the DaaS `/api/interfaces` catalog use ids like
 *     `input-tags`, `input-rich-text-html`, `select-color`.
 *   - the runtime renderer `getFieldInterface` (`field-interface-mapper.ts`)
 *     resolves the interface component by a slightly different id set — e.g. it
 *     renders `tags` (not `input-tags`).
 * Because the value we store in `meta.interface` must be what the renderer can
 * actually resolve, **`value` here is the renderer-recognized id** while the
 * `types` compatibility mirrors `registry.json`.
 *
 * Every interface listed here renders through `@buildpad/ui-interfaces`. The
 * ones that need extra rendering libraries — rich text (`@mantine/tiptap` +
 * `@tiptap/*`), block editor (`@editorjs/*`), and map (`maplibre-gl` +
 * `@mapbox/mapbox-gl-draw`) — are declared as **peer dependencies of
 * `@buildpad/ui-forms`** (the heavy per-interface ones are optional in
 * `peerDependenciesMeta`), so a scaffolded consumer that installs the form
 * builder gets them (they also arrive per-interface through the registry, since
 * `form-builder` → `collection-form` → `vform` pulls every interface). Excluded
 * still are relational (m2o/o2m/m2m/m2a), file, and group/presentation
 * interfaces: they need relations, junctions, or store no value, so they are not
 * provisionable as a single column (a later pass).
 *
 * @module @buildpad/utils/interface-catalog
 */

import type { FieldType } from './interface-types';

/** Group buckets shown in the interface picker. */
export type ProvisionableInterfaceGroup =
  | 'Text'
  | 'Rich content'
  | 'Selection'
  | 'Numeric & date'
  | 'Geospatial';

/** A picker-ready interface descriptor for a provisionable real column. */
export interface ProvisionableInterface {
  /** Renderer-recognized id stored in `meta.interface` (see module note). */
  value: string;
  /** Human label shown in the picker. */
  label: string;
  /** Group bucket for the picker. */
  group: ProvisionableInterfaceGroup;
  /** Field types this interface is compatible with (mirrors `registry.json`). */
  types: FieldType[];
}

/**
 * The provisionable scalar/selection interfaces, with `value` = renderer id and
 * `types` = `registry.json` compatibility. Keep every `value` in sync with a
 * `case` in `field-interface-mapper.ts` `getFieldInterface`.
 */
export const PROVISIONABLE_INTERFACES: ProvisionableInterface[] = [
  // Text
  { value: 'input', label: 'Text input', group: 'Text', types: ['string', 'text', 'integer', 'bigInteger', 'float', 'decimal'] },
  { value: 'input-multiline', label: 'Multiline text', group: 'Text', types: ['string', 'text'] },
  { value: 'input-code', label: 'Code / JSON', group: 'Text', types: ['string', 'text', 'json'] },
  { value: 'input-hash', label: 'Hash (masked)', group: 'Text', types: ['hash'] },
  { value: 'tags', label: 'Tags', group: 'Text', types: ['json', 'csv'] },
  // Rich content (need @buildpad/ui-forms' interface-rendering peer deps)
  { value: 'input-rich-text-html', label: 'Rich text (WYSIWYG)', group: 'Rich content', types: ['text'] },
  { value: 'input-rich-text-md', label: 'Rich text (Markdown)', group: 'Rich content', types: ['text'] },
  { value: 'input-block-editor', label: 'Block editor', group: 'Rich content', types: ['json', 'text'] },
  // Selection
  { value: 'select-dropdown', label: 'Dropdown (choices)', group: 'Selection', types: ['string', 'integer', 'bigInteger', 'float', 'decimal'] },
  { value: 'select-radio', label: 'Radio (choices)', group: 'Selection', types: ['string', 'integer'] },
  { value: 'select-multiple-checkbox', label: 'Checkboxes (multiple)', group: 'Selection', types: ['json', 'csv'] },
  { value: 'select-multiple-dropdown', label: 'Multi-select dropdown', group: 'Selection', types: ['json', 'csv'] },
  { value: 'select-icon', label: 'Icon picker', group: 'Selection', types: ['string'] },
  { value: 'select-color', label: 'Color picker', group: 'Selection', types: ['string'] },
  { value: 'boolean', label: 'Checkbox', group: 'Selection', types: ['boolean'] },
  { value: 'toggle', label: 'Toggle', group: 'Selection', types: ['boolean'] },
  // Numeric & date
  { value: 'slider', label: 'Slider', group: 'Numeric & date', types: ['integer', 'bigInteger', 'float', 'decimal'] },
  { value: 'datetime', label: 'Date / time picker', group: 'Numeric & date', types: ['dateTime', 'date', 'time', 'timestamp'] },
  // Geospatial (needs maplibre-gl + @mapbox/mapbox-gl-draw)
  { value: 'map', label: 'Map (geometry)', group: 'Geospatial', types: ['geometry', 'json', 'text'] },
];

/**
 * The provisionable interfaces compatible with a given field `type`, in catalog
 * order. Returns `[]` for a type with no provisionable interface.
 */
export function provisionableInterfacesForType(
  type: string,
): ProvisionableInterface[] {
  return PROVISIONABLE_INTERFACES.filter((i) =>
    i.types.includes(type as FieldType),
  );
}

/**
 * Interfaces that require an author-supplied **choices** list (dropdowns, radios,
 * checkbox/multi-select groups). Kept here — alongside the catalog — so both the
 * "Add field" modal and the settings panel share one source of truth (and unit
 * tests can assert it). Values are renderer-recognized interface ids.
 */
export const CHOICE_INTERFACES: ReadonlySet<string> = new Set([
  'select-dropdown',
  'select-radio',
  'select-multiple-checkbox',
  'select-multiple-dropdown',
]);

/**
 * Whether an interface needs an author-supplied choices list. Used to gate the
 * choices editor and to block a save when a choice field has no choices.
 */
export function interfaceRequiresChoices(interfaceValue: string): boolean {
  return CHOICE_INTERFACES.has(interfaceValue);
}
