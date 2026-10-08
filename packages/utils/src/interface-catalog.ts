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
 * `types` is therefore a **mirror of the registry's declared compatibility, not
 * a claim about the leaf component's standalone capability.** The two can
 * disagree: a `csv` column hands the interface a comma-separated string rather
 * than an array, and the FormFieldInterface pipeline normalizes that for its
 * multi-select leaves — but a consumer who installs a leaf through the registry
 * and renders it directly gets the raw string. `tests/interface-catalog.test.ts`
 * pins this file against `registry.json` in both directions; whether a given
 * leaf actually honours a declared type is the leaf's own test's job.
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
 * provisionable as a single column (a later pass). Also excluded, and easy to
 * mistake for an oversight because it sits in the registry's `selection` group:
 *   - `input-autocomplete-api` — needs `meta.options.url` (plus
 *     `resultsPath`/`textPath`/`valuePath`) pointing at an external endpoint.
 *     The component no-ops without it and the builder has no editor for those
 *     options, so it is not provisionable from a column type alone.
 * Record any future exclusion both here and in the `INTENTIONALLY_EXCLUDED`
 * table in `tests/interface-catalog.test.ts` — that test walks
 * registry → catalog and will otherwise fail, which is the point: a genuine
 * omission cannot ship silently the way the `select-multiple-checkbox-tree`
 * entry once did.
 *
 * @module @buildpad/utils/interface-catalog
 */

import type { FieldType } from './interface-types';
import {
  INTERFACE_MANIFEST,
  interfaceIdsWithFlag,
  type InterfaceManifestEntry,
  type ProvisionableInterfaceGroup,
} from './interface-manifest';

/** Group buckets shown in the interface picker (defined with the manifest). */
export type { ProvisionableInterfaceGroup };

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

/** The manifest, widened to its entry type for filtering. */
const manifestEntries: readonly InterfaceManifestEntry[] = INTERFACE_MANIFEST;

/**
 * The provisionable scalar/selection interfaces, with `value` = renderer id and
 * `types` = `registry.json` compatibility, in picker order: the manifest
 * entries that carry a `provision` descriptor (interface-manifest.ts). Rich
 * content needs @buildpad/ui-forms' interface-rendering peer deps, and the map
 * needs maplibre-gl + @mapbox/mapbox-gl-draw.
 */
export const PROVISIONABLE_INTERFACES: ProvisionableInterface[] = manifestEntries.flatMap((entry) =>
  entry.provision
    ? [{ value: entry.id, label: entry.provision.label, group: entry.provision.group, types: [...entry.types] }]
    : [],
);

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
 * checkbox/multi-select groups): the manifest's `choices` flag. Kept here —
 * alongside the catalog — so both the "Add field" modal and the settings panel
 * share one source of truth (and unit tests can assert it). Values are
 * renderer-recognized interface ids.
 */
export const CHOICE_INTERFACES: ReadonlySet<string> = new Set(interfaceIdsWithFlag('choices'));

/**
 * Whether an interface needs an author-supplied choices list. Used to gate the
 * choices editor and to block a save when a choice field has no choices.
 */
export function interfaceRequiresChoices(interfaceValue: string): boolean {
  return CHOICE_INTERFACES.has(interfaceValue);
}

/** A single authored choice: display `text`, stored `value`. */
export interface InterfaceChoice {
  text: string;
  value: string | number | boolean;
}

/**
 * Resolve a stored value to its authored choice label.
 *
 * Two passes on purpose. An exact match anywhere in the list must beat a
 * stringified match earlier in it: a single `find` whose predicate ORs both
 * forms returns index 0's loose hit before index 1's exact one, so
 * `[{value:'1'},{value:1}]` resolves a stored number 1 to the STRING choice.
 *
 * The loose pass is still needed rather than optional — the choices editor
 * only ever authors string values, so every stored number or boolean reaches
 * its label through stringification — but it must run second.
 *
 * Returns `undefined` when nothing matches, so callers can decide between a
 * raw-value fallback and an empty-cell placeholder.
 */
export function resolveChoiceLabel(
  choices: readonly InterfaceChoice[],
  value: unknown,
): string | undefined {
  const exact = choices.find((c) => c.value === value);
  if (exact) return exact.text;
  const loose = choices.find((c) => String(c.value) === String(value));
  return loose ? loose.text : undefined;
}

/**
 * Normalise a stored multi-select value into the individual choice values it
 * holds, or null when the value is a single choice rather than a collection.
 *
 * The same interface is persisted three different ways depending on the column
 * type it is attached to: a real array (json columns), a JSON array that
 * arrives still encoded as a string, and a comma-separated string (csv
 * columns). Callers should not have to know which one they were handed.
 */
export function parseChoiceValues(
  value: unknown,
  choices: readonly InterfaceChoice[],
): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON after all — read it as csv below rather than giving up.
    }
  }

  // A whole-string match wins over splitting: a configured choice value may
  // itself contain a comma, and splitting first would make it unfindable.
  if (resolveChoiceLabel(choices, value) !== undefined) return null;

  return value.includes(",") ? splitCsvValue(value) : null;
}

/**
 * Split a csv-stored multi-value into its parts, trimming each and dropping
 * empties.
 *
 * `type === 'csv'` is the documented signal, but some backends report the
 * underlying column type instead, so an observed string is trusted too —
 * matching what the multi-select leaves do rather than gating on type alone.
 */
export function splitCsvValue(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
