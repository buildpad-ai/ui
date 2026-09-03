/**
 * FormFieldInterface Component
 * Dynamically renders the appropriate interface component for a field
 * Based on DaaS form-field-interface component
 * 
 * Uses @buildpad/utils for field interface mapping and
 * @buildpad/ui-interfaces for interface components.
 */

import React, { useCallback, useMemo } from 'react';
import { Alert, Skeleton, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { FormField } from '../types';
import {
  getFieldInterface,
  getFieldDefault,
  isNewItem,
  isConcealedField,
  concealingInterface,
  CONCEALED_PLACEHOLDER,
  interpolate,
  type DeepPartial,
  type FormTranslations,
  type InterfaceConfig,
  type InterfaceType,
} from '@buildpad/utils';
import { useBuildpadTranslations } from '@buildpad/services';
import { InterfaceErrorBoundary } from './InterfaceErrorBoundary';

// Import interface components
import * as Interfaces from '@buildpad/ui-interfaces';

/**
 * The three multi-select interfaces are registered for `types: ['json','csv']`
 * — storage is either a real array (`json`) or a comma-separated string
 * (`csv`) — but none of the leaf components (or this pipeline, previously)
 * normalized between the two shapes. A `csv` field therefore delivered a raw
 * string straight to array-only leaf logic: substring-match reads
 * (`string.includes` instead of `array.includes`), character-spread
 * corruption on toggle, and `TypeError`s calling `.filter`/`.map` on a
 * string. Normalizing once here — coerce to array on the way in, coerce back
 * to a comma-string on the way out when the field really is `csv` — fixes
 * the whole cluster (SelectMultipleCheckbox, SelectMultipleCheckboxTree,
 * SelectMultipleDropdown) without touching each leaf.
 */
const MULTI_SELECT_INTERFACE_TYPES = new Set([
  'select-multiple-checkbox',
  'select-multiple-dropdown',
  'select-multiple-checkbox-tree',
]);

/** Where the bold interface type goes inside `fieldInterface.componentNotFound.title`. */
const INTERFACE_TYPE_PLACEHOLDER = '{interfaceType}';

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
  /**
   * Accessible name for the input (becomes aria-label on the underlying
   * Mantine control). FormField passes the resolved display name so the
   * input has a programmatic name even though the visible label is
   * rendered separately by FormFieldLabel.
   */
  accessibleName?: string;
  /** Per-instance overrides of the `form` dictionary namespace */
  translations?: DeepPartial<FormTranslations>;
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
  accessibleName,
  translations,
}) => {
  // `form` dictionary namespace: prop overrides > provider dictionary > English defaults
  const t = useBuildpadTranslations((d) => d.form, translations);

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

  // Build props for interface component
  // Merge interfaceConfig.props (from @buildpad/utils) with runtime props.
  //
  // Two distinct locked states, per S2.6:
  //   readonly     — value visible, not editable, still focusable and un-greyed
  //   nonEditable  — no interaction at all; keeps `disabled` on top of readOnly
  // Both suppress onChange; only nonEditable sets `disabled`.
  const isEffectivelyReadonly = readonly || nonEditable;

  // DaaS omits hash field values (e.g. password) from API responses for security.
  // DaaS uses a server-side 'conceal' transformer to return '**********' instead.
  // Synthesize the same indicator so InputHash can detect an existing hashed value.
  //
  // Hoisted above the early returns below (loading skeleton / component-not-found alert)
  // so every hook in this component runs unconditionally on every render. Previously this
  // useMemo ran after those returns, so toggling `loading` or the interface resolving from
  // unknown to known changed the hook count on the same instance, triggering React's
  // "Rendered more hooks than during the previous render" crash.
  const effectiveValue = useMemo(() => {
    if (value !== undefined && value !== null) return value;

    // Nothing to mask unless this is a secret field AND the interface renders
    // one — a plain text control must show an empty box, not a literal row of
    // asterisks the user could submit as their password.
    if (!isConcealedField(field) || !concealingInterface(interfaceConfig.type)) {
      // Normalise back to null. FormField used to guarantee the leaf never
      // saw `undefined`; now that it forwards the omitted signal, that
      // guarantee is restored here rather than dropped.
      return null;
    }

    // A record that does not exist yet cannot have a stored secret. Without
    // this the create form showed a closed padlock and "Value securely
    // stored", and users saved accounts with no credential at all.
    if (isNewItem(primaryKey)) return null;

    // `conceal` distinguishes its own empty state: the server returns the mask
    // when a value exists and `null` when it does not, so an explicit null is
    // the answer and must pass through — re-masking it stranded a just-cleared
    // token as "still set" forever.
    if (value === null && interfaceConfig.type === 'system-token') return null;

    // Otherwise the field was omitted (write-only columns are not round-tripped
    // on read), or a `hash` leaf emitted null because the user typed and then
    // erased. Neither means the stored credential is gone.
    return CONCEALED_PLACEHOLDER;
  }, [value, field, interfaceConfig.type, primaryKey]);

  const isMultiSelectInterface = MULTI_SELECT_INTERFACE_TYPES.has(interfaceConfig.type);

  // Coerce a csv-stored string to an array before it reaches the leaf.
  const normalizedMultiSelectValue = useMemo(() => {
    if (!isMultiSelectInterface) return effectiveValue;
    if (Array.isArray(effectiveValue)) return effectiveValue;
    if (typeof effectiveValue === 'string') {
      return effectiveValue.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return effectiveValue ?? [];
  }, [isMultiSelectInterface, effectiveValue]);

  // Whether this field's on-the-wire storage is a comma-string rather than a
  // real array. `field.type === 'csv'` is the documented signal, but some
  // DaaS backends report the underlying column type (e.g. "text") instead
  // of the abstract "csv" type — so also trust what was actually observed:
  // if the incoming value was a string, round-trip a string back out.
  const isCsvStorage = field.type === 'csv' || typeof effectiveValue === 'string';

  // Coerce the array a multi-select leaf emits back to a comma-string when
  // the field's real storage is csv (leaves always emit arrays).
  const handleMultiSelectChange = useCallback(
    (next: unknown) => {
      if (!onChange) return;
      if (isCsvStorage && Array.isArray(next)) {
        onChange(next.join(','));
      } else {
        onChange(next);
      }
    },
    [onChange, isCsvStorage],
  );

  // Show loading skeleton
  if (loading && !field.hideLoader) {
    return <Skeleton height={36} />;
  }

  // Show error if component not found
  if (!InterfaceComponent) {
    // The interface type is rendered bold, so the template is split around
    // its placeholder instead of being interpolated into one string.
    const [before, after] = t.fieldInterface.componentNotFound.title.split(INTERFACE_TYPE_PLACEHOLDER);
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="warning">
        <Text size="sm">
          {before}<Text component="span" fw={600}>{interfaceConfig.type}</Text>{after}
        </Text>
        <Text size="xs" c="dimmed" mt="xs">
          {interpolate(t.fieldInterface.componentNotFound.detail, { field: field.field, type: field.type })}
        </Text>
      </Alert>
    );
  }

  const interfaceProps: any = {
    value: isMultiSelectInterface ? normalizedMultiSelectValue : effectiveValue,
    error,
    // Note: label is NOT passed here because FormField already renders FormFieldLabel.
    // We forward an aria-label so the underlying input still has a programmatic
    // accessible name (axe "label" rule). Each interface spreads this onto its
    // Mantine control via ...rest.

    // Field metadata
    collection: field.collection,
    field: field.field,
    type: field.type,
    primaryKey,
    
    // Schema properties
    maxLength: field.schema?.max_length,
    nullable: field.schema?.is_nullable,
    // Parsed, not the raw SQL text: the column default reaches an
    // interface as `'active'::character varying` otherwise, so an
    // interface that honours this prop would disagree with the model.
    defaultValue: getFieldDefault(field),

    // Spread interface-specific props from InterfaceConfig (includes meta.options)
    ...interfaceConfig.props,

    // ── Container-owned props: declared AFTER the meta.options spread ──
    // The accessible name is the container's to set, not the field author's:
    // FormField renders the visible label itself and deliberately withholds
    // `label` from the leaf, so this is the input's only programmatic name
    // (axe "label" rule). Declared below the spread because admin-authored
    // options JSON is unfiltered — an `aria-label` key in it silently erased
    // the name, and an explicit `undefined` value erased it outright.
    'aria-label': accessibleName || field.name || field.field,

    // A locked field can never be satisfied by the user, so it must not render
    // the required asterisk or set aria-required — that would tell assistive
    // tech to fill a field the user may not edit.
    required: isEffectivelyReadonly ? false : required,
    // Never steal initial focus into a field that cannot be edited. Both of
    // these sat ABOVE the meta.options spread, so an admin-authored
    // `autofocus: true` (or `required: true`) on a readonly field overrode the
    // suppression — the same hazard the lock props below were moved down for.
    autofocus: isEffectivelyReadonly ? false : autofocus,

    // ── Lock props: declared AFTER the meta.options spread so they win ──
    // Admin-authored options JSON flows into interfaceConfig.props unfiltered,
    // so a stray `readOnly: false` / `disabled: false` / `onChange` key would
    // otherwise unlock the control. That was only half-effective before
    // (defeating readOnly still left disabled=true), but is decisive now that
    // readonly no longer implies disabled.
    //
    // onChange is suppressed for readonly as well as nonEditable: with
    // `disabled` gone for a merely-readonly field this is the container-level
    // write block, and it must not depend on each leaf honouring `readOnly`.
    onChange: isEffectivelyReadonly ? undefined : (isMultiSelectInterface ? handleMultiSelectChange : onChange),
    // S2.6: a merely-readonly field (readonly=true, nonEditable=false) must NOT
    // also set disabled=true — the two are visually and semantically distinct
    // (readonly: value visible, not editable; disabled: greyed out, inert).
    // nonEditable is stronger — no interaction at all, including focus — so it
    // keeps the disabled styling on top of readOnly.
    disabled: disabled || nonEditable,
    readOnly: isEffectivelyReadonly,
  };

  // Note: File interfaces (File, FileImage, Files) now use @buildpad/hooks useFiles
  // directly and don't need an external upload handler passed in

  // Render interface component wrapped in error boundary
  return (
    <InterfaceErrorBoundary interfaceName={interfaceConfig.type} fieldKey={field.field} translations={translations}>
      <InterfaceComponent {...interfaceProps} />
    </InterfaceErrorBoundary>
  );
};

export default FormFieldInterface;
