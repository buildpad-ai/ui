/**
 * FieldPalette
 *
 * The builder's left rail: two draggable groups under a shared search box.
 *   - A **field-type catalog** — one icon+label chip per provisionable interface
 *     (from the shared `PROVISIONABLE_INTERFACES`), grouped by category into an
 *     accordion. Each chip is `@dnd-kit` draggable (id `newfield:<interface>`);
 *     dropping it on the canvas opens the column-name prompt (see `FormBuilder`),
 *     and clicking it starts a new field of that type. The catalog is gated on
 *     schema rights (provisioning a real column is a DDL op).
 *   - The target collection's **unplaced existing fields** — draggable (id
 *     `palette:<field>`) or click-to-append, removed from the list once placed.
 *
 * Below the catalog, an optional **"Add extra field"** button opens the advanced
 * flow (`AddFieldModal`) for the cases the chips don't cover: `extras` (jsonb)
 * storage and B-tree indexing. The search box filters both draggable groups.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useMemo, useState } from 'react';
import {
  Accordion,
  Badge,
  Button,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAdjustments,
  IconAlignLeft,
  IconCalendar,
  IconCheckbox,
  IconCircleDot,
  IconCode,
  IconForms,
  IconHash,
  IconLayoutList,
  IconLetterCase,
  IconListCheck,
  IconMapPin,
  IconMarkdown,
  IconMoodSmile,
  IconPalette,
  IconPlus,
  IconSearch,
  IconSelect,
  IconSquareCheck,
  IconSquarePlus,
  IconTags,
  IconToggleRight,
  type IconProps,
} from '@tabler/icons-react';
import { useDraggable } from '@dnd-kit/core';
import {
  PROVISIONABLE_INTERFACES,
  type ProvisionableInterface,
} from '@buildpad/utils';
import type { Field } from '@buildpad/types';

/** Prefix for a palette item's draggable id (distinguishes palette drags from
 *  placed-field/section drags in the shared DndContext). */
export const PALETTE_ID_PREFIX = 'palette:';

/** Prefix for a field-type catalog chip's draggable id. The suffix is the
 *  provisionable interface value (e.g. `newfield:select-dropdown`); dropping it
 *  on the canvas creates a brand-new field of that interface. */
export const NEWFIELD_ID_PREFIX = 'newfield:';

type TablerIcon = React.ComponentType<IconProps>;

/** Icon per provisionable interface, keyed by its renderer-recognized value.
 *  Falls back to a generic "form field" glyph for anything unmapped. */
const INTERFACE_ICONS: Record<string, TablerIcon> = {
  input: IconLetterCase,
  'input-multiline': IconAlignLeft,
  'input-code': IconCode,
  'input-hash': IconHash,
  tags: IconTags,
  'input-rich-text-html': IconForms,
  'input-rich-text-md': IconMarkdown,
  'input-block-editor': IconLayoutList,
  'select-dropdown': IconSelect,
  'select-radio': IconCircleDot,
  'select-multiple-checkbox': IconCheckbox,
  'select-multiple-dropdown': IconListCheck,
  'select-icon': IconMoodSmile,
  'select-color': IconPalette,
  boolean: IconSquareCheck,
  toggle: IconToggleRight,
  slider: IconAdjustments,
  datetime: IconCalendar,
  map: IconMapPin,
};

function interfaceIcon(value: string): TablerIcon {
  return INTERFACE_ICONS[value] ?? IconForms;
}

/**
 * The provisionable interfaces grouped by `ProvisionableInterface.group`, in
 * catalog order, for the field-type catalog.
 */
const CATALOG_GROUPS: [string, ProvisionableInterface[]][] = Object.entries(
  PROVISIONABLE_INTERFACES.reduce<Record<string, ProvisionableInterface[]>>(
    (acc, i) => {
      (acc[i.group] ??= []).push(i);
      return acc;
    },
    {},
  ),
);

export interface FieldPaletteProps {
  /** Schema fields not yet placed in the definition. */
  fields: Field[];
  /** Add a field to the canvas by key (click-to-add; also used by keyboard). */
  onAddField: (field: string) => void;
  /**
   * Open the advanced "Add extra field" flow (`AddFieldModal`) to create a
   * brand-new field with `extras` (jsonb) storage or a B-tree index. When
   * omitted, the affordance is hidden.
   */
  onAddNewField?: () => void;
  /**
   * Start a new field from a field-type catalog chip. Receives the chip's
   * provisionable interface value. When provided (and `canProvisionSchema` is
   * set) the palette shows the field-type catalog.
   */
  onAddFieldType?: (interfaceValue: string) => void;
  /**
   * Whether the author has schema rights to provision real columns. The
   * field-type catalog is only shown when true (creating a column is a DDL op).
   * @default false
   */
  canProvisionSchema?: boolean;
}

/**
 * A single unplaced existing field: draggable into a section, or click to append.
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
 * A single field-type catalog chip: draggable onto the canvas (id
 * `newfield:<interface>`), or click to start a new field of that type.
 */
function NewFieldChip({
  descriptor,
  onAddFieldType,
}: {
  descriptor: ProvisionableInterface;
  onAddFieldType?: (interfaceValue: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${NEWFIELD_ID_PREFIX}${descriptor.value}`,
  });
  const Icon = interfaceIcon(descriptor.value);

  return (
    <UnstyledButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAddFieldType?.(descriptor.value)}
      data-testid={`palette-newfield-${descriptor.value}`}
      p={6}
      style={{
        borderRadius: 6,
        border: '1px dashed var(--mantine-color-gray-4)',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        <Icon size={14} color="var(--mantine-color-blue-6)" />
        <Text size="xs" truncate>
          {descriptor.label}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Searchable palette: field-type catalog + unplaced existing fields.
 */
export function FieldPalette({
  fields,
  onAddField,
  onAddNewField,
  onAddFieldType,
  canProvisionSchema = false,
}: FieldPaletteProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  // Which catalog group is expanded (single-open accordion; first group open by
  // default). While searching we open the first matching group so results show.
  const [openGroup, setOpenGroup] = useState<string | null>(
    () => CATALOG_GROUPS[0]?.[0] ?? null,
  );

  const filtered = useMemo(() => {
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.field.toLowerCase().includes(q) ||
        (f.meta?.note ?? '').toLowerCase().includes(q),
    );
  }, [fields, q]);

  // The catalog (new-field chips) only when the author can provision columns.
  const showCatalog = canProvisionSchema && !!onAddFieldType;

  const filteredCatalog = useMemo(() => {
    if (!showCatalog) return [];
    if (!q) return CATALOG_GROUPS;
    return CATALOG_GROUPS.map(
      ([group, items]) =>
        [
          group,
          items.filter(
            (i) =>
              i.label.toLowerCase().includes(q) ||
              i.value.toLowerCase().includes(q),
          ),
        ] as [string, ProvisionableInterface[]],
    ).filter(([, items]) => items.length > 0);
  }, [showCatalog, q]);

  return (
    <Stack gap="xs" h="100%">
      <Text size="sm" fw={600}>
        Fields
      </Text>
      <TextInput
        size="xs"
        placeholder="Search fields"
        leftSection={<IconSearch size={14} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
      />
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap="sm">
          {showCatalog && (
            <Stack gap={4} data-testid="palette-catalog">
              <Text size="xs" c="dimmed" fw={500}>
                Field types
              </Text>
              {filteredCatalog.length === 0 ? (
                <Text size="xs" c="dimmed" py={4}>
                  No matching field types
                </Text>
              ) : (
                <Accordion
                  chevronPosition="left"
                  chevronSize={16}
                  value={q ? (filteredCatalog[0]?.[0] ?? null) : openGroup}
                  onChange={setOpenGroup}
                  styles={{
                    item: {
                      border: 'none',
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                    },
                    control: {
                      paddingInlineStart: 0,
                      paddingInlineEnd: 4,
                      paddingBlock: 8,
                      borderRadius: 'var(--mantine-radius-sm)',
                    },
                    label: { padding: 0 },
                    chevron: {
                      marginInlineStart: 0,
                      marginInlineEnd: 6,
                      color: 'var(--mantine-color-dimmed)',
                    },
                    content: { padding: 0 },
                  }}
                >
                  {filteredCatalog.map(([group, items]) => (
                    <Accordion.Item key={group} value={group}>
                      <Accordion.Control>
                        <Group justify="space-between" wrap="nowrap" gap="xs">
                          <Text
                            size="11px"
                            c="dimmed"
                            tt="uppercase"
                            fw={700}
                            style={{ letterSpacing: '0.04em' }}
                          >
                            {group}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color="gray"
                            radius="sm"
                          >
                            {items.length}
                          </Badge>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap={4} pl={4} pb={8}>
                          {items.map((descriptor) => (
                            <NewFieldChip
                              key={descriptor.value}
                              descriptor={descriptor}
                              onAddFieldType={onAddFieldType}
                            />
                          ))}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              )}
            </Stack>
          )}

          {onAddNewField && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconSquarePlus size={14} />}
              onClick={onAddNewField}
              data-testid="palette-add-new-field"
            >
              Add extra field
            </Button>
          )}

          <Stack gap={4} data-testid="palette-existing">
            {showCatalog && (
              <Text size="xs" c="dimmed" fw={500}>
                Existing fields
              </Text>
            )}
            {filtered.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="sm">
                {fields.length === 0
                  ? showCatalog
                    ? 'Drag a field type above, or use “Add extra field”'
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
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

export default FieldPalette;
