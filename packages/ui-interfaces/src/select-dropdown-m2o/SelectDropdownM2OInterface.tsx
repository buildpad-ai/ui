'use client';

import React from 'react';
import { Box, Text, Stack, Alert, Paper, Group, ActionIcon, Button } from '@mantine/core';
import { IconAlertCircle, IconPlus, IconTrash, IconList, IconX } from '@tabler/icons-react';
import type { M2ORelationInfo, M2OItem } from '@buildpad/hooks';

/**
 * Render function types for customizing SelectDropdownM2O display
 */
export interface SelectDropdownM2ORenderProps {
  /** Render function for the selected item */
  renderSelectedItem?: (item: M2OItem | null, onClear: () => void) => React.ReactNode;
  /** Render function for the selection modal content */
  renderSelectModal?: (onSelect: (item: M2OItem) => void, onClose: () => void) => React.ReactNode;
  /** Render function for the create modal content */
  renderCreateModal?: (onCreate: (item: M2OItem) => void, onClose: () => void) => React.ReactNode;
}

/**
 * SelectDropdownM2O Interface Props
 * 
 * Props for the Many-to-One relationship select dropdown interface.
 */
export interface SelectDropdownM2OInterfaceProps extends SelectDropdownM2ORenderProps {
  /** Current value - the selected item ID or object */
  value?: string | number | M2OItem | null;
  /** Callback fired when value changes */
  onChange?: (value: string | number | null) => void;
  /** Current collection name */
  collection: string;
  /** Field name for this M2O relationship */
  field: string;
  /** Relation info (from useRelationM2O hook) */
  relationInfo?: M2ORelationInfo | null;
  /** Whether relation is loading */
  loading?: boolean;
  /** Template string for display */
  template?: string;
  /** Whether the interface is disabled */
  disabled?: boolean;
  /** Enable create new items button */
  enableCreate?: boolean;
  /** Enable select existing items button */
  enableSelect?: boolean;
  /** Field label */
  label?: string;
  /** Field description */
  description?: string;
  /** Error message */
  error?: string | boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Allow clearing the selection */
  allowNone?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * SelectDropdownM2OInterface Component (Placeholder)
 * 
 * This is a placeholder component for the Many-to-One list interface.
 * 
 * @see useRelationM2O from @buildpad/hooks for relation info
 * 
 * @param props - SelectDropdownM2OInterface props
 */
export const SelectDropdownM2OInterface: React.FC<SelectDropdownM2OInterfaceProps> = ({
  value,
  onChange,
  collection,
  field,
  relationInfo,
  loading = false,
  template,
  disabled = false,
  enableCreate = true,
  enableSelect = true,
  label,
  description,
  error,
  required = false,
  allowNone = true,
  renderSelectedItem,
  renderSelectModal,
  renderCreateModal,
  'data-testid': testId,
}) => {
  const hasRenderProps = renderSelectedItem || renderSelectModal || renderCreateModal;

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
            <strong>SelectDropdownM2O Interface</strong> requires render props to be provided.
          </Text>
          <Text size="xs" mt="xs">
            Collection: <code>{collection}</code>, Field: <code>{field}</code>
          </Text>
        </Alert>
        {error && (
          <Text size="xs" c="red">{typeof error === 'string' ? error : 'Validation error'}</Text>
        )}
      </Stack>
    );
  }

  const handleClear = () => {
    if (allowNone && onChange) {
      onChange(null);
    }
  };

  // Determine the current value ID
  const currentId = typeof value === 'object' && value !== null ? (value as M2OItem).id : value;

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
      
      {/* Selected item display */}
      <Paper withBorder p="md" radius="sm">
        {loading ? (
          <Text size="sm" c="dimmed" ta="center">Loading...</Text>
        ) : !currentId ? (
          <Group>
            <Text size="sm" c="dimmed">No item selected</Text>
            {!disabled && (enableCreate || enableSelect) && (
              <Group gap="xs" ml="auto">
                {enableSelect && (
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconList size={14} />}
                    disabled={!renderSelectModal}
                  >
                    Select
                  </Button>
                )}
                {enableCreate && (
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    disabled={!renderCreateModal}
                  >
                    Create
                  </Button>
                )}
              </Group>
            )}
          </Group>
        ) : renderSelectedItem ? (
          renderSelectedItem(value as M2OItem, handleClear)
        ) : (
          <Group justify="space-between">
            <Text size="sm">
              {template || `Item ${currentId}`}
            </Text>
            {!disabled && allowNone && (
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={handleClear}
              >
                <IconX size={14} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Paper>

      {error && (
        <Text size="xs" c="red">{typeof error === 'string' ? error : 'Validation error'}</Text>
      )}
    </Stack>
  );
};

export default SelectDropdownM2OInterface;
