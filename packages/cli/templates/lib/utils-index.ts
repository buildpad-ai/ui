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

// Provisionable interface catalog (type-aware picker for the form builder)
export {
  PROVISIONABLE_INTERFACES,
  provisionableInterfacesForType,
  CHOICE_INTERFACES,
  interfaceRequiresChoices,
  type ProvisionableInterface,
  type ProvisionableInterfaceGroup,
} from '../interface-catalog';

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
