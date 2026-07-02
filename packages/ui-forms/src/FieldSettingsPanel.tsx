/**
 * FieldSettingsPanel
 *
 * Settings for the currently selected field in the `FormBuilder`: width
 * (half/full), the `required` / `readonly` / `hidden` overrides, a label/help
 * note override, and the embedded `ConditionsEditor`. Edits are emitted as a
 * partial `FormFieldConfig` patch which the builder merges into the definition.
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
import { ConditionsEditor } from './ConditionsEditor';
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
}

/**
 * Edit the layout/override settings + conditions of the selected field.
 */
export function FieldSettingsPanel({
  schemaField,
  config,
  fields,
  onChange,
}: FieldSettingsPanelProps) {
  const displayName = schemaField.meta?.note || schemaField.field;

  return (
    <Stack gap="sm">
      <div>
        <Text size="sm" fw={600}>
          {displayName}
        </Text>
        <Badge size="xs" variant="light" color="gray">
          {schemaField.field} · {schemaField.type}
        </Badge>
      </div>

      <div>
        <Text size="xs" fw={500} mb={4}>
          Width
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          value={config.width ?? 'full'}
          onChange={(value) =>
            onChange({ width: value as FormFieldConfig['width'] })
          }
          data={[
            { label: 'Half', value: 'half' },
            { label: 'Full', value: 'full' },
          ]}
        />
      </div>

      <Stack gap={6}>
        <Switch
          size="sm"
          label="Required"
          checked={config.required ?? false}
          onChange={(e) => onChange({ required: e.currentTarget.checked })}
        />
        <Switch
          size="sm"
          label="Read-only"
          checked={config.readonly ?? false}
          onChange={(e) => onChange({ readonly: e.currentTarget.checked })}
        />
        <Switch
          size="sm"
          label="Hidden"
          checked={config.hidden ?? false}
          onChange={(e) => onChange({ hidden: e.currentTarget.checked })}
        />
      </Stack>

      <TextInput
        size="xs"
        label="Label / help override"
        description="Leave blank to use the schema display name"
        placeholder={displayName}
        value={config.note ?? ''}
        onChange={(e) =>
          onChange({ note: e.currentTarget.value || undefined })
        }
      />

      <Divider my="xs" />

      <ConditionsEditor
        fields={fields}
        conditions={config.conditions ?? []}
        onChange={(conditions: FieldCondition[]) => onChange({ conditions })}
      />
    </Stack>
  );
}

export default FieldSettingsPanel;
