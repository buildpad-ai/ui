/**
 * buildFieldsFromDefinition
 *
 * The overlay merge step of the Dynamic Form Builder. Merges a saved
 * `FormDefinition` onto a collection's live schema `Field[]` to produce the
 * `Field[]` consumed by `VForm` — the schema is never mutated.
 *
 * For each `FormFieldConfig` (in section then field order):
 *  - a real-column field (`store !== 'extras'`) is matched to its schema `Field`
 *    and overlaid with the per-field config (`width`, `required`, `readonly`,
 *    `hidden`, `note`, `conditions`);
 *  - an `extras` field (`store === 'extras'`) is **synthesized** from
 *    `config.extra`, since it is not in the DaaS schema;
 *  - a `store:'column'` field absent from the schema is **flagged "missing"** (a
 *    hidden presentation placeholder marked with `MISSING_FIELD_MARKER`) so the
 *    builder can prompt to provision it, while the runtime ignores it as data.
 *
 * Every emitted data field carries `meta.store` so the save path can route the
 * value to a real column or the `extras` jsonb tail. Each section is emitted as a
 * synthesized `group-raw` alias field. Schema fields absent from the definition
 * are dropped.
 *
 * @package @buildpad/utils
 */

import type {
  Field,
  FieldMeta,
  FormDefinition,
  FormFieldConfig,
  FormSection,
} from '@buildpad/types';
import { interfaceForFieldType } from './field-spec-mapper';

/**
 * Marker placed in `meta.special` of a synthesized placeholder for a
 * `store:'column'` field that is missing from the schema. The builder detects it
 * to prompt provisioning; the runtime treats it as a (hidden) presentation field
 * with no data.
 */
export const MISSING_FIELD_MARKER = '__missing__';

/** Synthesize a `group-raw` alias field that wraps a section's members. */
function synthesizeGroupField(
  section: FormSection,
  collection: string,
  sort: number,
): Field {
  return {
    collection,
    field: section.id,
    type: 'alias',
    meta: {
      id: -1,
      collection,
      field: section.id,
      special: ['alias', 'no-data', 'group'],
      interface: 'group-raw',
      options: null,
      readonly: false,
      hidden: false,
      sort,
      width: 'full',
      note: section.title ?? null,
      group: null,
      required: false,
    },
  };
}

/** Overlay a per-field config onto its schema field, producing a new Field. */
function applyConfig(
  base: Field,
  config: FormFieldConfig,
  sort: number,
  group: string | null,
): Field {
  const meta: FieldMeta = {
    ...(base.meta as FieldMeta),
    sort,
    group,
    // Real, searchable column unless the config opts into the extras tail.
    store: config.store === 'extras' ? 'extras' : 'column',
  };

  if (config.width !== undefined) meta.width = config.width;
  if (config.required !== undefined) meta.required = config.required;
  if (config.readonly !== undefined) meta.readonly = config.readonly;
  if (config.hidden !== undefined) meta.hidden = config.hidden;
  if (config.note !== undefined) meta.note = config.note;
  if (config.conditions !== undefined) meta.conditions = config.conditions;

  return { ...base, meta };
}

/**
 * Synthesize a `Field` for an `extras` config from its inline descriptor — the
 * field is not in the DaaS schema, so it is fully self-described. The value is
 * routed to the target collection's `extras` jsonb column via `meta.store`.
 */
function synthesizeExtraField(
  config: FormFieldConfig,
  collection: string,
  sort: number,
  group: string | null,
): Field {
  const extra = config.extra ?? { type: 'string' };
  const type = extra.type ?? 'string';

  const meta: FieldMeta = {
    id: -1,
    collection,
    field: config.field,
    interface: extra.interface ?? interfaceForFieldType(type),
    options: extra.options ?? null,
    readonly: config.readonly ?? false,
    hidden: config.hidden ?? false,
    sort,
    width: config.width ?? 'full',
    note: config.note ?? extra.label ?? null,
    group,
    required: config.required ?? false,
    store: 'extras',
  };

  if (config.conditions !== undefined) meta.conditions = config.conditions;

  return { collection, field: config.field, type, meta };
}

/**
 * Synthesize a hidden placeholder for a `store:'column'` field that is missing
 * from the schema. Flagged with `MISSING_FIELD_MARKER` in `meta.special` so the
 * builder can surface a "provision it" affordance; rendered as a hidden
 * presentation field so the runtime never binds it as data.
 */
function synthesizeMissingField(
  config: FormFieldConfig,
  collection: string,
  sort: number,
  group: string | null,
): Field {
  return {
    collection,
    field: config.field,
    type: 'unknown',
    meta: {
      id: -1,
      collection,
      field: config.field,
      special: [MISSING_FIELD_MARKER, 'no-data'],
      interface: 'presentation-notice',
      options: {
        text: `Field "${config.field}" is missing from the schema — provision it or remove it.`,
      },
      readonly: true,
      hidden: true,
      sort,
      width: config.width ?? 'full',
      note: config.note ?? null,
      group,
      required: false,
      store: 'column',
    },
  };
}

/**
 * Merge a form definition onto the collection's live schema fields.
 *
 * @param schemaFields The collection's `Field[]` (e.g. from `FieldsService.readAll`).
 * @param def          The saved form definition to overlay.
 * @returns A flat `Field[]` (section group fields + their members, in order)
 *          ready to pass to `VForm`/`CollectionForm`.
 */
export function buildFieldsFromDefinition(
  schemaFields: Field[],
  def: FormDefinition,
): Field[] {
  const byKey = new Map(schemaFields.map((f) => [f.field, f]));
  const collection = def.target_collection;
  const result: Field[] = [];
  let sort = 0;

  for (const section of def.sections ?? []) {
    result.push(synthesizeGroupField(section, collection, sort++));

    for (const config of section.fields ?? []) {
      if (config.store === 'extras') {
        result.push(synthesizeExtraField(config, collection, sort++, section.id));
        continue;
      }

      const base = byKey.get(config.field);
      if (!base) {
        // A real-column field that isn't in the schema — flag it for the builder.
        result.push(synthesizeMissingField(config, collection, sort++, section.id));
        continue;
      }

      result.push(applyConfig(base, config, sort++, section.id));
    }
  }

  return result;
}
