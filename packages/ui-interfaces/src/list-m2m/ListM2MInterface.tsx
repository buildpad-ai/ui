'use client';

import React from 'react';
import { Box, Text, Stack, Alert, Paper, Group, ActionIcon, Button } from '@mantine/core';
import { IconAlertCircle, IconPlus, IconTrash, IconList } from '@tabler/icons-react';
import type { M2MRelationInfo, M2MItem } from '@buildpad/hooks';

/**
 * Render function types for customizing ListM2M display
 */
export interface ListM2MRenderProps {
  /** Render function for the item list */
  renderItemList?: (items: M2MItem[], onRemove: (id: string | number) => void) => React.ReactNode;
  /** Render function for the selection modal content */
  renderSelectModal?: (onSelect: (items: M2MItem[]) => void, onClose: () => void) => React.ReactNode;
  /** Render function for the create modal content */
  renderCreateModal?: (onCreate: (item: M2MItem) => void, onClose: () => void) => React.ReactNode;
  /** Render function for the edit modal content */
  renderEditModal?: (item: M2MItem, onSave: (item: M2MItem) => void, onClose: () => void) => React.ReactNode;
}

/**
 * ListM2M Interface Props
 * 
 * Props for the Many-to-Many relationship list interface.
 * This component requires render props for the modal contents since
 * collection forms and lists are app-specific.
 */
export interface ListM2MInterfaceProps extends ListM2MRenderProps {
  /** Current value - array of junction items or related items */
  value?: M2MItem[];
  /** Callback fired when value changes */
  onChange?: (value: M2MItem[]) => void;
  /** Current collection name */
  collection: string;
  /** Field name for this M2M relationship */
  field: string;
  /** Primary key of the current item */
  primaryKey?: string | number;
  /** Relation info (from useRelationM2M hook) */
  relationInfo?: M2MRelationInfo | null;
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
  /** Enable select existing items button */
  enableSelect?: boolean;
  /** Enable link to related items */
  enableLink?: boolean;
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
}

/**
 * ListM2MInterface Component (Placeholder)
 * 
 * This is a placeholder component for the Many-to-Many list interface.
 * The actual implementation requires render props for:
 * - Item list rendering
 * - Selection modal (CollectionList)
 * - Create modal (CollectionForm)
 * - Edit modal (CollectionForm)
 * 
 * Apps should provide these render props with their own implementations.
 * 
 * @see useRelationM2M from @buildpad/hooks for relation info
 * @see useRelationM2MItems from @buildpad/hooks for items management
 * 
 * @param props - ListM2MInterface props
 */
export const ListM2MInterface: React.FC<ListM2MInterfaceProps> = ({
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
  enableSelect = true,
  enableLink = false,
  limit = 15,
  label,
  description,
  error,
  required = false,
  renderItemList,
  renderSelectModal,
  renderCreateModal,
  renderEditModal,
  'data-testid': testId,
}) => {
  // If no render props are provided, show a placeholder message
  const hasRenderProps = renderItemList || renderSelectModal || renderCreateModal;

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
            <strong>ListM2M Interface</strong> requires render props to be provided.
          </Text>
          <Text size="xs" mt="xs">
            Collection: <code>{collection}</code>, Field: <code>{field}</code>
          </Text>
          <Text size="xs" mt="xs">
            Please implement:
          </Text>
          <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '12px' }}>
            <li><code>renderItemList</code> - For displaying related items</li>
            <li><code>renderSelectModal</code> - For selecting existing items</li>
            <li><code>renderCreateModal</code> - For creating new items</li>
          </ul>
        </Alert>
        {error && (
          <Text size="xs" c="red">{typeof error === 'string' ? error : 'Validation error'}</Text>
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
      {!disabled && (enableCreate || enableSelect) && (
        <Group gap="xs">
          {enableCreate && (
            <Button
              variant="default"
              size="xs"
              leftSection={<IconPlus size={14} />}
              disabled={!renderCreateModal}
            >
              Create New
            </Button>
          )}
          {enableSelect && (
            <Button
              variant="default"
              size="xs"
              leftSection={<IconList size={14} />}
              disabled={!renderSelectModal}
            >
              Select Existing
            </Button>
          )}
        </Group>
      )}

      {/* Items list */}
      <Paper withBorder p="md" radius="sm">
        {loading ? (
          <Text size="sm" c="dimmed" ta="center">Loading...</Text>
        ) : value.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center">No items</Text>
        ) : renderItemList ? (
          renderItemList(value, handleRemove)
        ) : (
          <Stack gap="xs">
            {value.map((item, index) => (
              <Group key={item.id || index} justify="space-between">
                <Text size="sm">
                  {template || `Item ${item.id || index + 1}`}
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
        <Text size="xs" c="red">{typeof error === 'string' ? error : 'Validation error'}</Text>
      )}
    </Stack>
  );
};

export default ListM2MInterface;
