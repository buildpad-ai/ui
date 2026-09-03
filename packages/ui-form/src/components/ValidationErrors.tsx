/**
 * ValidationErrors Component
 * Ported from DaaS app/src/components/v-form/components/validation-errors.vue
 *
 * Renders a summary banner at the top of the form listing all validation errors.
 * Supports:
 * - Clickable field names that scroll to the errored field
 * - Awareness of hidden fields and fields inside collapsed groups
 * - Custom validation messages from field.meta.validation_message
 */

import React, { useMemo, useCallback } from 'react';
import { Alert, Text, UnstyledButton, Group, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { Field } from '@buildpad/types';
import { interpolate } from '@buildpad/utils';
import type { DeepPartial, FormTranslations, FormValidationTranslations } from '@buildpad/utils';
import { useBuildpadI18n, useBuildpadTranslations } from '@buildpad/services';
import type { ValidationError } from '../types';

export interface ValidationErrorsProps {
  /** List of validation errors */
  validationErrors: ValidationError[];
  /** All fields in the form (for name resolution) */
  fields: Field[];
  /** Callback to scroll to a specific field */
  onScrollToField?: (fieldKey: string) => void;
  /** Per-instance overrides of the `form` dictionary namespace */
  translations?: DeepPartial<FormTranslations>;
}

interface ErrorDetail {
  field: string;
  fieldName: string;
  message: string;
  isHidden: boolean;
  groupName?: string;
}

/**
 * Resolve a human-readable field name from a field key
 */
function resolveFieldName(fieldKey: string, fields: Field[]): string {
  // Handle function-wrapped field names like "count(id)"
  const match = fieldKey.match(/\(([^)]+)\)/);
  const actualKey = match ? match[1] : fieldKey;

  const field = fields.find((f) => f.field === actualKey);
  return (field?.meta as unknown as Record<string, unknown>)?.name as string
    || field?.field
    || actualKey;
}

/**
 * Check if a field is hidden (directly or via group)
 */
function isFieldHidden(fieldKey: string, fields: Field[]): { hidden: boolean; groupName?: string } {
  const field = fields.find((f) => f.field === fieldKey);
  if (!field) return { hidden: false };

  if (field.meta?.hidden === true) {
    return { hidden: true };
  }

  // Check if inside a hidden group
  if (field.meta?.group) {
    const group = fields.find((f) => f.field === field.meta?.group);
    if (group?.meta?.hidden === true) {
      const groupName = (group.meta as unknown as Record<string, unknown>)?.name as string || group.field;
      return { hidden: true, groupName };
    }
  }

  return { hidden: false };
}

/**
 * Get validation message for an error.
 * `strings` is the `form.validation` dictionary namespace (resolved by the caller).
 */
function getErrorMessage(
  error: ValidationError,
  field: Field | undefined,
  strings: FormValidationTranslations,
): string {
  // Check for custom validation message
  if (field?.meta?.validation_message && error.code === 'FAILED_VALIDATION') {
    return field.meta.validation_message;
  }

  if (error.message) return error.message;

  // Default messages by type
  switch (error.type) {
    case 'required':
      return strings.required;
    case 'unique':
    case 'RECORD_NOT_UNIQUE':
      return strings.unique;
    case 'email':
      return strings.email;
    case 'url':
      return strings.url;
    case 'number':
      return strings.number;
    case 'FAILED_VALIDATION':
      return strings.failed;
    default:
      return interpolate(strings.generic, { type: error.type });
  }
}

/**
 * ValidationErrors - Form validation error summary banner
 */
export const ValidationErrors: React.FC<ValidationErrorsProps> = ({
  validationErrors,
  fields,
  onScrollToField,
  translations,
}) => {
  const t = useBuildpadTranslations((d) => d.form, translations);
  const { formatCount } = useBuildpadI18n();

  const errorDetails = useMemo<ErrorDetail[]>(() => {
    return validationErrors.map((error) => {
      const fieldKey = error.field;
      const field = fields.find((f) => f.field === fieldKey);
      const { hidden, groupName } = isFieldHidden(fieldKey, fields);

      return {
        field: fieldKey,
        fieldName: resolveFieldName(fieldKey, fields),
        message: getErrorMessage(error, field, t.validation),
        isHidden: hidden,
        groupName,
      };
    });
  }, [validationErrors, fields, t]);

  const handleFieldClick = useCallback(
    (fieldKey: string) => {
      if (onScrollToField) {
        onScrollToField(fieldKey);
      } else {
        // Fallback: try to scroll to the field element
        const el = document.querySelector(`[data-field="${fieldKey}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [onScrollToField],
  );

  if (errorDetails.length === 0) return null;

  return (
    <Alert
      icon={<IconAlertTriangle size={16} />}
      color="red"
      variant="light"
      className="validation-errors-summary"
      style={{ gridColumn: '1 / -1' }}
      role="alert"
    >
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {formatCount(errorDetails.length, t.errors.summary)}
        </Text>
        {errorDetails.map((detail, index) => (
          <Group key={`${detail.field}-${index}`} gap="xs" wrap="nowrap">
            <Text size="sm" c="dimmed">{t.errors.bullet}</Text>
            <UnstyledButton
              onClick={() => handleFieldClick(detail.field)}
              style={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              <Text size="sm" fw={500} c="red">
                {detail.fieldName}
              </Text>
            </UnstyledButton>
            <Text size="sm" c="dimmed">
              {interpolate(t.errors.messageFormat, { message: detail.message })}
              {detail.isHidden && (
                <Text component="span" size="xs" c="dimmed" fs="italic">
                  {' '}
                  {detail.groupName
                    ? interpolate(t.errors.hiddenInGroup, { group: detail.groupName })
                    : t.errors.hidden}
                </Text>
              )}
            </Text>
          </Group>
        ))}
      </Stack>
    </Alert>
  );
};

export default ValidationErrors;
