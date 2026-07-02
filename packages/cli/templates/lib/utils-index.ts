// @ts-nocheck
/**
 * Buildpad Utils
 * 
 * Re-exports all utility functions.
 * This file is copied to your project and can be customized.
 */

// Basic utilities
export { cn, formatFileSize, getFileCategory, getAssetUrl, slugify, slugify as generateSlug, debounce, isValidPrimaryKey, deepMerge, generateId } from '../common-utils';

// New item detection
export { isNewItem, isExistingItem } from '../is-new-item';

// Form definition overlay merge (drives the dynamic form builder runtime)
export { buildFieldsFromDefinition } from '../build-fields-from-definition';

// Field/Collection provisioning spec → DaaS payload mapper (DDL)
export {
  fieldSpecToDaaSField,
  dataTypeForFieldType,
  interfaceForFieldType,
  type DaaSFieldPayload,
} from '../field-spec-mapper';

// Field interface mapping (from @buildpad/utils)
export { 
  getFieldInterface,
  getFieldDefault,
  getFieldDisplayName,
  formatFieldTitle,
  type InterfaceType,
  type InterfaceConfig,
} from '../field-interface-mapper';

// Field utilities
export {
  isFieldReadOnly,
  isPresentationField,
  getFieldValidation,
  formatFieldValue,
} from '../field-interface-mapper';

// Interface type definitions
export type {
  InterfaceDefinition,
  InterfaceGroup,
} from '../interface-types';
