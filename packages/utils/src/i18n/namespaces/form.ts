/**
 * `form` namespace — ui-form (VForm, FormField, ValidationErrors).
 *
 * One file per namespace so packages can be migrated in parallel without
 * touching a shared dictionary file: the English defaults and the Indonesian
 * catalog live next to the interface they must match.
 */
import type { PluralForms } from '../primitives';

export interface FormValidationTranslations {
  required: string;
  unique: string;
  email: string;
  url: string;
  number: string;
  failed: string;
  /** "Validation error: {type}" */
  generic: string;
}

export interface FormTranslations {
  validation: FormValidationTranslations;
  errors: {
    /** "{count} validation error(s)" — plural */
    summary: PluralForms;
    /** Appended to an error for a hidden field */
    hidden: string;
    /** "(hidden in group: {group})" */
    hiddenInGroup: string;
  };
}

export const formDefaults: FormTranslations = {
  validation: {
    required: 'This field is required',
    unique: 'This value must be unique',
    email: 'Must be a valid email address',
    url: 'Must be a valid URL',
    number: 'Must be a valid number',
    failed: 'Validation failed',
    generic: 'Validation error: {type}',
  },
  errors: {
    summary: { one: '{count} validation error', other: '{count} validation errors' },
    hidden: '(hidden)',
    hiddenInGroup: '(hidden in group: {group})',
  },
};

export const formId: FormTranslations = {
  validation: {
    required: 'Kolom ini wajib diisi',
    unique: 'Nilai ini harus unik',
    email: 'Harus berupa alamat email yang valid',
    url: 'Harus berupa URL yang valid',
    number: 'Harus berupa angka yang valid',
    failed: 'Validasi gagal',
    generic: 'Kesalahan validasi: {type}',
  },
  errors: {
    summary: { other: '{count} kesalahan validasi' },
    hidden: '(tersembunyi)',
    hiddenInGroup: '(tersembunyi dalam grup: {group})',
  },
};
