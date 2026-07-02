/**
 * BuilderSection
 *
 * One section on the builder canvas: a draggable header with an editable title
 * and remove action, plus a sortable + droppable body holding its
 * `BuilderFieldRow`s. The body is a drop target so fields can be dragged into an
 * empty section.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import {
  ActionIcon,
  Box,
  Card,
  Group,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconGripVertical, IconTrash } from '@tabler/icons-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BuilderFieldRow } from './BuilderFieldRow';
import type { Field, FormSection } from '@buildpad/types';

/** Prefix for a section's sortable id (distinguishes it from field ids). */
export const SECTION_ID_PREFIX = 'section:';
/** Prefix for a section body's droppable id (empty-section drop target). */
export const SECTION_BODY_ID_PREFIX = 'sectionbody:';

export interface BuilderSectionProps {
  section: FormSection;
  /** Schema field lookup by key (missing entries render as "missing"). */
  schemaByKey: Map<string, Field>;
  /** Currently selected field key. */
  selectedField: string | null;
  onSelectField: (field: string) => void;
  onRemoveField: (field: string) => void;
  onRenameSection: (title: string) => void;
  onRemoveSection: () => void;
}

/**
 * Sortable section card with a sortable list of field rows.
 */
export function BuilderSection({
  section,
  schemaByKey,
  selectedField,
  onSelectField,
  onRemoveField,
  onRenameSection,
  onRemoveSection,
}: BuilderSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `${SECTION_ID_PREFIX}${section.id}` });
  const { setNodeRef: setBodyRef, isOver } = useDroppable({
    id: `${SECTION_BODY_ID_PREFIX}${section.id}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const fieldIds = section.fields.map((f) => f.field);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      withBorder
      padding="sm"
      radius="md"
      data-testid={`builder-section-${section.id}`}
    >
      <Group justify="space-between" wrap="nowrap" mb="xs" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder section"
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={16} />
          </ActionIcon>
          <TextInput
            size="xs"
            variant="unstyled"
            placeholder="Section title"
            value={section.title ?? ''}
            onChange={(e) => onRenameSection(e.currentTarget.value)}
            style={{ flex: 1 }}
            fw={600}
          />
        </Group>
        <Tooltip label="Remove section">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={onRemoveSection}
            aria-label="Remove section"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Two-column grid mirrors the rendered form: half-width fields sit
          side by side, full-width fields span the row. */}
      <SortableContext items={fieldIds} strategy={rectSortingStrategy}>
        <Box
          ref={setBodyRef}
          mih={48}
          p={section.fields.length === 0 ? 'sm' : 0}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 'var(--mantine-spacing-xs)',
            alignItems: 'start',
            borderRadius: 6,
            outline: isOver
              ? '2px dashed var(--mantine-color-blue-5)'
              : section.fields.length === 0
                ? '1px dashed var(--mantine-color-gray-4)'
                : undefined,
          }}
        >
          {section.fields.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" style={{ gridColumn: '1 / -1' }}>
              Drag fields here
            </Text>
          ) : (
            section.fields.map((config) => (
              <BuilderFieldRow
                key={config.field}
                config={config}
                schemaField={schemaByKey.get(config.field)}
                selected={selectedField === config.field}
                onSelect={() => onSelectField(config.field)}
                onRemove={() => onRemoveField(config.field)}
              />
            ))
          )}
        </Box>
      </SortableContext>
    </Card>
  );
}

export default BuilderSection;
