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
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type FormsTranslations } from '@buildpad/utils';
import type { Field, FieldCondition } from '@buildpad/types';

export interface ConditionsEditorProps {
  /** The collection's fields, used by `FilterPanel` to build rules. */
  fields: Field[];
  /** Current conditions for the selected field. */
  conditions: FieldCondition[];
  /** Emits the updated conditions array (verbatim `FieldCondition[]`). */
  onChange: (conditions: FieldCondition[]) => void;
  /** Per-instance overrides of the dictionary strings (`forms` namespace). */
  translations?: DeepPartial<FormsTranslations>;
}

/**
 * A reasonable empty condition: no rule (never matches until authored).
 * `nameTemplate` is `forms.conditionsEditor.defaultName` ("Condition {number}").
 */
function emptyCondition(index: number, nameTemplate: string): FieldCondition {
  return {
    name: interpolate(nameTemplate, { number: index + 1 }),
    rule: {},
    hidden: false,
  };
}

/**
 * Manage the list of conditional rules + overrides for one field.
 */
export function ConditionsEditor({
  fields,
  conditions,
  onChange,
  translations,
}: ConditionsEditorProps) {
  const t = useBuildpadTranslations((d) => d.forms, translations);

  const update = (index: number, patch: Partial<FieldCondition>) => {
    onChange(
      conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  };

  const remove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...conditions,
      emptyCondition(conditions.length, t.conditionsEditor.defaultName),
    ]);
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          {t.conditionsEditor.title}
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={add}
        >
          {t.conditionsEditor.add}
        </Button>
      </Group>

      {conditions.length === 0 ? (
        <Text size="xs" c="dimmed">
          {t.conditionsEditor.emptyState}
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          {t.conditionsEditor.precedenceHint}
        </Text>
      )}

      {conditions.map((condition, index) => (
        <Paper key={index} withBorder p="sm" radius="sm">
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start">
              <TextInput
                size="xs"
                label={t.conditionsEditor.name.label}
                placeholder={t.conditionsEditor.name.placeholder}
                value={condition.name ?? ''}
                onChange={(e) => update(index, { name: e.currentTarget.value })}
                style={{ flex: 1 }}
              />
              <Tooltip label={t.conditionsEditor.remove}>
                <ActionIcon
                  color="red"
                  variant="subtle"
                  mt={22}
                  onClick={() => remove(index)}
                  aria-label={t.conditionsEditor.remove}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <div>
              <Text size="xs" fw={500} mb={4}>
                {t.conditionsEditor.when}
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
                {t.conditionsEditor.then}
              </Text>
              <Group gap="lg">
                <Switch
                  size="sm"
                  label={t.conditionsEditor.overrides.hidden}
                  checked={condition.hidden ?? false}
                  onChange={(e) =>
                    update(index, { hidden: e.currentTarget.checked })
                  }
                />
                <Switch
                  size="sm"
                  label={t.conditionsEditor.overrides.required}
                  checked={condition.required ?? false}
                  onChange={(e) =>
                    update(index, { required: e.currentTarget.checked })
                  }
                />
                <Switch
                  size="sm"
                  label={t.conditionsEditor.overrides.readonly}
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
