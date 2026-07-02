/**
 * ConditionsEditor
 *
 * Authors the `FieldCondition[]` array for a single field. Each condition pairs
 * a filter rule — built with the existing `FilterPanel` so the output is
 * DaaS-compatible filter JSON (`_eq`, `_in`, `_and`, `_or`, …) — with a set of
 * overrides (`hidden` / `required` / `readonly`, plus optional `options`).
 *
 * The emitted array is the exact shape consumed by `apply-conditions.ts`, so
 * the runtime applies it without translation. Order is preserved and meaningful:
 * when several conditions match, the LAST matching one wins (DaaS convention),
 * so adding appends and the list order is the precedence order.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import {
  ActionIcon,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { FilterPanel } from '@buildpad/ui-collections';
import type { Field, FieldCondition } from '@buildpad/types';

export interface ConditionsEditorProps {
  /** The collection's fields, used by `FilterPanel` to build rules. */
  fields: Field[];
  /** Current conditions for the selected field. */
  conditions: FieldCondition[];
  /** Emits the updated conditions array (verbatim `FieldCondition[]`). */
  onChange: (conditions: FieldCondition[]) => void;
}

/** A reasonable empty condition: no rule (never matches until authored). */
function emptyCondition(index: number): FieldCondition {
  return { name: `Condition ${index + 1}`, rule: {}, hidden: false };
}

/**
 * Manage the list of conditional rules + overrides for one field.
 */
export function ConditionsEditor({
  fields,
  conditions,
  onChange,
}: ConditionsEditorProps) {
  const update = (index: number, patch: Partial<FieldCondition>) => {
    onChange(
      conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const remove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...conditions, emptyCondition(conditions.length)]);
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          Conditions
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={add}
        >
          Add condition
        </Button>
      </Group>

      {conditions.length === 0 ? (
        <Text size="xs" c="dimmed">
          No conditions. The field is always shown with its default settings.
          Add a condition to show/hide, require, or lock the field based on
          other fields&apos; values.
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          When several conditions match, the last matching one wins.
        </Text>
      )}

      {conditions.map((condition, index) => (
        <Paper key={index} withBorder p="sm" radius="sm">
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start">
              <TextInput
                size="xs"
                label="Name"
                placeholder="e.g. Show when bug"
                value={condition.name ?? ''}
                onChange={(e) => update(index, { name: e.currentTarget.value })}
                style={{ flex: 1 }}
              />
              <Tooltip label="Remove condition">
                <ActionIcon
                  color="red"
                  variant="subtle"
                  mt={22}
                  onClick={() => remove(index)}
                  aria-label="Remove condition"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <div>
              <Text size="xs" fw={500} mb={4}>
                When
              </Text>
              <FilterPanel
                fields={fields}
                mode="inline"
                value={condition.rule ?? null}
                onChange={(rule) => update(index, { rule: rule ?? {} })}
              />
            </div>

            <div>
              <Text size="xs" fw={500} mb={4}>
                Then
              </Text>
              <Group gap="lg">
                <Switch
                  size="sm"
                  label="Hidden"
                  checked={condition.hidden ?? false}
                  onChange={(e) =>
                    update(index, { hidden: e.currentTarget.checked })
                  }
                />
                <Switch
                  size="sm"
                  label="Required"
                  checked={condition.required ?? false}
                  onChange={(e) =>
                    update(index, { required: e.currentTarget.checked })
                  }
                />
                <Switch
                  size="sm"
                  label="Read-only"
                  checked={condition.readonly ?? false}
                  onChange={(e) =>
                    update(index, { readonly: e.currentTarget.checked })
                  }
                />
              </Group>
            </div>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export default ConditionsEditor;
