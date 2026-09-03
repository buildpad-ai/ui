/**
 * BuilderFieldRow
 *
 * A single placed field within a `BuilderSection`. Draggable (via
 * `@dnd-kit/sortable`) for reordering, shows the field name + quick width and
 * required/hidden indicators, is selectable to open its `FieldSettingsPanel`,
 * and can be removed back to the palette.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { ActionIcon, Badge, Group, Paper, Text, Tooltip } from '@mantine/core';
import {
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconTrash,
} from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, FormsTranslations } from '@buildpad/utils';
import type { Field, FormFieldConfig } from '@buildpad/types';

export interface BuilderFieldRowProps {
  /** The field's config in the definition. */
  config: FormFieldConfig;
  /** The backing schema field (may be missing if removed from the schema). */
  schemaField?: Field;
  /** Whether this row is the selected field. */
  selected: boolean;
  /** Select the field (opens its settings). */
  onSelect: () => void;
  /** Remove the field from the section (returns it to the palette). */
  onRemove: () => void;
  /** Per-instance overrides of the dictionary strings (`forms` namespace). */
  translations?: DeepPartial<FormsTranslations>;
}

/**
 * Sortable row representing one placed field.
 */
export function BuilderFieldRow({
  config,
  schemaField,
  selected,
  onSelect,
  onRemove,
  translations,
}: BuilderFieldRowProps) {
  const t = useBuildpadTranslations((d) => d.forms, translations);
  const { formatCount } = useBuildpadI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: config.field });

  // Half-width fields occupy a single grid track (so two pair up side by side);
  // everything else spans the full row — mirroring the rendered form layout.
  const width = config.width ?? 'full';
  const isHalf = width === 'half';
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'pointer',
    gridColumn: isHalf ? 'auto' : '1 / -1',
  };

  const isExtra = config.store === 'extras';
  // An extras field has no real schema column by design — only flag a *real*
  // (store:'column') field as missing when its schema field is absent.
  const missing = !schemaField && !isExtra;
  const label =
    config.note || schemaField?.meta?.note || config.extra?.label || config.field;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      withBorder
      p="xs"
      radius="sm"
      onClick={onSelect}
      data-testid={`builder-field-${config.field}`}
      bg={selected ? 'var(--mantine-color-blue-light)' : undefined}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label={t.builderFieldRow.dragHandle}
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={16} />
          </ActionIcon>
          <Text size="sm" truncate>
            {label}
          </Text>
          {missing && (
            <Badge size="xs" color="red" variant="light">
              {t.builderFieldRow.badge.missing}
            </Badge>
          )}
          {isExtra && (
            <Badge size="xs" color="grape" variant="light">
              {t.builderFieldRow.badge.extra}
            </Badge>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          <Badge size="xs" variant="light" color="gray">
            {t.builderFieldRow.badge.width[width]}
          </Badge>
          {config.required && (
            <Badge size="xs" variant="light" color="orange">
              {t.builderFieldRow.badge.required}
            </Badge>
          )}
          {(config.conditions?.length ?? 0) > 0 && (
            <Badge size="xs" variant="light" color="grape">
              {formatCount(config.conditions!.length, t.builderFieldRow.badge.conditions)}
            </Badge>
          )}
          {config.hidden ? (
            <Tooltip label={t.builderFieldRow.hiddenTooltip}>
              <IconEyeOff size={14} color="var(--mantine-color-dimmed)" />
            </Tooltip>
          ) : (
            <IconEye size={14} color="var(--mantine-color-dimmed)" />
          )}
          <Tooltip label={t.builderFieldRow.remove}>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={t.builderFieldRow.remove}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  );
}

export default BuilderFieldRow;
