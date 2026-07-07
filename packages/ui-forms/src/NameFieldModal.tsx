/**
 * NameFieldModal
 *
 * The minimal prompt shown when a **field-type catalog chip** is dropped on (or
 * clicked into) the builder canvas. The chip already carries the field's *type*
 * and *interface*, so this modal collects only the **column name** — a real DaaS
 * column name is snake_case and, once provisioned, **not renamable**, so it is
 * fixed here and shown read-only in the settings panel thereafter (Req 1.2a).
 *
 * The name is derived/validated with the same `toFieldKey` slug + rules as the
 * advanced `AddFieldModal`, and collisions are rejected against the builder's
 * `existingFieldNames` (schema + already-placed). Label and choices are
 * configured afterward in the settings panel (Req 6a); provisioning is deferred
 * to Save (Req 10.7).
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { toFieldKey, fieldKeyError } from './field-name';

export interface NameFieldModalProps {
  /** Whether the modal is open. */
  opened: boolean;
  /** Close the modal (cancel). */
  onClose: () => void;
  /** Human label of the interface being created (shown for context). */
  interfaceLabel?: string;
  /** Existing field keys (schema + already-placed) to prevent collisions. */
  existingFieldNames: ReadonlySet<string>;
  /** Confirm with the derived, validated column key. */
  onConfirm: (fieldKey: string) => void;
}

/**
 * Column-name-only prompt for a new catalog field.
 */
export function NameFieldModal({
  opened,
  onClose,
  interfaceLabel,
  existingFieldNames,
  onConfirm,
}: NameFieldModalProps) {
  const [name, setName] = useState('');

  // Start blank each time the modal opens.
  useEffect(() => {
    if (opened) setName('');
  }, [opened]);

  const fieldKey = toFieldKey(name);
  const keyError = useMemo(
    () => fieldKeyError(fieldKey, existingFieldNames),
    [fieldKey, existingFieldNames],
  );

  const handleConfirm = () => {
    if (keyError) return;
    onConfirm(fieldKey);
    setName('');
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Name the new field"
      centered
      data-testid="name-field-modal"
    >
      <Stack gap="sm">
        {interfaceLabel && (
          <Text size="xs" c="dimmed">
            New <strong>{interfaceLabel}</strong> field
          </Text>
        )}
        <TextInput
          label="Column name"
          description="The real column name (snake_case). This can’t be changed later."
          placeholder="e.g. steps_to_reproduce"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !keyError) handleConfirm();
          }}
          error={name ? keyError : null}
          data-autofocus
          data-testid="name-field-input"
        />
        {fieldKey && fieldKey !== name.trim() && (
          <Text size="xs" c="dimmed">
            Column: <strong>{fieldKey}</strong>
          </Text>
        )}
        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!!keyError}
            data-testid="name-field-submit"
          >
            Add field
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default NameFieldModal;
