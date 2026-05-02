/**
 * FormFieldLabel Component
 * Renders field label with optional required indicator
 */

import React from 'react';
import { Text, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

export interface FormFieldLabelProps {
  /** Label text */
  label: string;
  /** Field is required */
  required?: boolean;
  /** Description/help text */
  description?: string;
}

/**
 * FormFieldLabel - Label component for form fields
 */
export const FormFieldLabel: React.FC<FormFieldLabelProps> = ({
  label,
  required = false,
  description,
}) => {
  return (
    <Text
      component="label"
      size="sm"
      fw={500}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--mantine-spacing-xs, 4px)' }}
    >
      {label}
      {required && (
        <Text component="span" c="red" size="sm">
          *
        </Text>
      )}
      {description && (
        <Tooltip label={description} multiline maw={300}>
          <IconInfoCircle
            size={14}
            style={{ cursor: 'help', opacity: 0.6 }}
            role="img"
            aria-label={description}
          />
        </Tooltip>
      )}
    </Text>
  );
};

export default FormFieldLabel;
