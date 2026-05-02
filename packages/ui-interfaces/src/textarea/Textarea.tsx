/**
 * Textarea Interface Component
 * Multi-line text input based on DaaS input-multiline interface
 */

import React, { forwardRef, useMemo } from 'react';
import { Textarea as MantineTextarea, Text, Box } from '@mantine/core';

export interface TextareaProps {
  /** Current value */
  value?: string | null;
  /** Change handler */
  onChange?: (value: string | null) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is readonly */
  readOnly?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Description/help text */
  description?: string;
  /** Soft character length limit (shows counter when approaching limit) */
  softLength?: number;
  /** Whether to trim whitespace on blur */
  trim?: boolean;
  /** Font family */
  font?: 'sans-serif' | 'serif' | 'monospace';
  /** Whether to show clear button */
  clear?: boolean;
  /** Text direction */
  direction?: 'ltr' | 'rtl';
  /** Minimum number of rows */
  minRows?: number;
  /** Maximum number of rows */
  maxRows?: number;
  /** Whether to autosize based on content */
  autosize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  description,
  softLength,
  trim = false,
  font = 'sans-serif',
  clear = false,
  direction,
  minRows = 3,
  maxRows = 10,
  autosize = true,
}, ref) => {
  // Calculate characters remaining
  const charsRemaining = useMemo(() => {
    if (!softLength) return null;
    if (!value) return softLength;
    // Replace newlines with single char for counting (like DaaS)
    const realLength = value.replace(/\n/g, ' ').length;
    return softLength - realLength;
  }, [value, softLength]);

  // Calculate percentage remaining
  const percentageRemaining = useMemo(() => {
    if (!softLength) return null;
    if (!value) return 100;
    return 100 - (value.length / softLength) * 100;
  }, [value, softLength]);

  // Get font family style
  const getFontFamily = () => {
    switch (font) {
      case 'monospace':
        return 'var(--mantine-font-family-monospace, monospace)';
      case 'serif':
        return 'var(--mantine-font-family-headings, Georgia, serif)';
      default:
        return 'var(--mantine-font-family, sans-serif)';
    }
  };

  // Handle value changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue: string | null = e.currentTarget.value;
    
    if (newValue === '' && !clear) {
      newValue = null;
    }
    
    onChange?.(newValue);
  };

  // Handle blur for trim functionality
  const handleBlur = () => {
    if (trim && value) {
      const trimmed = value.trim();
      if (trimmed !== value) {
        onChange?.(trimmed || null);
      }
    }
  };

  // Determine warning level for character counter
  const getCounterColor = () => {
    if (!percentageRemaining) return 'dimmed';
    if (percentageRemaining < 5) return 'red';
    if (percentageRemaining < 10) return 'orange';
    if (percentageRemaining <= 20) return 'warning';
    return 'dimmed';
  };

  return (
    <Box pos="relative">
      <MantineTextarea
        ref={ref}
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        error={error}
        description={description}
        autosize={autosize}
        minRows={minRows}
        maxRows={maxRows}
        dir={direction}
        styles={{
          input: {
            fontFamily: getFontFamily(),
            paddingBottom: softLength ? '24px' : undefined,
            cursor: readOnly ? 'default' : undefined,
          },
        }}
      />
      
      {/* Character counter - shows when softLength is set and approaching/at limit */}
      {softLength && (percentageRemaining !== null && percentageRemaining <= 20) && (
        <Text
          size="xs"
          c={getCounterColor()}
          fw={600}
          style={{
            position: 'absolute',
            right: 10,
            bottom: error ? 28 : 8,
            fontFeatureSettings: '"tnum"',
          }}
        >
          {charsRemaining}
        </Text>
      )}
    </Box>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
