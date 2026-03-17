/**
 * FormFieldInterface Component
 * Dynamically renders the appropriate interface component for a field
 * Based on DaaS form-field-interface component
 * 
 * Uses @buildpad/utils for field interface mapping and
 * @buildpad/ui-interfaces for interface components.
 */

import React, { useMemo } from 'react';
import { Alert, Skeleton, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { FormField } from '../types';
import { getFieldInterface, type InterfaceConfig, type InterfaceType } from '@buildpad/utils';
import { InterfaceErrorBoundary } from './InterfaceErrorBoundary';

// Import interface components
import * as Interfaces from '@buildpad/ui-interfaces';

/**
 * Get the default interface name for a given field type.
 * Mirrors DaaS getDefaultInterfaceForType so that fields with
 * `meta.interface === null` still render a sensible component.
 */
function getDefaultInterfaceForType(type: string | undefined | null): InterfaceType {
  switch (type) {
    case 'bigInteger':
    case 'integer':
    case 'float':
    case 'decimal':
      return 'input';
    case 'boolean':
      return 'boolean';
    case 'text':
      return 'input-multiline';
    case 'json':
    case 'csv':
      return 'input-code';
    case 'dateTime':
    case 'date':
    case 'time':
    case 'timestamp':
      return 'datetime';
    case 'uuid':
      return 'input';
    case 'hash':
      return 'input-hash';
    case 'geometry':
      return 'map';
    default:
      return 'input';
  }
}

export interface FormFieldInterfaceProps {
  /** Field definition */
  field: FormField;
  /** Current value */
  value?: any;
  /** Change handler */
  onChange?: (value: any) => void;
  /** Field is disabled */
  disabled?: boolean;
  /** Field is readonly */
  readonly?: boolean;
  /** Field is non-editable (view-only, distinct from disabled) */
  nonEditable?: boolean;
  /** Field is required */
  required?: boolean;
  /** Field is loading */
  loading?: boolean;
  /** Error message */
  error?: string;
  /** Auto-focus */
  autofocus?: boolean;
  /** Primary key (for edit mode) */
  primaryKey?: string | number;
}

/**
 * FormFieldInterface - Dynamic interface component loader
 */
export const FormFieldInterface: React.FC<FormFieldInterfaceProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  readonly = false,
  nonEditable = false,
  required = false,
  loading = false,
  error,
  autofocus = false,
  primaryKey,
}) => {
  // Get interface configuration from @buildpad/utils
  // Returns InterfaceConfig with type and props
  // Falls back to default interface for the field type when meta.interface is null
  const interfaceConfig: InterfaceConfig = useMemo(() => {
    const config = getFieldInterface(field);
    // If the utility returned an empty type, derive from field.type
    if (!config.type) {
      return { ...config, type: getDefaultInterfaceForType(field.type) };
    }
    return config;
  }, [field]);

  // Get interface component by type
  const InterfaceComponent = useMemo(() => {
    const interfaceType = interfaceConfig.type;
    
    // Map interface types to component names
    // This handles special cases like relational interfaces and acronyms
    const interfaceComponentMap: Record<string, string> = {
      // Text inputs
      'input': 'Input',
      'input-code': 'InputCode',
      'input-hash': 'InputHash',
      'input-multiline': 'Textarea',
      'input-autocomplete-api': 'AutocompleteAPI',
      'input-block-editor': 'InputBlockEditor',
      'input-rich-text-html': 'RichTextHTML',
      'input-rich-text-md': 'RichTextMarkdown',
      'textarea': 'Textarea',
      
      // Boolean
      'boolean': 'Boolean',
      'toggle': 'Toggle',
      
      // Date / Time
      'datetime': 'DateTime',
      
      // Selection
      'select-dropdown': 'SelectDropdown',
      'select-radio': 'SelectRadio',
      'select-icon': 'SelectIcon',
      'select-color': 'Color',
      
      // Multiple selection
      'select-multiple-checkbox': 'SelectMultipleCheckbox',
      'select-multiple-dropdown': 'SelectMultipleDropdown',
      'select-multiple-checkbox-tree': 'SelectMultipleCheckboxTree',
      
      // Other inputs
      'slider': 'Slider',
      'tags': 'Tags',
      'number': 'Input', // Use Input with type="number"
      'uuid': 'Input',
      
      // Presentation / Layout
      'presentation-divider': 'Divider',
      'presentation-notice': 'Notice',
      'group-detail': 'GroupDetail',
      'group-accordion': 'GroupAccordion',
      'group-raw': 'GroupRaw',
      
      // Note: Relational interfaces (select-dropdown-m2o, list-o2m, list-m2m, list-m2a)
      // are mapped separately in relationalFullComponentMap below
      // to use full implementations with hooks integration
      
      // File interfaces - use the real DaaS-integrated components
      'file': 'File',
      'file-image': 'FileImage',
      'files': 'Files',
      
      // Collection
      'collection-item-dropdown': 'CollectionItemDropdown',
      
      // Map / Geometry
      'map': 'Map',
      
      // Workflow
      'workflow-button': 'WorkflowButton',

      // System Token
      'system-token': 'SystemToken',

      // System Permissions
      'system-permissions': 'SystemPermissions',
    };
    
    // For relational interfaces, prefer the full implementation (ListM2M, SelectDropdownM2O, ListO2M)
    // over the placeholder *Interface components that require render props.
    // The full implementations use @buildpad/hooks and @buildpad/ui-collections internally.
    const relationalFullComponentMap: Record<string, string> = {
      'list-m2o': 'SelectDropdownM2O',
      'select-dropdown-m2o': 'SelectDropdownM2O',
      'list-o2m': 'ListO2M',
      'list-m2m': 'ListM2M',
      'list-m2a': 'ListM2A',
    };
    
    // Check if this is a relational interface - use full component
    let componentName = relationalFullComponentMap[interfaceType] || interfaceComponentMap[interfaceType];
    
    if (!componentName) {
      // Fallback: Convert kebab-case to PascalCase
      componentName = interfaceType
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    }

    // Get component from interfaces package
    const component = (Interfaces as any)[componentName];
    
    return component;
  }, [interfaceConfig.type]);

  // Show loading skeleton
  if (loading && !field.hideLoader) {
    return <Skeleton height={36} />;
  }

  // Show error if component not found
  if (!InterfaceComponent) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        <Text size="sm">
          Interface component not found: <Text component="span" fw={600}>{interfaceConfig.type}</Text>
        </Text>
        <Text size="xs" c="dimmed" mt="xs">
          Field: {field.field} (Type: {field.type})
        </Text>
      </Alert>
    );
  }

  // Build props for interface component
  // Merge interfaceConfig.props (from @buildpad/utils) with runtime props
  // When nonEditable, suppress onChange and mark disabled+readonly
  const isEffectivelyReadonly = readonly || nonEditable;

  // DaaS omits hash field values (e.g. password) from API responses for security.
  // Directus uses a server-side 'conceal' transformer to return '**********' instead.
  // Synthesize the same indicator so InputHash can detect an existing hashed value.
  const effectiveValue = useMemo(() => {
    if (value !== undefined && value !== null) return value;
    const isHashField = field.meta?.special?.includes?.('hash') || field.type === 'hash';
    if (isHashField && interfaceConfig.type === 'input-hash') return '**********';
    const isConcealField = field.meta?.special?.includes?.('conceal');
    if (isConcealField && interfaceConfig.type === 'system-token') return '**********';
    return value;
  }, [value, field, interfaceConfig.type]);

  const interfaceProps: any = {
    value: effectiveValue,
    onChange: nonEditable ? undefined : onChange,
    disabled: disabled || isEffectivelyReadonly,
    readonly: isEffectivelyReadonly,
    required: nonEditable ? false : required,
    error,
    autofocus,
    // Note: label is NOT passed here because FormField already renders FormFieldLabel
    
    // Field metadata
    collection: field.collection,
    field: field.field,
    type: field.type,
    primaryKey,
    
    // Schema properties
    maxLength: field.schema?.max_length,
    nullable: field.schema?.is_nullable,
    defaultValue: field.schema?.default_value,
    
    // Spread interface-specific props from InterfaceConfig (includes meta.options)
    ...interfaceConfig.props,
  };

  // Note: File interfaces (File, FileImage, Files) now use @buildpad/hooks useFiles
  // directly and don't need an external upload handler passed in

  // Render interface component wrapped in error boundary
  return (
    <InterfaceErrorBoundary interfaceName={interfaceConfig.type} fieldKey={field.field}>
      <InterfaceComponent {...interfaceProps} />
    </InterfaceErrorBoundary>
  );
};

export default FormFieldInterface;
