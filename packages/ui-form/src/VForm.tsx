/**
 * VForm Component
 * Dynamic form that renders fields based on collection schema
 * Based on DaaS v-form component
 * 
 * Integrates with:
 * - @buildpad/types for Field types
 * - @buildpad/services for FieldsService API calls and DaaS context
 * - @buildpad/utils for field interface mapping and utilities
 * - @buildpad/ui-interfaces (via FormFieldInterface) for interface components
 * 
 * Security Features (following DaaS architecture):
 * - Field-level permissions filtering (show only accessible fields)
 * - Action-based permissions (create, read, update mode)
 * - Integration with DaaSProvider for authenticated requests
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './VForm.css';
import { Stack, Box, Alert, Text, Skeleton } from '@mantine/core';
import { isNewItem, isFieldReadOnly, isPresentationField, interpolate } from '@buildpad/utils';
import type { DeepPartial, FormTranslations } from '@buildpad/utils';
import { IconInfoCircle, IconLock } from '@tabler/icons-react';
import type { Field } from '@buildpad/types';
import { FieldsService, useDaaSContextOptional, useBuildpadTranslations } from '@buildpad/services';
// isPresentationField is available from @buildpad/utils if needed for filtering
import type { ValidationError, FieldValues } from './types';
import { FormField } from './components/FormField';
import { FormGroupField } from './components/FormGroupField';
import { ValidationErrors } from './components/ValidationErrors';
import {
  getFormFields,
  getDefaultValuesFromFields,
  isFieldVisible,
  isGroupField,
  updateFieldWidths,
} from './utils';
import { applyConditions } from './utils/apply-conditions';
import { pushGroupOptionsDown } from './utils/push-group-options-down';
import { updateSystemDivider } from './utils/update-system-divider';
import { setPrimaryKeyReadonly } from './utils/set-primary-key-readonly';

/**
 * Permission action for the form
 */
export type FormAction = 'create' | 'read' | 'update';

export interface VFormProps {
  /** Collection name to load fields from */
  collection?: string;
  /** Explicit field definitions (overrides collection) */
  fields?: Field[];
  /** Current form values (edited fields only) */
  modelValue?: FieldValues;
  /** Initial/default values */
  initialValues?: FieldValues;
  /** Update handler for form values */
  onUpdate?: (values: FieldValues) => void;
  /** Primary key value for edit mode ('+' for create) */
  primaryKey?: string | number;
  /** Disable all fields */
  disabled?: boolean;
  /** 
   * Non-editable mode. Shows field values but prevents editing.
   * Unlike `disabled` which greys out fields, nonEditable renders them
   * in a readable view-only state.
   */
  nonEditable?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Validation errors */
  validationErrors?: ValidationError[];
  /** Auto-focus first editable field */
  autofocus?: boolean;
  /** Show only fields in this group */
  group?: string | null;
  /** Show divider between system and user fields */
  showDivider?: boolean;
  /** Show message when no visible fields */
  showNoVisibleFields?: boolean;
  /** Show validation errors summary banner at top of form */
  showValidationSummary?: boolean;
  /** Fields to exclude from rendering */
  excludeFields?: string[];
  /** CSS class name */
  className?: string;
  /** 
   * Form action for permission filtering.
   * - 'create': Filter by create permissions (default for primaryKey === '+')
   * - 'update': Filter by update permissions (default for existing primaryKey)
   * - 'read': Filter by read permissions (for read-only forms)
   */
  action?: FormAction;
  /** 
   * Enable permission-based field filtering.
   * When true, only fields the user has permission to access will be shown.
   * Fields that are readable but not writable will be rendered as nonEditable.
   * Requires DaaSProvider context for authentication.
   */
  enforcePermissions?: boolean;
  /**
   * Callback when permissions are loaded
   */
  onPermissionsLoaded?: (accessibleFields: string[]) => void;
  /**
   * Callback when field is scrolled to (from ValidationErrors click)
   */
  onScrollToField?: (fieldKey: string) => void;
  /** Locale for field name translations (e.g. 'en-US'). If omitted, uses first available translation. */
  locale?: string;
  /**
   * Per-instance overrides of the `form` dictionary namespace, merged over
   * the `BuildpadI18nProvider` dictionary and the English defaults. Forwarded
   * to every field, group and the validation summary this form renders.
   */
  translations?: DeepPartial<FormTranslations>;
}

// Stable empty references to prevent re-renders
const EMPTY_OBJECT: FieldValues = {};
const EMPTY_ARRAY: string[] = [];
const EMPTY_VALIDATION_ERRORS: ValidationError[] = [];
const EMPTY_SET: Set<string> = new Set();

/**
 * Deep equality comparison for field values.
 * Handles primitives, arrays, plain objects, null/undefined, and Date.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => isDeepEqual(item, (b as unknown[])[i]));
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    isDeepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

/**
 * VForm - Dynamic form component
 */
export const VForm: React.FC<VFormProps> = ({
  collection,
  fields: fieldsProp,
  modelValue,
  initialValues,
  onUpdate,
  primaryKey,
  disabled = false,
  nonEditable = false,
  loading: loadingProp = false,
  validationErrors,
  autofocus = false,
  group = null,
  showDivider: _showDivider = false,
  showNoVisibleFields = true,
  showValidationSummary = true,
  excludeFields,
  className,
  action,
  enforcePermissions = false,
  onPermissionsLoaded,
  onScrollToField,
  locale,
  translations,
}) => {
  // Use stable references for optional props
  const stableModelValue = useMemo(
    () => modelValue || EMPTY_OBJECT,
    [modelValue]
  );
  const stableInitialValues = useMemo(
    () => initialValues || EMPTY_OBJECT,
    [initialValues]
  );
  const stableValidationErrors = useMemo(
    () => validationErrors || EMPTY_VALIDATION_ERRORS,
    [validationErrors]
  );
  const stableExcludeFields = useMemo(
    () => excludeFields || EMPTY_ARRAY,
    [excludeFields]
  );
  
  const [fields, setFields] = useState<Field[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  /**
   * Field-load error. A dictionary key is stored rather than the resolved
   * string so the message follows a locale switch without re-running the load
   * effect; a runtime `Error.message` is kept verbatim.
   */
  const [error, setError] = useState<
    { key: keyof FormTranslations['vForm']['error'] } | { message: string } | null
  >(null);
  const [accessibleFields, setAccessibleFields] = useState<string[] | null>(null);
  /** Fields that are readable but NOT writable — shown as nonEditable */
  const [readOnlyPermFields, setReadOnlyPermFields] = useState<Set<string>>(EMPTY_SET);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  
  // Get DaaS context for authenticated requests (optional — works without DaaSProvider)
  const daasContext = useDaaSContextOptional();

  // `form` dictionary namespace: prop overrides > provider dictionary > English defaults
  const t = useBuildpadTranslations((d) => d.form, translations);
  
  // Determine the action based on primaryKey if not explicitly provided
  const effectiveAction: FormAction = useMemo(() => {
    if (action) return action;
    if (isNewItem(primaryKey)) return 'create';
    if (primaryKey) return 'update';
    return 'read';
  }, [action, primaryKey]);

  // Load fields from API if collection is provided
  useEffect(() => {
    if (fieldsProp) {
      setFields(fieldsProp);
      return;
    }

    if (!collection) {
      setError({ key: 'missingCollectionOrFields' });
      return;
    }

    const loadFields = async () => {
      try {
        setLoadingFields(true);
        setError(null);
        
        const fieldsService = new FieldsService();
        const loadedFields = await fieldsService.readAll(collection);
        setFields(loadedFields);
      } catch (err) {
        console.error('Error loading fields:', err);
        setError(err instanceof Error ? { message: err.message } : { key: 'loadFieldsFailed' });
      } finally {
        setLoadingFields(false);
      }
    };

    loadFields();
  }, [collection, fieldsProp]);

  // Load permissions if enforcePermissions is enabled
  // Loads both read permissions AND write (create/update) permissions
  // Fields visible in read but not in write are rendered as nonEditable
  useEffect(() => {
    if (!enforcePermissions || !collection) {
      setAccessibleFields(null);
      setReadOnlyPermFields(EMPTY_SET);
      return;
    }

    const loadPermissions = async () => {
      try {
        setPermissionsLoading(true);
        
        const buildUrl = (permAction: string) =>
          daasContext?.isDirectMode
            ? daasContext.buildUrl(`/api/permissions/${collection}?action=${permAction}`)
            : `/api/permissions/${collection}?action=${permAction}`;
        
        const fetchFields = async (permAction: string): Promise<string[]> => {
          const response = await fetch(buildUrl(permAction), {
            headers: daasContext?.getHeaders() ?? {},
            credentials: 'include',
          });
          if (!response.ok) {
            if (response.status === 403) return [];
            throw new Error(`Failed to fetch permissions: ${response.status}`);
          }
          const data = await response.json();
          return data.data?.fields || [];
        };

        // Load read + write permissions in parallel
        const writeAction = effectiveAction === 'read' ? 'read' : effectiveAction;
        const [readFields, writeFields] = await Promise.all([
          fetchFields('read'),
          effectiveAction !== 'read' ? fetchFields(writeAction) : Promise.resolve([]),
        ]);

        // Determine accessible fields (union of read + write)
        const readSet = new Set(readFields);
        const writeSet = new Set(writeFields);
        const hasReadWildcard = readFields.includes('*');
        const hasWriteWildcard = writeFields.includes('*');

        // All accessible = readable OR writable
        const allAccessible = hasReadWildcard
          ? ['*']
          : [...new Set([...readFields, ...writeFields])];

        // Read-only fields = readable but NOT writable (nonEditable rendering)
        const readOnlySet = new Set<string>();
        if (effectiveAction !== 'read' && !hasWriteWildcard) {
          for (const f of readSet) {
            if (f !== '*' && !writeSet.has(f)) {
              readOnlySet.add(f);
            }
          }
        }

        setAccessibleFields(allAccessible);
        setReadOnlyPermFields(readOnlySet);
        onPermissionsLoaded?.(allAccessible);
      } catch (err) {
        console.error('Error loading permissions:', err);
        // On error, default to showing all fields (fail open for better UX)
        setAccessibleFields(null);
        setReadOnlyPermFields(EMPTY_SET);
      } finally {
        setPermissionsLoading(false);
      }
    };

    loadPermissions();
  }, [collection, effectiveAction, enforcePermissions, daasContext, onPermissionsLoaded]);

  // Get default values from field schemas
  const defaultValues = useMemo(() => {
    return getDefaultValuesFromFields(fields);
  }, [fields]);

  // Merge initial values with current values (needed by applyConditions in the pipeline)
  const allValues = useMemo(() => {
    return {
      ...defaultValues,
      ...stableInitialValues,
      ...stableModelValue,
    };
  }, [defaultValues, stableInitialValues, stableModelValue]);

  // Process fields for display
  // Pipeline: getFormFields → group filter → exclude filter → applyConditions
  //   → pushGroupOptionsDown → permissions filter → updateSystemDivider → updateFieldWidths
  const formFields = useMemo(() => {
    let processed = getFormFields(fields, t);

    // Filter by group if specified
    if (group !== null) {
      processed = processed.filter((f) => {
        const fieldGroup = f.meta?.group ?? null;
        return fieldGroup === group;
      });
    }

    // Exclude specified fields
    if (stableExcludeFields.length > 0) {
      processed = processed.filter((f) => !stableExcludeFields.includes(f.field));
    }

    // Set auto-increment / UUID primary keys readonly when editing
    processed = processed.map((field) => setPrimaryKeyReadonly(field, primaryKey));

    // Apply field conditions (evaluates show/hide/options rules against current values)
    processed = processed.map((field) => applyConditions(allValues, field));

    // Propagate readonly/required from parent groups to children
    processed = pushGroupOptionsDown(processed);

    // Filter by permissions if enforced
    if (enforcePermissions && accessibleFields !== null) {
      // Wildcard means all fields are accessible
      if (!accessibleFields.includes('*')) {
        const accessibleSet = new Set(accessibleFields);
        processed = processed.filter((f) => accessibleSet.has(f.field));
      }
    }

    // Update system divider visibility (always run — hiding is internal to divider logic)
    updateSystemDivider(processed);

    // Update field widths for proper layout
    processed = updateFieldWidths(processed);

    return processed;
  }, [fields, group, stableExcludeFields, enforcePermissions, accessibleFields, allValues, primaryKey, t]);

  // Collect all group field names so we can filter out their children
  const groupFieldNames = useMemo(() => {
    return new Set(formFields.filter(isGroupField).map((f) => f.field));
  }, [formFields]);

  // Get visible fields (excluding hidden fields and children that belong to a group)
  const visibleFields = useMemo(() => {
    return formFields.filter((f) => {
      // Filter out hidden fields
      if (!isFieldVisible(f)) return false;
      // Filter out fields that are children of a group field.
      // These will be rendered inside their group wrapper by FormGroupField,
      // so we must NOT render them again as standalone flat fields.
      if (f.meta?.group && groupFieldNames.has(f.meta.group)) return false;
      // Presentation fields (dividers, notices) are kept for layout
      // They will be rendered but won't store data
      return true;
    });
  }, [formFields, groupFieldNames]);

  // Handle field value change
  const handleFieldChange = useCallback(
    (fieldName: string, value: any) => {
      const field = fields.find((f) => f.field === fieldName);
      if (!field) return;

      // Check if value is same as initial/default (deep comparison for objects/arrays)
      const initialValue = stableInitialValues[fieldName] ?? defaultValues[fieldName];
      if (isDeepEqual(value, initialValue)) {
        // Remove from edits
        const newValues = { ...stableModelValue };
        delete newValues[fieldName];
        onUpdate?.(newValues);
      } else {
        // Add to edits
        onUpdate?.({
          ...stableModelValue,
          [fieldName]: value,
        });
      }
    },
    [fields, stableInitialValues, defaultValues, stableModelValue, onUpdate]
  );

  // Handle field unset (skip if field is disabled/readonly — matches DaaS guard)
  const handleFieldUnset = useCallback(
    (fieldName: string) => {
      // Guard: don't unset disabled/readonly fields
      const field = formFields.find((f) => f.field === fieldName);
      if (field?.meta?.readonly || disabled) return;

      const newValues = { ...stableModelValue };
      delete newValues[fieldName];
      onUpdate?.(newValues);
    },
    [formFields, disabled, stableModelValue, onUpdate]
  );

  // Get validation error for a field
  const getFieldError = useCallback(
    (fieldName: string): ValidationError | undefined => {
      return stableValidationErrors.find(
        (err) =>
          err.field === fieldName ||
          err.field.endsWith(`(${fieldName})`) ||
          (err.collection === collection && err.field === fieldName)
      );
    },
    [stableValidationErrors, collection]
  );

  // The field KEY to autofocus, not an index.
  //
  // An index elected a row that could not accept focus and then dropped it:
  // `!meta.readonly` is far weaker than the rule enforced downstream
  // (`isFieldReadOnly` also covers auto-increment columns, generated UUID keys
  // and generated defaults), it ignored permission-readonly fields, and it
  // counted dividers, notices and group headers. On the commonest schema — an
  // auto-increment `id` first — index 0 won and FormFieldInterface then zeroed
  // the flag, so nothing in the form was focused. Resolving to a key also lets
  // the group branch below forward it to a nested child.
  const autofocusFieldKey = useMemo(() => {
    if (!autofocus) return null;
    const canTakeFocus = (f: (typeof visibleFields)[number]) =>
      !isPresentationField(f as never) &&
      !readOnlyPermFields.has(f.field) &&
      !isFieldReadOnly(f as never, {
        context: isNewItem(primaryKey) ? 'create' : 'edit',
        primaryKey: primaryKey ?? undefined,
      });
    // Group rows are containers; descend so a sectioned form still focuses.
    const flattened = visibleFields.flatMap((f) =>
      isGroupField(f)
        ? formFields.filter((c) => c.meta?.group === f.field)
        : [f],
    );
    return flattened.find(canTakeFocus)?.field ?? null;
  }, [autofocus, visibleFields, formFields, readOnlyPermFields, primaryKey]);

  // Show loading skeleton
  if (loadingFields || loadingProp || permissionsLoading) {
    return (
      <Box className={className} aria-busy="true" aria-label={t.vForm.loading.ariaLabel}>
        <Stack gap="md">
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </Stack>
      </Box>
    );
  }

  // Show error
  if (error) {
    return (
      <Alert icon={<IconInfoCircle size={16} />} color="red" className={className} role="alert">
        {'message' in error ? error.message : t.vForm.error[error.key]}
      </Alert>
    );
  }

  // Show no permissions message
  if (enforcePermissions && accessibleFields !== null && accessibleFields.length === 0) {
    return (
      <Alert icon={<IconLock size={16} />} color="warning" className={className} role="alert">
        <Text size="sm" fw={600}>{t.vForm.noFieldAccess.title}</Text>
        <Text size="sm" c="dimmed" mt="xs">
          {interpolate(t.vForm.noFieldAccess.message, { action: t.vForm.action[effectiveAction] })}
        </Text>
      </Alert>
    );
  }

  // Show no fields message
  if (visibleFields.length === 0) {
    if (!showNoVisibleFields) return null;

    return (
      <Alert icon={<IconInfoCircle size={16} />} color="info" className={className} role="status">
        <Text size="sm" fw={600}>{t.vForm.noVisibleFields.title}</Text>
        <Text size="sm" c="dimmed" mt="xs">
          {collection
            ? interpolate(t.vForm.noVisibleFields.collectionMessage, { collection })
            : t.vForm.noVisibleFields.message}
        </Text>
      </Alert>
    );
  }

  return (
    <Box className={`v-form ${className || ''}`}>
      {/* Validation errors summary banner */}
      {showValidationSummary && stableValidationErrors.length > 0 && (
        <ValidationErrors
          validationErrors={stableValidationErrors}
          fields={fields}
          onScrollToField={onScrollToField}
          translations={translations}
        />
      )}
      <div className="form-grid">
        {visibleFields.map((field) => {
          // Check if this is the first editable field (for autofocus)
          const isFirstEditable = field.field === autofocusFieldKey;

          // Determine if field is nonEditable (prop-level or permission-level)
          const isFieldNonEditable = nonEditable || readOnlyPermFields.has(field.field);

          // Render group fields with their children nested inside
          if (isGroupField(field)) {
            return (
              <FormGroupField
                key={field.field}
                field={field}
                // Forward the autofocus target so a sectioned form still
                // focuses; group rows are containers and can never take it.
                autofocusFieldKey={autofocusFieldKey}
                // Pass the PROCESSED fields (conditions/readonly/width/permission
                // pipeline already applied), not the raw `fields` prop. Group
                // children are re-derived inside FormGroupField via getChildFields;
                // using raw fields there bypasses applyConditions, so condition
                // rules (e.g. "show severity only when issue_type=bug") never take
                // effect for any field placed inside a section/group.
                allFields={formFields}
                values={allValues}
                initialValues={stableInitialValues}
                validationErrors={stableValidationErrors}
                disabled={disabled}
                nonEditable={isFieldNonEditable}
                loading={loadingProp}
                primaryKey={primaryKey}
                onFieldChange={handleFieldChange}
                onFieldUnset={handleFieldUnset}
                getFieldError={getFieldError}
                nonEditableFields={readOnlyPermFields}
                className={field.meta?.width || 'full'}
                locale={locale}
                translations={translations}
              />
            );
          }

          return (
            <FormField
              key={field.field}
              field={field}
              value={allValues[field.field]}
              initialValue={stableInitialValues[field.field]}
              onChange={(value) => handleFieldChange(field.field, value)}
              onUnset={() => handleFieldUnset(field.field)}
              disabled={disabled}
              nonEditable={isFieldNonEditable}
              loading={loadingProp}
              validationError={getFieldError(field.field)}
              primaryKey={primaryKey}
              autofocus={isFirstEditable}
              className={field.meta?.width || 'full'}
              locale={locale}
              translations={translations}
            />
          );
        })}
      </div>
    </Box>
  );
};

export default VForm;
