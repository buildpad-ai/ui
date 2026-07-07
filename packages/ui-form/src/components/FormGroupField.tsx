/**
 * FormGroupField Component
 * Renders group interface fields (group-detail, group-accordion, group-raw)
 * as wrappers around their child fields.
 *
 * Group fields in DaaS have type="alias" and special=["alias","group","no-data"].
 * Their children are fields where meta.group === this field's name.
 */

import React, { useMemo } from 'react';
import { Box } from '@mantine/core';
import type { Field } from '@buildpad/types';
import { GroupDetail, GroupAccordion, GroupRaw } from '@buildpad/ui-interfaces';
import { getFieldInterface, getFieldDisplayName } from '@buildpad/utils';
import type { FormField as TFormField, ValidationError } from '../types';
import { FormField } from './FormField';
import { isFieldVisible } from '../utils/get-form-fields';

export interface FormGroupFieldProps {
  /** The group field definition */
  field: TFormField;
  /** All fields in the collection (needed to find children) */
  allFields: Field[];
  /** Current form values */
  values: Record<string, any>;
  /** Initial form values */
  initialValues: Record<string, any>;
  /** Validation errors */
  validationErrors: ValidationError[];
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Whether the form is non-editable (view-only, distinct from disabled) */
  nonEditable?: boolean;
  /** Whether the form is loading */
  loading?: boolean;
  /** Primary key */
  primaryKey?: string | number;
  /** Field change handler */
  onFieldChange: (fieldName: string, value: any) => void;
  /** Field unset handler */
  onFieldUnset: (fieldName: string) => void;
  /** Get validation error for a field */
  getFieldError: (fieldName: string) => ValidationError | undefined;
  /** Set of field keys that are non-editable due to permission read/write distinction */
  nonEditableFields?: Set<string>;
  /** CSS class */
  className?: string;
  /** Locale for field name translations */
  locale?: string;
}

/**
 * Get child fields that belong to a group
 */
function getChildFields(allFields: Field[], groupName: string): TFormField[] {
  return allFields
    .filter((f) => f.meta?.group === groupName && isFieldVisible(f))
    .sort((a, b) => (a.meta?.sort ?? 0) - (b.meta?.sort ?? 0))
    .map((f) => ({
      ...f,
      name: (f as Record<string, any>).name ?? getFieldDisplayName(f),
    })) as TFormField[];
}

/**
 * Renders child fields as a stack of FormField components
 */
function ChildFieldsRenderer({
  childFields,
  values,
  initialValues,
  disabled,
  nonEditable,
  loading,
  primaryKey,
  onFieldChange,
  onFieldUnset,
  getFieldError,
  allFields,
  validationErrors,
  nonEditableFields,
  locale,
}: {
  childFields: TFormField[];
  values: Record<string, any>;
  initialValues: Record<string, any>;
  disabled: boolean;
  nonEditable: boolean;
  loading: boolean;
  primaryKey?: string | number;
  onFieldChange: (fieldName: string, value: any) => void;
  onFieldUnset: (fieldName: string) => void;
  getFieldError: (fieldName: string) => ValidationError | undefined;
  allFields: Field[];
  validationErrors: ValidationError[];
  nonEditableFields?: Set<string>;
  locale?: string;
}) {
  // Lay children out in the same two-column `.form-grid` the top-level VForm
  // uses, so each child's `field-width-*` class (which controls `grid-column`)
  // actually takes effect. A flex column here would make every child full-width
  // regardless of its configured width — breaking half/full inside sections.
  return (
    <div className="form-grid">
      {childFields.map((child) => {
        // Check if this child is itself a group (nested groups)
        const isChildGroup = child.meta?.special?.includes?.('group');
        if (isChildGroup) {
          return (
            <FormGroupField
              key={child.field}
              field={child}
              allFields={allFields}
              values={values}
              initialValues={initialValues}
              validationErrors={validationErrors}
              disabled={disabled}
              nonEditable={nonEditable}
              loading={loading}
              primaryKey={primaryKey}
              onFieldChange={onFieldChange}
              onFieldUnset={onFieldUnset}
              getFieldError={getFieldError}
              nonEditableFields={nonEditableFields}
              locale={locale}
            />
          );
        }

        const isFieldNonEditable = nonEditable || (nonEditableFields?.has(child.field) ?? false);

        return (
          <FormField
            key={child.field}
            field={child}
            value={values[child.field]}
            initialValue={initialValues[child.field]}
            onChange={(value) => onFieldChange(child.field, value)}
            onUnset={() => onFieldUnset(child.field)}
            disabled={disabled}
            nonEditable={isFieldNonEditable}
            loading={loading}
            validationError={getFieldError(child.field)}
            primaryKey={primaryKey}
            locale={locale}
          />
        );
      })}
    </div>
  );
}

/**
 * FormGroupField - Renders a group interface wrapping its child fields
 */
export const FormGroupField: React.FC<FormGroupFieldProps> = ({
  field,
  allFields,
  values,
  initialValues,
  validationErrors,
  disabled = false,
  nonEditable = false,
  loading = false,
  primaryKey,
  onFieldChange,
  onFieldUnset,
  getFieldError,
  nonEditableFields,
  className,
  locale,
}) => {
  const interfaceConfig = useMemo(() => getFieldInterface(field), [field]);
  const interfaceType = interfaceConfig.type;

  // Get direct child fields of this group
  const childFields = useMemo(
    () => getChildFields(allFields, field.field),
    [allFields, field.field],
  );

  // Get validation errors relevant to children of this group
  const childValidationErrors = useMemo(() => {
    const childFieldNames = new Set(childFields.map((f) => f.field));
    return validationErrors.filter((e) => childFieldNames.has(e.field));
  }, [validationErrors, childFields]);

  // Common child renderer props
  const childProps = {
    childFields,
    values,
    initialValues,
    disabled,
    nonEditable,
    loading,
    primaryKey,
    onFieldChange,
    onFieldUnset,
    getFieldError,
    allFields,
    validationErrors,
    nonEditableFields,
    locale,
  };

  // Render based on group interface type
  if (interfaceType === 'group-detail') {
    return (
      <Box
        className={`form-field field-width-${className || 'full'}`}
        data-field={field.field}
      >
        <GroupDetail
          field={field as any}
          fields={allFields as any}
          values={values}
          initialValues={initialValues}
          disabled={disabled}
          loading={loading}
          validationErrors={childValidationErrors as any}
          start={interfaceConfig.props?.start as 'open' | 'closed'}
          headerIcon={interfaceConfig.props?.headerIcon as string}
          headerColor={interfaceConfig.props?.headerColor as string}
          badge={interfaceConfig.props?.badge as string}
        >
          <ChildFieldsRenderer {...childProps} />
        </GroupDetail>
      </Box>
    );
  }

  if (interfaceType === 'group-accordion') {
    return (
      <Box
        className={`form-field field-width-${className || 'full'}`}
        data-field={field.field}
      >
        <GroupAccordion
          field={field as any}
          fields={allFields as any}
          values={values}
          initialValues={initialValues}
          disabled={disabled}
          loading={loading}
          validationErrors={childValidationErrors as any}
          accordionMode={interfaceConfig.props?.accordionMode as boolean}
          start={interfaceConfig.props?.start as 'opened' | 'closed' | 'first'}
          renderSection={(section) => {
            // Matches DaaS accordion-section.vue fieldsInSection logic:
            // 1. Always include the section field itself (with hideLabel)
            // 2. If the section is a group, also include its nested children
            const isGroup = section.meta?.special?.includes?.('group');

            if (isGroup) {
              // Section is a group field — render its children as form fields
              const sectionChildren = getChildFields(allFields, section.field);
              if (sectionChildren.length === 0) return null;
              return (
                <ChildFieldsRenderer
                  {...childProps}
                  childFields={sectionChildren}
                />
              );
            }

            // Section is a regular field — render the field itself (hideLabel)
            // This matches DaaS: [merge({}, field, { hideLabel: true })]
            // Look up the full Field object from allFields to guarantee all
            // properties (type, schema, collection, meta) are present, since
            // the renderSection callback type only declares a subset.
            const fullField = allFields.find((f) => f.field === section.field) || section;
            const sectionFormField = {
              ...fullField,
              name: (fullField as any).name ?? getFieldDisplayName(fullField as Field),
              hideLabel: true,
            } as TFormField;

            const isSectionNonEditable = nonEditable || (nonEditableFields?.has(section.field) ?? false);
            return (
              <FormField
                key={section.field}
                field={sectionFormField}
                value={values[section.field]}
                initialValue={initialValues[section.field]}
                onChange={(value) => onFieldChange(section.field, value)}
                onUnset={() => onFieldUnset(section.field)}
                disabled={disabled}
                nonEditable={isSectionNonEditable}
                loading={loading}
                validationError={getFieldError(section.field)}
                primaryKey={primaryKey}
                locale={locale}
              />
            );
          }}
        >
          <ChildFieldsRenderer {...childProps} />
        </GroupAccordion>
      </Box>
    );
  }

  if (interfaceType === 'group-raw') {
    return (
      <Box
        className={`form-field field-width-${className || 'full'}`}
        data-field={field.field}
      >
        <GroupRaw field={field as any} disabled={disabled}>
          <ChildFieldsRenderer {...childProps} />
        </GroupRaw>
      </Box>
    );
  }

  // Fallback: render children without wrapper (unknown group type)
  return (
    <Box
      className={`form-field field-width-${className || 'full'}`}
      data-field={field.field}
    >
      <ChildFieldsRenderer {...childProps} />
    </Box>
  );
};

export default FormGroupField;
