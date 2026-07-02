/**
 * FieldPalette
 *
 * Lists the target collection's schema fields that have not yet been placed on
 * the canvas. Clicking a field adds it to the definition (removing it from the
 * palette). A search box filters the list for large collections.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconPlus, IconSearch, IconSquarePlus } from '@tabler/icons-react';
import { useDraggable } from '@dnd-kit/core';
import { PROVISIONABLE_INTERFACES } from '@buildpad/utils';
import type { Field } from '@buildpad/types';

/** Prefix for a palette item's draggable id (distinguishes palette drags from
 *  placed-field/section drags in the shared DndContext). */
export const PALETTE_ID_PREFIX = 'palette:';

/** A quick-add seed: prefills the "Add field" flow with a type + interface. */
export interface QuickAddSeed {
  type: string;
  interface: string;
}

/**
 * Quick-add field-type templates derived from the shared provisionable catalog
 * (one per interface, defaulting to its first compatible type), grouped for the
 * palette. Clicking one opens the "Add field" flow prefilled with that type.
 */
const QUICK_ADD_GROUPS: [string, { label: string; seed: QuickAddSeed }[]][] =
  Object.entries(
    PROVISIONABLE_INTERFACES.reduce<
      Record<string, { label: string; seed: QuickAddSeed }[]>
    >((acc, i) => {
      (acc[i.group] ??= []).push({
        label: i.label,
        seed: { type: i.types[0], interface: i.value },
      });
      return acc;
    }, {}),
  );

export interface FieldPaletteProps {
  /** Schema fields not yet placed in the definition. */
  fields: Field[];
  /** Add a field to the canvas by key (click-to-add; also used by keyboard). */
  onAddField: (field: string) => void;
  /**
   * Open the "Add field" flow to create a brand-new field (real column or
   * extra). When omitted, the create-new affordance is hidden.
   */
  onAddNewField?: () => void;
  /**
   * Open the "Add field" flow prefilled from a quick-add template. When
   * provided, the palette shows the field-type templates.
   */
  onQuickAdd?: (seed: QuickAddSeed) => void;
}

/**
 * A single unplaced field: draggable into a section, or click to append.
 */
function PaletteItem({
  field,
  onAddField,
}: {
  field: Field;
  onAddField: (field: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_ID_PREFIX}${field.field}`,
  });

  return (
    <UnstyledButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAddField(field.field)}
      data-testid={`palette-field-${field.field}`}
      p="xs"
      style={{
        borderRadius: 6,
        border: '1px solid var(--mantine-color-gray-3)',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <IconPlus size={14} color="var(--mantine-color-dimmed)" />
          <Text size="sm" truncate>
            {field.meta?.note || field.field}
          </Text>
        </Group>
        <Badge size="xs" variant="light" color="gray">
          {field.type}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Searchable list of unplaced fields.
 */
export function FieldPalette({
  fields,
  onAddField,
  onAddNewField,
  onQuickAdd,
}: FieldPaletteProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.field.toLowerCase().includes(q) ||
        (f.meta?.note ?? '').toLowerCase().includes(q),
    );
  }, [fields, query]);

  return (
    <Stack gap="xs" h="100%">
      <Text size="sm" fw={600}>
        Fields
      </Text>
      {onAddNewField && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconSquarePlus size={14} />}
          onClick={onAddNewField}
          data-testid="palette-add-new-field"
        >
          Add field
        </Button>
      )}
      {onQuickAdd && (
        <Stack gap={6} data-testid="palette-quick-add">
          <Text size="xs" c="dimmed" fw={500}>
            Quick add
          </Text>
          {QUICK_ADD_GROUPS.map(([group, items]) => (
            <Stack key={group} gap={2}>
              <Text size="10px" c="dimmed" tt="uppercase" fw={600}>
                {group}
              </Text>
              <Group gap={4} wrap="wrap">
                {items.map((t) => (
                  <Button
                    key={t.seed.interface}
                    size="compact-xs"
                    variant="default"
                    onClick={() => onQuickAdd(t.seed)}
                  >
                    {t.label}
                  </Button>
                ))}
              </Group>
            </Stack>
          ))}
        </Stack>
      )}
      <TextInput
        size="xs"
        placeholder="Search fields"
        leftSection={<IconSearch size={14} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap={4}>
          {filtered.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              {fields.length === 0
                ? onQuickAdd
                  ? 'Use “Quick add” or “Add field” to create fields'
                  : 'All fields placed'
                : 'No matching fields'}
            </Text>
          ) : (
            filtered.map((field) => (
              <PaletteItem
                key={field.field}
                field={field}
                onAddField={onAddField}
              />
            ))
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

export default FieldPalette;
