import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Collapse,
  Group,
  Text,
  ActionIcon,
  Alert,
  Paper,
  Stack,
} from '@mantine/core';
import {
  IconChevronDown,
  IconExclamationCircle,
  IconEdit,
} from '@tabler/icons-react';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';

// Interface definition matching DaaS group-detail
export interface GroupDetailProps {
  /** Field configuration object */
  field?: {
    name?: string;
    meta?: {
      field?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };

  /** Array of field configurations for the form */
  fields?: Array<{
    field: string;
    name?: string;
    type?: string;
    meta?: any;
    schema?: any;
  }>;

  /** Current form values */
  values?: Record<string, any>;

  /** Initial form values for comparison */
  initialValues?: Record<string, any>;

  /** Whether the form is disabled */
  disabled?: boolean;

  /** Whether in batch mode */
  batchMode?: boolean;

  /** Active fields in batch mode */
  batchActiveFields?: string[];

  /** Primary key of the record */
  primaryKey?: string | number;

  /** Whether the form is loading */
  loading?: boolean;

  /** Validation errors */
  validationErrors?: Array<{
    field: string;
    code: string;
    type: string;
    [key: string]: any;
  }>;

  /** Badge text */
  badge?: string;

  /** Initial state - 'open' or 'closed' */
  start?: 'open' | 'closed';

  /** Header icon name */
  headerIcon?: string;

  /** Header color */
  headerColor?: string;

  /** Text direction */
  direction?: 'ltr' | 'rtl';

  /** Form content to render inside the collapse */
  children?: React.ReactNode;

  /** Callback when form values change */
  onChange?: (values: Record<string, any>) => void;

  /** Callback when apply button is clicked */
  onApply?: (values: Record<string, any>) => void;

  /** Per-instance overrides of the dictionary strings (`interfaces.groupDetail`) */
  translations?: DeepPartial<InterfacesTranslations['groupDetail']>;
}

// Helper function to format field names as titles
const formatTitle = (str: string): string => {
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// Helper function to get icon component
const getIcon = (iconName?: string) => {
  // Map common DaaS icon names to Tabler icons
  switch (iconName) {
    case 'menu_open':
      return <IconEdit size={16} />;
    case 'expand_more':
      return <IconChevronDown size={16} />;
    case 'error':
      return <IconExclamationCircle size={16} />;
    default:
      return iconName ? <Text size="sm">{iconName}</Text> : null;
  }
};

export function GroupDetail({
  field,
  fields = [],
  values = {},
  initialValues = {},
  disabled = false,
  batchMode: _batchMode = false,
  batchActiveFields: _batchActiveFields = [],
  primaryKey: _primaryKey,
  loading = false,
  validationErrors = [],
  badge,
  start = 'open',
  headerIcon,
  headerColor = 'var(--mantine-color-text)',
  direction: _direction,
  children,
  onChange: _onChange,
  onApply: _onApply,
  translations,
}: GroupDetailProps) {
  const t = useBuildpadTranslations((d) => d.interfaces.groupDetail, translations);

  // Get validation messages for this group first
  const validationMessages = useMemo(() => {
    if (!validationErrors || validationErrors.length === 0) {
      return [];
    }

    const fieldNames = fields.map((field) => field.field);
    
    const errors = validationErrors.reduce((acc, error) => {
      if (!fieldNames.includes(error.field)) {
        return acc;
      }

      if (error.code === 'RECORD_NOT_UNIQUE') {
        acc.push(interpolate(t.validation.unique, { field: formatTitle(error.field) }));
      } else {
        // Generic error message formatting
        acc.push(
          interpolate(t.validation.generic, {
            field: formatTitle(error.field),
            type: error.type?.toLowerCase() || t.validation.fallbackType,
          }),
        );
      }

      return acc;
    }, [] as string[]);

    return errors;
  }, [validationErrors, fields, t]);

  // Initialize state, auto-open if there are validation errors
  const [isOpen, setIsOpen] = useState(start === 'open' || validationMessages.length > 0);

  // Re-evaluate start state when loading finishes
  const [wasLoading, setWasLoading] = useState(loading);
  useEffect(() => {
    if (wasLoading && !loading) {
      setIsOpen(start === 'open');
    }
    setWasLoading(loading);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if any fields have been edited
  const isEdited = useMemo(() => {
    if (!values || !initialValues) {
      return false;
    }
    
    const editedFields = Object.keys(values);
    return fields.some((field) => {
      const fieldName = field.field;
      return editedFields.includes(fieldName) && values[fieldName] !== initialValues[fieldName];
    });
  }, [values, initialValues, fields]);

  // Auto-open when there are validation errors
  useEffect(() => {
    if (validationMessages.length > 0) {
      setIsOpen(true);
    }
  }, [validationMessages]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <Box className="group-detail">
      {/* Header/Activator */}
      <Paper
        withBorder
        radius="var(--mantine-radius-sm)" // Tokenized border radius
        style={{
          cursor: disabled ? 'default' : 'pointer',
          borderColor: headerColor || undefined,
        }}
      >
        <Group
          justify="space-between"
          align="center"
          p="md"
          onClick={handleToggle}
          style={{
            color: headerColor || undefined,
          }}
        >
          {/* Left side - Icon, Title, and Indicators */}
          <Group align="center" gap="sm">
            {headerIcon && getIcon(headerIcon)}
            
            {field?.name && (
              <Group align="center" gap="xs">
                {isEdited && !isOpen && (
                  <Box
                    w={4}
                    h={4}
                    bg="gray.6"
                    style={{ borderRadius: '50%' }}
                    title={t.edited}
                  />
                )}
                <Text fw={500} size="sm" data-variant="label">
                  {field.name}
                </Text>
                {badge && (
                  <Text size="xs" c="dimmed">
                    {badge}
                  </Text>
                )}
              </Group>
            )}

            {!isOpen && validationMessages.length > 0 && (
              <ActionIcon
                variant="transparent"
                size="sm"
                color="red"
                title={validationMessages.join('\n')}
                data-testid="validation-warning"
              >
                <IconExclamationCircle size={16} />
              </ActionIcon>
            )}
          </Group>

          {/* Right side - Expand Icon */}
          <ActionIcon
            variant="transparent"
            size="sm"
            disabled={disabled}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          >
            <IconChevronDown size={16} />
          </ActionIcon>
        </Group>
      </Paper>

      {/* Collapsible Content */}
      <Collapse in={isOpen} transitionDuration={200} transitionTimingFunction="ease">
        <Box pt="md">
          {/* Validation Errors */}
          {validationMessages.length > 0 && (
            <Alert
              icon={<IconExclamationCircle size={16} />}
              color="red"
              variant="light"
              mb="md"
            >
              <Stack gap="xs">
                {validationMessages.map((message, index) => (
                  <Text key={index} size="sm">
                    {message}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}

          {/* Form Content */}
          <Paper withBorder radius="md" p="md">
            {loading ? (
              <Text c="dimmed" ta="center" py="xl">
                {t.loading}
              </Text>
            ) : children ? (
              children
            ) : (
              <Text c="dimmed" ta="center" py="md">
                {t.empty}
              </Text>
            )}
          </Paper>
        </Box>
      </Collapse>
    </Box>
  );
}

export default GroupDetail;
