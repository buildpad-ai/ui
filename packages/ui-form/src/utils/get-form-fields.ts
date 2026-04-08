/**
 * Process and sort fields for form display
 * Based on DaaS get-form-fields utility
 */

import type { Field } from '@buildpad/types';
import { getFieldDisplayName } from '@buildpad/utils';
import type { FormField } from '../types';

/**
 * Extended field meta that may contain additional properties
 */
interface ExtendedFieldMeta {
  name?: string;
  system?: boolean;
  [key: string]: unknown;
}

/**
 * Process fields into display-ready format
 * - Separates system fields from user fields
 * - Sorts fields by group, sort order, and id
 * - Adds system divider between system and user fields
 * - Filters out fake system fields (starting with $)
 */
export function getFormFields(fields: Field[]): FormField[] {
  const systemFields: FormField[] = [];
  const userFields: FormField[] = [];

  // Clone and sort fields
  const clonedFields = [...fields];
  const sortedFields = clonedFields.sort((a, b) => {
    // Sort by group (descending - nulls first)
    const groupA = a.meta?.group ?? '';
    const groupB = b.meta?.group ?? '';
    if (groupA !== groupB) {
      if (!groupA) return -1;
      if (!groupB) return 1;
      return groupB.localeCompare(groupA);
    }

    // Then by sort order (ascending, null sorts to end)
    const sortA = a.meta?.sort;
    const sortB = b.meta?.sort;
    if (sortA !== sortB) {
      if (sortA == null) return 1;
      if (sortB == null) return -1;
      return sortA - sortB;
    }

    // Finally by meta.id ascending (DaaS parity — stable insertion order)
    const idA = (a.meta as any)?.id ?? 0;
    const idB = (b.meta as any)?.id ?? 0;
    return idA - idB;
  });

  // Separate system from user fields
  for (const field of sortedFields) {
    // Skip fake system fields (virtual fields starting with $)
    if (field.field?.startsWith('$')) {
      continue;
    }

    const meta = field.meta as (ExtendedFieldMeta & typeof field.meta);
    const formField: FormField = {
      ...field,
      name: meta?.name ?? getFieldDisplayName(field),
    };

    // Categorize as system or user field
    if (meta?.system) {
      systemFields.push(formField);
    } else {
      userFields.push(formField);
    }
  }

  // Build result with optional system divider
  const result: FormField[] = [];

  if (systemFields.length > 0) {
    result.push(...systemFields);

    // Add divider between system and user fields
    if (userFields.length > 0) {
      // NOTE: Using 'system-divider' instead of '$system_divider' to avoid PostCSS variable conflicts
      const divider: FormField = {
        collection: '',
        field: 'system-divider',
        name: 'System Divider',
        type: 'alias',
        schema: undefined,
        meta: {
          id: -1,
          collection: '',
          field: 'system-divider',
          interface: 'presentation-divider',
          group: null,
          special: ['alias'],
          hidden: false,
          readonly: false,
          required: false,
          options: null,
          display: null,
          display_options: null,
          sort: null,
          width: 'full',
          translations: null,
          note: null,
          conditions: null,
          validation: null,
          validation_message: null,
        },
        hideLabel: true,
        hideLoader: true,
      };
      result.push(divider);
    }
  }

  if (userFields.length > 0) {
    result.push(...userFields);
  }

  return result;
}

/**
 * Check if a field should be visible
 */
export function isFieldVisible(field: Field | FormField): boolean {
  return field.meta?.hidden !== true;
}

/**
 * Check if a field is a group field
 */
export function isGroupField(field: Field | FormField): boolean {
  return field.meta?.special?.includes('group') === true;
}

/**
 * Get fields that belong to a specific group
 */
export function getFieldsInGroup(
  fields: FormField[],
  groupName: string | null,
  processed: Set<string> = new Set()
): FormField[] {
  const result: FormField[] = [];

  for (const field of fields) {
    const fieldGroup = field.meta?.group ?? null;

    // Check if field belongs to this group
    if (fieldGroup === groupName) {
      result.push(field);

      // If this field is itself a group, recursively get its children
      if (isGroupField(field) && !processed.has(field.field)) {
        processed.add(field.field);
        const childFields = getFieldsInGroup(fields, field.field, processed);
        result.push(...childFields);
      }
    }
  }

  return result;
}
