/**
 * FormField Component
 * Renders a single field with label, interface component, and validation
 * Based on DaaS form-field component
 * 
 * Uses @buildpad/utils for field readonly detection.
 */

import React, { useMemo } from 'react';
import { Stack, Text, Box } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { FormField as TFormField, ValidationError } from '../types';
import { FormFieldInterface } from './FormFieldInterface';
import { FormFieldLabel } from './FormFieldLabel';
import {
  isFieldReadOnly,
  isNewItem,
  getFieldDisplayName,
  getFieldDefault,
  isConcealedField,
} from '@buildpad/utils';
import type { DeepPartial, FormTranslations } from '@buildpad/utils';
import { useBuildpadTranslations } from '@buildpad/services';

export interface FormFieldProps {
  /** Field definition */
  field: TFormField;
  /** Current field value */
  value?: any;
  /** Initial/default value */
  initialValue?: any;
  /** Change handler */
  onChange?: (value: any) => void;
  /** Unset field value (remove from edits) */
  onUnset?: () => void;
  /** Field is disabled */
  disabled?: boolean;
  /** Field is readonly (view only) */
  readonly?: boolean;
  /** Field is non-editable (view-only, distinct from disabled - shows values but blocks editing) */
  nonEditable?: boolean;
  /** Field is loading */
  loading?: boolean;
  /** Validation error for this field */
  validationError?: ValidationError;
  /** Primary key value (for edit mode) */
  primaryKey?: string | number;
  /** Auto-focus this field */
  autofocus?: boolean;
  /** Hide the field label */
  hideLabel?: boolean;
  /** CSS class name */
  className?: string;
  /** Locale for field name translations (e.g. 'en-US'). If omitted, uses first available translation. */
  locale?: string;
  /** Per-instance overrides of the `form` dictionary namespace (forwarded to the label and interface) */
  translations?: DeepPartial<FormTranslations>;
}

/**
 * FormField - Individual field wrapper with label and interface
 */
export const FormField: React.FC<FormFieldProps> = ({
  field,
  value,
  initialValue,
  onChange,
  onUnset: _onUnset, // prefixed with _ to indicate it's intentionally unused for now
  disabled = false,
  readonly = false,
  nonEditable = false,
  loading = false,
  validationError,
  primaryKey,
  autofocus = false,
  hideLabel = false,
  className,
  locale,
  translations,
}) => {
  // `form` dictionary namespace: prop overrides > provider dictionary > English defaults
  const t = useBuildpadTranslations((d) => d.form, translations);

  // Determine form context (create vs edit)
  const context = useMemo(() => {
    return isNewItem(primaryKey) ? 'create' : 'edit';
  }, [primaryKey]);

  // `disabled` is now ONLY the explicit prop. Everything isFieldReadOnly()
  // reports — meta.readonly, auto-increment, auto-generated UUID PKs, generated
  // defaults — is semantically read-only ("value visible, not editable"), not
  // disabled, so it is routed to `readonly` below instead.
  //
  // This is the layer S2.6 actually lives at: folding isFieldReadOnly into
  // `disabled` here meant a meta.readonly field reached the leaf as
  // disabled=true/readOnly=false no matter what FormFieldInterface computed,
  // which is why dropping readonly from `disabled` downstream changed nothing.
  const isDisabled = disabled;

  const isReadOnly = useMemo(() => {
    if (readonly) return true;

    // Use the comprehensive isFieldReadOnly from @buildpad/utils
    // This handles: auto-increment, UUID PKs, meta.readonly, generated defaults, etc.
    return isFieldReadOnly(field, { context, primaryKey });
  }, [readonly, field, context, primaryKey]);

  // Determine if field is required
  const isRequired = useMemo(() => {
    if (field.meta?.required) return true;
    if (field.schema?.is_nullable === false && !field.schema?.default_value) return true;
    return false;
  }, [field]);

  // Get effective value (use value or default)
  const effectiveValue = useMemo(() => {
    if (value !== undefined) return value;
    // Secrets first, and deliberately ahead of the column default.
    //
    // A hash/conceal column is often omitted from the fetched item (write-only
    // credentials are never round-tripped on read); collapsing that to `null`
    // here would look identical to "no value is set" and cost
    // FormFieldInterface the signal it needs to decide whether to show the
    // mask. And a DDL default on a secret column is not the secret — taking
    // that branch first rendered the literal default as "Value securely
    // stored" and would have submitted it as the credential.
    if (isConcealedField(field)) return undefined;
    // Parse the column default rather than passing the raw SQL text: a
    // Postgres default arrives as `'active'::character varying`, which was
    // rendered verbatim here while the form model held the parsed value.
    const schemaDefault = getFieldDefault(field);
    if (schemaDefault !== undefined) return schemaDefault;
    return null;
  }, [value, field]);

  // Check if field has been edited (deep comparison for objects/arrays)
  const isEdited = useMemo(() => {
    if (value === undefined) return false;
    if (value === initialValue) return false;
    // Deep comparison for non-primitive values
    if (typeof value === 'object' && value !== null && typeof initialValue === 'object' && initialValue !== null) {
      try {
        return JSON.stringify(value) !== JSON.stringify(initialValue);
      } catch {
        return true;
      }
    }
    return true;
  }, [value, initialValue]);

  // Get validation error message
  const errorMessage = useMemo(() => {
    if (!validationError) return undefined;

    // Use custom validation message if available
    if (field.meta?.validation_message) {
      return field.meta.validation_message;
    }

    // Use error message from validation
    if (validationError.message) {
      return validationError.message;
    }

    // Generate default message based on type
    switch (validationError.type) {
      case 'required':
        return t.validation.required;
      case 'unique':
        return t.validation.unique;
      case 'email':
        return t.validation.email;
      case 'url':
        return t.validation.url;
      case 'number':
        return t.validation.number;
      default:
        return t.validation.failed;
    }
  }, [validationError, field, t]);

  // Resolve the human-readable label once. Used both for the visible
  // FormFieldLabel and as the input's accessible name (aria-label).
  const displayName = useMemo(
    () => field.name || getFieldDisplayName(field, locale),
    [field, locale]
  );

  // Get field width class
  const widthClass = useMemo(() => {
    const width = field.meta?.width || 'full';
    if (width === 'half-right') return 'field-width-half-right';
    if (width === 'half' || width === 'half-left') return 'field-width-half';
    if (width === 'fill') return 'field-width-fill';
    return 'field-width-full';
  }, [field.meta?.width]);

  // Classes for validation state
  const invalidClass = validationError ? 'invalid' : '';

  return (
    <Box
      className={`form-field ${widthClass} ${invalidClass} ${className || ''}`}
      data-field={field.field}
      data-edited={isEdited || undefined}
      data-invalid={validationError ? true : undefined}
    >
      <Stack gap="xs">
        {/* Field Label */}
        {!hideLabel && !field.hideLabel && (
          <FormFieldLabel
            label={displayName}
            required={isRequired}
            description={field.meta?.note ?? undefined}
            translations={translations}
          />
        )}

        {/* Field Interface */}
        <FormFieldInterface
          field={field}
          value={effectiveValue}
          onChange={onChange}
          disabled={isDisabled}
          readonly={isReadOnly}
          nonEditable={nonEditable}
          loading={loading}
          required={isRequired}
          error={errorMessage}
          autofocus={autofocus}
          primaryKey={primaryKey}
          accessibleName={displayName}
          translations={translations}
        />

        {/* Validation Error */}
        {validationError && errorMessage && (
          <Text
            size="sm"
            c="red"
            role="alert"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <IconAlertCircle size={14} />
            {errorMessage}
          </Text>
        )}
      </Stack>
    </Box>
  );
};

export default FormField;
