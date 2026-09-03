/**
 * FieldSettingsPanel
 *
 * Settings for the currently selected field in the `FormBuilder`: width
 * (half/full), the `required` / `readonly` / `hidden` overrides, a label/help
 * note override, and the embedded `ConditionsEditor`. Edits are emitted as a
 * partial `FormFieldConfig` patch which the builder merges into the definition.
 *
 * For a **new field created from the field-type catalog** (a deferred real
 * column not yet provisioned), the panel additionally edits the field's
 * **label** and — for a **choice interface** — its **choices**, writing them
 * back into the pending `FieldSpec` via the `onNewFieldLabelChange` /
 * `onNewFieldChoicesChange` callbacks. The **column name is read-only** (fixed
 * at the name prompt; DaaS columns aren't renamable — Req 1.2a).
 *
 * @package @buildpad/ui-forms
 */

'use client';

import {
  Badge,
  Divider,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type FormsTranslations } from '@buildpad/utils';
import { ConditionsEditor } from './ConditionsEditor';
import { ChoicesInput, type Choice } from './ChoicesInput';
import type { Field, FieldCondition, FormFieldConfig } from '@buildpad/types';

export interface FieldSettingsPanelProps {
  /** The schema field backing the selected config (for label/type display). */
  schemaField: Field;
  /** The selected field's current config. */
  config: FormFieldConfig;
  /** All collection fields (passed to `ConditionsEditor`'s `FilterPanel`). */
  fields: Field[];
  /** Emit a partial config patch to merge into the definition. */
  onChange: (patch: Partial<FormFieldConfig>) => void;
  /**
   * True when the selected field is a **deferred new real column** (from the
   * catalog, not yet provisioned). Enables label/choices editing and locks the
   * column name.
   */
  isNewColumn?: boolean;
  /** Whether this field's interface needs a choices list (choice interface). */
  requiresChoices?: boolean;
  /** Update the pending field's label (new columns only). */
  onNewFieldLabelChange?: (label: string | undefined) => void;
  /** Update the pending field's choices (new choice columns only). */
  onNewFieldChoicesChange?: (choices: Choice[] | undefined) => void;
  /** Per-instance overrides of the dictionary strings (`forms` namespace). */
  translations?: DeepPartial<FormsTranslations>;
}

/**
 * Edit the layout/override settings + conditions of the selected field.
 */
export function FieldSettingsPanel({
  schemaField,
  config,
  fields,
  onChange,
  isNewColumn = false,
  requiresChoices = false,
  onNewFieldLabelChange,
  onNewFieldChoicesChange,
  translations,
}: FieldSettingsPanelProps) {
  const t = useBuildpadTranslations((d) => d.forms, translations);
  const s = t.fieldSettingsPanel;
  const displayName = schemaField.meta?.note || schemaField.field;
  const currentChoices = (schemaField.meta?.options as { choices?: Choice[] })
    ?.choices;

  return (
    <Stack gap="sm">
      <div>
        <Text size="sm" fw={600}>
          {displayName}
        </Text>
        <Badge size="xs" variant="light" color="gray">
          {interpolate(s.fieldBadge, {
            field: schemaField.field,
            type: schemaField.type,
          })}
        </Badge>
        {isNewColumn && (
          <Text size="10px" c="dimmed" mt={2}>
            {s.newColumnLocked}
          </Text>
        )}
      </div>

      {isNewColumn && (
        <>
          <TextInput
            size="xs"
            label={s.newLabel.label}
            description={s.newLabel.description}
            placeholder={schemaField.field}
            value={schemaField.meta?.note ?? ''}
            onChange={(e) =>
              onNewFieldLabelChange?.(e.currentTarget.value || undefined)
            }
            data-testid="settings-new-label"
          />
          {requiresChoices && (
            <ChoicesInput
              key={schemaField.field}
              value={currentChoices}
              onChange={(choices) => onNewFieldChoicesChange?.(choices)}
              translations={translations}
            />
          )}
        </>
      )}

      <div>
        <Text size="xs" fw={500} mb={4}>
          {s.width.title}
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          value={config.width ?? 'full'}
          onChange={(value) =>
            onChange({ width: value as FormFieldConfig['width'] })
          }
          data={[
            { label: s.width.half, value: 'half' },
            { label: s.width.full, value: 'full' },
          ]}
        />
      </div>

      <Stack gap={6}>
        <Switch
          size="sm"
          label={s.overrides.required}
          checked={config.required ?? false}
          onChange={(e) => onChange({ required: e.currentTarget.checked })}
        />
        <Switch
          size="sm"
          label={s.overrides.readonly}
          checked={config.readonly ?? false}
          onChange={(e) => onChange({ readonly: e.currentTarget.checked })}
        />
        <Switch
          size="sm"
          label={s.overrides.hidden}
          checked={config.hidden ?? false}
          onChange={(e) => onChange({ hidden: e.currentTarget.checked })}
        />
      </Stack>

      {!isNewColumn && (
        <TextInput
          size="xs"
          label={s.noteOverride.label}
          description={s.noteOverride.description}
          placeholder={displayName}
          value={config.note ?? ''}
          onChange={(e) => onChange({ note: e.currentTarget.value || undefined })}
        />
      )}

      <Divider my="xs" />

      <ConditionsEditor
        fields={fields}
        conditions={config.conditions ?? []}
        onChange={(conditions: FieldCondition[]) => onChange({ conditions })}
        translations={translations}
      />
    </Stack>
  );
}

export default FieldSettingsPanel;
