'use client';

import React from 'react';
import { Box, Text, Stack, Alert, Paper, Group, ActionIcon, Button } from '@mantine/core';
import { IconAlertCircle, IconPlus, IconTrash, IconList } from '@tabler/icons-react';
import type { O2MRelationInfo, O2MItem } from '@buildpad/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

/**
 * Render function types for customizing ListO2M display
 */
export interface ListO2MRenderProps {
  /** Render function for the item list */
  renderItemList?: (items: O2MItem[], onRemove: (id: string | number) => void) => React.ReactNode;
  /** Render function for the create modal content */
  renderCreateModal?: (onCreate: (item: O2MItem) => void, onClose: () => void) => React.ReactNode;
  /** Render function for the edit modal content */
  renderEditModal?: (item: O2MItem, onSave: (item: O2MItem) => void, onClose: () => void) => React.ReactNode;
}

/**
 * ListO2M Interface Props
 * 
 * Props for the One-to-Many relationship list interface.
 */
export interface ListO2MInterfaceProps extends ListO2MRenderProps {
  /** Current value - array of related items */
  value?: O2MItem[];
  /** Callback fired when value changes */
  onChange?: (value: O2MItem[]) => void;
  /** Current collection name */
  collection: string;
  /** Field name for this O2M relationship */
  field: string;
  /** Primary key of the current item */
  primaryKey?: string | number;
  /** Relation info (from useRelationO2M hook) */
  relationInfo?: O2MRelationInfo | null;
  /** Whether relation is loading */
  loading?: boolean;
  /** Layout mode */
  layout?: 'list' | 'table';
  /** Fields to display */
  fields?: string[];
  /** Template string for list layout */
  template?: string;
  /** Whether the interface is disabled */
  disabled?: boolean;
  /** Enable create new items button */
  enableCreate?: boolean;
  /** Items per page */
  limit?: number;
  /** Field label */
  label?: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string | boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Per-instance overrides of the dictionary strings (`interfaces.listO2M`) */
  translations?: DeepPartial<InterfacesTranslations['listO2M']>;
}

/**
 * ListO2MInterface Component (Placeholder)
 * 
 * This is a placeholder component for the One-to-Many list interface.
 * 
 * @see useRelationO2M from @buildpad/hooks for relation info
 * @see useRelationO2MItems from @buildpad/hooks for items management
 * 
 * @param props - ListO2MInterface props
 */
export const ListO2MInterface: React.FC<ListO2MInterfaceProps> = ({
  value = [],
  onChange,
  collection,
  field,
  primaryKey,
  relationInfo,
  loading = false,
  layout = 'list',
  fields = ['id'],
  template,
  disabled = false,
  enableCreate = true,
  limit = 15,
  label,
  description,
  error,
  required = false,
  renderItemList,
  renderCreateModal,
  renderEditModal,
  'data-testid': testId,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.interfaces.listO2M, translations);
  const p = t.placeholder;
  const hasRenderProps = renderItemList || renderCreateModal;

  if (!hasRenderProps) {
    return (
      <Stack gap="xs" data-testid={testId}>
        {label && (
          <Text fw={500} size="sm">
            {label}
            {required && <Text component="span" c="red" ml={4}>*</Text>}
          </Text>
        )}
        {description && (
          <Text size="xs" c="dimmed">{description}</Text>
        )}
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          color="info" 
          variant="light"
        >
          <Text size="sm">
            <strong>{p.title}</strong> {p.requiresRenderProps}
          </Text>
          <Text size="xs" mt="xs">
            {p.collectionLabel} <code>{collection}</code>, {p.fieldLabel} <code>{field}</code>
          </Text>
        </Alert>
        {error && (
          <Text size="xs" c="red">{typeof error === 'string' ? error : p.validationError}</Text>
        )}
      </Stack>
    );
  }

  const handleRemove = (id: string | number) => {
    if (!onChange) return;
    const newValue = value.filter(item => item.id !== id);
    onChange(newValue);
  };

  return (
    <Stack gap="xs" data-testid={testId}>
      {label && (
        <Text fw={500} size="sm">
          {label}
          {required && <Text component="span" c="red" ml={4}>*</Text>}
        </Text>
      )}
      {description && (
        <Text size="xs" c="dimmed">{description}</Text>
      )}
      
      {/* Action buttons */}
      {!disabled && enableCreate && (
        <Group gap="xs">
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            disabled={!renderCreateModal}
          >
            {p.createNew}
          </Button>
        </Group>
      )}

      {/* Items list */}
      <Paper withBorder p="md" radius="sm">
        {loading ? (
          <Text size="sm" c="dimmed" ta="center">{p.loading}</Text>
        ) : value.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center">{p.noItems}</Text>
        ) : renderItemList ? (
          renderItemList(value, handleRemove)
        ) : (
          <Stack gap="xs">
            {value.map((item, index) => (
              <Group key={item.id || index} justify="space-between">
                <Text size="sm">
                  {template || interpolate(p.itemFallback, { id: item.id || index + 1 })}
                </Text>
                {!disabled && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleRemove(item.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </Paper>

      {error && (
        <Text size="xs" c="red">{typeof error === 'string' ? error : p.validationError}</Text>
      )}
    </Stack>
  );
};

export default ListO2MInterface;
