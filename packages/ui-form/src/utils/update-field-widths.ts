/**
 * Update field widths based on visibility and layout rules
 * Ported from DaaS v-form update-field-widths utility
 *
 * Key differences from the old implementation:
 * - Keeps ALL fields (including hidden), only applies width logic to visible ones
 * - Sets 'half-right' on the second consecutive half-width field in the same group
 * - 'fill' resolves to 'half' or 'full' depending on row position
 * - Does NOT force the last half-width field to full
 */

import type { FormField, FieldWidth } from '../types';
import { isFieldVisible } from './get-form-fields';

/**
 * Update field widths to ensure proper grid layout.
 * Returns a new array with cloned fields where widths have been adjusted.
 */
export function updateFieldWidths(fields: FormField[]): FormField[] {
  // Clone so we never mutate the source array
  const result: FormField[] = fields.map((f) => ({
    ...f,
    meta: f.meta ? { ...f.meta } : undefined,
  }));

  // Track row state per group to handle half-left / half-right pairing
  // key = group name ('' for root), value = whether the previous visible field was half
  const prevHalfInGroup: Record<string, boolean> = {};

  for (const field of result) {
    // Only apply width logic to visible fields; hidden fields keep their width as-is
    if (!isFieldVisible(field)) continue;
    if (!field.meta) continue;

    const group = field.meta.group ?? '';
    let width: FieldWidth = (field.meta.width as FieldWidth) || 'full';

    // 'fill' always resolves to half (takes half the row); if the previous
    // field in the group was half, the two will pair up naturally. DaaS
    // resolves fill to half.
    if (width === 'fill') {
      width = 'half';
    }

    if (width === 'half' || width === 'half-left' || width === 'half-right') {
      if (prevHalfInGroup[group]) {
        // This is the second consecutive half in this group → force half-right
        field.meta.width = 'half-right';
        prevHalfInGroup[group] = false; // row complete
      } else {
        // First half in a pair → half-left
        field.meta.width = width === 'half-right' ? 'half-right' : 'half';
        prevHalfInGroup[group] = true;
      }
    } else {
      // full-width field resets the row
      field.meta.width = width;
      prevHalfInGroup[group] = false;
    }
  }

  return result;
}

/**
 * Get CSS class for field width
 */
export function getFieldWidthClass(width: FieldWidth | undefined): string {
  switch (width) {
    case 'half':
    case 'half-left':
      return 'field-width-half';
    case 'half-right':
      return 'field-width-half-right';
    case 'fill':
      return 'field-width-fill';
    case 'full':
    default:
      return 'field-width-full';
  }
}
