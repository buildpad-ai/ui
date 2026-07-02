/**
 * AddFieldModal
 *
 * "Add field" flow for the `FormBuilder`. Lets an author define a brand-new
 * field — label, key, type, interface, options, and **storage** — then either
 * provisions it as a **real column** via the DDL API (`FieldsService.createField`,
 * optionally indexed) or carries it as an **extras** field (no DDL; its value
 * lives in the target collection's `extras` jsonb column and its descriptor is
 * stored inline in the definition).
 *
 * Real-column provisioning is gated on schema rights (`canProvisionSchema`);
 * when absent, only `extras` is offered. The actual create is delegated to the
 * `onCreate` callback so the parent owns the async work — if it throws, the error
 * is surfaced inline and the modal stays open so no draft state is lost
 * (Requirement 10.6).
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconColumns, IconBraces } from '@tabler/icons-react';
import { interfaceForFieldType, provisionableInterfacesForType } from '@buildpad/utils';
import type {
  ExtraFieldDescriptor,
  FieldSpec,
  FieldStore,
} from '@buildpad/types';

/** Result handed to the parent when the author submits the modal. */
export interface AddFieldResult {
  /** Where the answer is stored. */
  storage: FieldStore;
  /** Provisioning/placement spec (used for `createField` when `storage==='column'`). */
  spec: FieldSpec;
  /** Inline descriptor used to place an `extras` field in the definition. */
  extra: ExtraFieldDescriptor;
}

export interface AddFieldModalProps {
  /** Whether the modal is open. */
  opened: boolean;
  /** Close the modal (cancel). */
  onClose: () => void;
  /**
   * Whether real-column provisioning (DDL) is available. When `false`, only the
   * `extras` storage option is offered (real columns need DaaS schema rights).
   */
  canProvisionSchema: boolean;
  /**
   * Whether the target collection has an `extras` jsonb column (a **hybrid**
   * collection). When `false` (a **full** collection), the `extras` storage
   * option is unavailable and every new field is provisioned as a real column.
   * @default true
   */
  supportsExtras?: boolean;
  /** Existing field keys (schema + already-placed) to prevent collisions. */
  existingFieldNames: ReadonlySet<string>;
  /**
   * Prefill the **Type** when the modal opens — used by the palette's quick-add
   * field-type templates. @default 'string'
   */
  defaultType?: string;
  /**
   * Prefill the **Interface** when the modal opens (quick-add templates). Empty
   * means *Auto (from type)*. @default ''
   */
  defaultInterface?: string;
  /**
   * Perform the create. Throw to surface the error inline and keep the modal
   * open (so the in-progress field isn't lost). Resolve to close + reset.
   */
  onCreate: (result: AddFieldResult) => Promise<void>;
}

/** Scalar-first field types the builder can provision out of the box. */
const TYPE_OPTIONS = [
  { value: 'string', label: 'Text (short)' },
  { value: 'text', label: 'Text (long)' },
  { value: 'integer', label: 'Number (integer)' },
  { value: 'bigInteger', label: 'Number (big integer)' },
  { value: 'float', label: 'Number (decimal)' },
  { value: 'decimal', label: 'Number (fixed decimal)' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'dateTime', label: 'Date & time' },
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV (list of values)' },
];

/**
 * Interfaces that need an author-supplied choices list. The full provisionable
 * catalog (and its per-type compatibility) lives in `@buildpad/utils`
 * (`provisionableInterfacesForType`) and drives the type-aware picker below.
 */
const CHOICE_INTERFACES = new Set([
  'select-dropdown',
  'select-radio',
  'select-multiple-checkbox',
  'select-multiple-dropdown',
]);

/** Convert a label to a snake_case field key. */
function toFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

/** Parse a "label=value" / "value" per-line textarea into DaaS choices. */
function parseChoices(
  raw: string,
): { text: string; value: string }[] | undefined {
  const choices = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq === -1) return { text: line, value: line };
      return { text: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    });
  return choices.length > 0 ? choices : undefined;
}

/**
 * Modal form for defining and provisioning a new field.
 */
export function AddFieldModal({
  opened,
  onClose,
  canProvisionSchema,
  supportsExtras = true,
  existingFieldNames,
  defaultType,
  defaultInterface,
  onCreate,
}: AddFieldModalProps) {
  // In a full collection (no extras tail) every field must be a real column.
  // Otherwise fall back to extras only when real-column provisioning is unavailable.
  const defaultStorage: FieldStore =
    supportsExtras && !canProvisionSchema ? 'extras' : 'column';
  // A full collection with no schema rights can't take a new field either way.
  const cannotAddField = !supportsExtras && !canProvisionSchema;

  const [label, setLabel] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [fieldKey, setFieldKey] = useState('');
  const [type, setType] = useState(defaultType ?? 'string');
  const [interfaceId, setInterfaceId] = useState(defaultInterface ?? '');
  const [storage, setStorage] = useState<FieldStore>(defaultStorage);
  const [addIndex, setAddIndex] = useState(false);
  const [required, setRequired] = useState(false);
  const [choicesRaw, setChoicesRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply the quick-add seed (type/interface) each time the modal opens. The
  // rest of the form is cleared on close by `reset`, so opening always starts
  // from the seed (or the defaults when opened via the plain "Add field" button).
  useEffect(() => {
    if (opened) {
      setType(defaultType ?? 'string');
      setInterfaceId(defaultInterface ?? '');
    }
  }, [opened, defaultType, defaultInterface]);

  // The key auto-tracks the label until the author edits it directly.
  const effectiveKey = keyTouched ? fieldKey : toFieldKey(label);
  const resolvedInterface = interfaceId || interfaceForFieldType(type);
  const isChoiceInterface = CHOICE_INTERFACES.has(resolvedInterface);

  // Type-aware interface picker: only interfaces compatible with the chosen type,
  // grouped, plus an "Auto (from type)" default — mirroring how the DaaS data-model
  // UI filters interfaces by type.
  const interfaceData = useMemo(() => {
    const groups = new Map<string, { value: string; label: string }[]>();
    for (const i of provisionableInterfacesForType(type)) {
      const items = groups.get(i.group) ?? [];
      items.push({ value: i.value, label: i.label });
      groups.set(i.group, items);
    }
    return [
      { value: '', label: `Auto (${interfaceForFieldType(type)})` },
      ...[...groups.entries()].map(([group, items]) => ({ group, items })),
    ];
  }, [type]);

  // Changing the type can make the chosen interface incompatible → reset to Auto.
  const handleTypeChange = (next: string) => {
    setType(next);
    if (
      interfaceId &&
      !provisionableInterfacesForType(next).some((i) => i.value === interfaceId)
    ) {
      setInterfaceId('');
    }
  };

  const keyError = useMemo(() => {
    if (!effectiveKey) return 'A field key is required';
    if (!/^[a-z][a-z0-9_]*$/.test(effectiveKey))
      return 'Use lowercase letters, numbers and underscores (start with a letter)';
    if (existingFieldNames.has(effectiveKey)) return 'A field with this key already exists';
    return null;
  }, [effectiveKey, existingFieldNames]);

  const reset = () => {
    setLabel('');
    setKeyTouched(false);
    setFieldKey('');
    setType('string');
    setInterfaceId('');
    setStorage(defaultStorage);
    setAddIndex(false);
    setRequired(false);
    setChoicesRaw('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (keyError) return;
    setSubmitting(true);
    setError(null);

    const options = isChoiceInterface
      ? { choices: parseChoices(choicesRaw) }
      : undefined;

    const spec: FieldSpec = {
      field: effectiveKey,
      type,
      interface: interfaceId || undefined,
      label: label.trim() || undefined,
      options: options?.choices ? options : undefined,
      required,
      addIndex: storage === 'column' ? addIndex : undefined,
    };

    const extra: ExtraFieldDescriptor = {
      type,
      interface: resolvedInterface,
      label: label.trim() || undefined,
      options: options?.choices ? options : undefined,
    };

    try {
      await onCreate({ storage, spec, extra });
      reset();
      onClose();
    } catch (err) {
      // Keep the modal open with the draft intact (Req 10.6).
      setError(err instanceof Error ? err.message : 'Failed to create the field');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Add a field"
      centered
      data-testid="add-field-modal"
    >
      <Stack gap="sm">
        <TextInput
          label="Label"
          placeholder="e.g. Steps to reproduce"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Field key"
          description="Column / property name (snake_case)"
          placeholder="steps_to_reproduce"
          value={effectiveKey}
          onChange={(e) => {
            setKeyTouched(true);
            setFieldKey(toFieldKey(e.currentTarget.value));
          }}
          error={keyError && (keyTouched || label) ? keyError : null}
          data-testid="add-field-key"
        />

        <Group grow align="flex-start">
          <Select
            label="Type"
            data={TYPE_OPTIONS}
            value={type}
            onChange={(v) => handleTypeChange(v ?? 'string')}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <Select
            label="Interface"
            description="Only interfaces compatible with the type"
            data={interfaceData}
            value={interfaceId}
            onChange={(v) => setInterfaceId(v ?? '')}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>

        {isChoiceInterface && (
          <Textarea
            label="Choices"
            description="One per line. Use label=value to set a separate value."
            placeholder={'Low\nMedium\nHigh'}
            autosize
            minRows={2}
            maxRows={6}
            value={choicesRaw}
            onChange={(e) => setChoicesRaw(e.currentTarget.value)}
          />
        )}

        <div>
          <Text size="sm" fw={500} mb={4}>
            Storage
          </Text>
          {supportsExtras ? (
            <>
              <SegmentedControl
                fullWidth
                value={storage}
                onChange={(v) => setStorage(v as FieldStore)}
                data={[
                  {
                    value: 'column',
                    disabled: !canProvisionSchema,
                    label: (
                      <Group gap={6} justify="center" wrap="nowrap">
                        <IconColumns size={14} />
                        <span>Real column</span>
                      </Group>
                    ),
                  },
                  {
                    value: 'extras',
                    label: (
                      <Group gap={6} justify="center" wrap="nowrap">
                        <IconBraces size={14} />
                        <span>Extra (jsonb)</span>
                      </Group>
                    ),
                  },
                ]}
                data-testid="add-field-storage"
              />
              <Text size="xs" c="dimmed" mt={4}>
                {storage === 'column'
                  ? 'A real, searchable/sortable DaaS column provisioned via the schema API.'
                  : 'Stored in the collection’s extras jsonb column — not server-searchable or individually permissioned.'}
              </Text>
              {!canProvisionSchema && (
                <Text size="xs" c="dimmed" mt={2}>
                  Real-column provisioning needs DaaS schema rights, which you
                  don’t have — new fields are stored as extras.
                </Text>
              )}
            </>
          ) : (
            <Group gap={6} wrap="nowrap" data-testid="add-field-storage-full">
              <IconColumns size={14} />
              <Text size="xs" c={cannotAddField ? 'red' : 'dimmed'}>
                {cannotAddField
                  ? 'This full-storage collection has no extras tail, and adding a real column needs DaaS schema rights you don’t have.'
                  : 'Full-storage collection — every field is a real, searchable DaaS column (no extras tail).'}
              </Text>
            </Group>
          )}
        </div>

        <Switch
          size="sm"
          label="Required"
          checked={required}
          onChange={(e) => setRequired(e.currentTarget.checked)}
        />

        {storage === 'column' && (
          <Switch
            size="sm"
            label="Index this column"
            description="Create a B-tree index — pick this if the field will be filtered or sorted."
            checked={addIndex}
            onChange={(e) => setAddIndex(e.currentTarget.checked)}
          />
        )}

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            data-testid="add-field-error"
          >
            {error}
          </Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!!keyError || cannotAddField}
            data-testid="add-field-submit"
          >
            {storage === 'column' ? 'Create field' : 'Add extra field'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default AddFieldModal;
