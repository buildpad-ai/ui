/**
 * `form` namespace — ui-form (VForm, FormField, FormFieldInterface,
 * FormFieldLabel, InterfaceErrorBoundary, ValidationErrors).
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
  /** VForm chrome: loading, load errors, permission and empty states */
  vForm: {
    loading: {
      /** aria-label of the skeleton shown while fields or permissions load */
      ariaLabel: string;
    };
    error: {
      /** Neither `collection` nor `fields` was passed (rendered in the error alert) */
      missingCollectionOrFields: string;
      /** The field schema request failed without an error message */
      loadFieldsFailed: string;
    };
    noFieldAccess: {
      title: string;
      /** "You don't have permission to {action} fields in this collection." — {action} is one of `vForm.action` */
      message: string;
    };
    /** Verb slotted into `noFieldAccess.message` for each FormAction */
    action: {
      create: string;
      read: string;
      update: string;
    };
    noVisibleFields: {
      title: string;
      /** Body when no collection name is known */
      message: string;
      /** 'Collection "{collection}" has no visible fields' */
      collectionMessage: string;
    };
  };
  fieldLabel: {
    /** Marker rendered after the label of a required field */
    requiredIndicator: string;
  };
  validation: FormValidationTranslations;
  /** ValidationErrors summary banner */
  errors: {
    /** "{count} validation error(s)" — plural */
    summary: PluralForms;
    /** Glyph rendered before each error row */
    bullet: string;
    /** "— {message}" — separator between the field name and its message */
    messageFormat: string;
    /** Appended to an error for a hidden field */
    hidden: string;
    /** "(hidden in group: {group})" */
    hiddenInGroup: string;
  };
  fieldInterface: {
    componentNotFound: {
      /** "Interface component not found: {interfaceType}" — {interfaceType} is rendered in bold */
      title: string;
      /** "Field: {field} (Type: {type})" */
      detail: string;
    };
  };
  interfaceErrorBoundary: {
    /** "Unexpected error in interface {interfaceName}" — {interfaceName} is rendered in bold */
    title: string;
    /** Slotted into `title` when the interface name is unknown */
    unknownInterface: string;
  };
  systemDivider: {
    /** Name of the synthetic divider between system and user fields */
    name: string;
  };
}

export const formDefaults: FormTranslations = {
  vForm: {
    loading: {
      ariaLabel: 'Loading form',
    },
    error: {
      missingCollectionOrFields: 'Either collection or fields prop must be provided',
      loadFieldsFailed: 'Failed to load fields',
    },
    noFieldAccess: {
      title: 'No field access',
      message: "You don't have permission to {action} fields in this collection.",
    },
    action: {
      create: 'create',
      read: 'read',
      update: 'update',
    },
    noVisibleFields: {
      title: 'No visible fields',
      message: 'No fields to display',
      collectionMessage: 'Collection "{collection}" has no visible fields',
    },
  },
  fieldLabel: {
    requiredIndicator: '*',
  },
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
    bullet: '•',
    messageFormat: '— {message}',
    hidden: '(hidden)',
    hiddenInGroup: '(hidden in group: {group})',
  },
  fieldInterface: {
    componentNotFound: {
      title: 'Interface component not found: {interfaceType}',
      detail: 'Field: {field} (Type: {type})',
    },
  },
  interfaceErrorBoundary: {
    title: 'Unexpected error in interface {interfaceName}',
    unknownInterface: 'unknown',
  },
  systemDivider: {
    name: 'System Divider',
  },
};

export const formId: FormTranslations = {
  vForm: {
    loading: {
      ariaLabel: 'Memuat formulir',
    },
    error: {
      missingCollectionOrFields: 'Salah satu prop collection atau fields harus diberikan',
      loadFieldsFailed: 'Gagal memuat kolom',
    },
    noFieldAccess: {
      title: 'Tidak ada akses kolom',
      message: 'Anda tidak memiliki izin untuk {action} kolom di koleksi ini.',
    },
    action: {
      create: 'membuat',
      read: 'membaca',
      update: 'mengubah',
    },
    noVisibleFields: {
      title: 'Tidak ada kolom yang terlihat',
      message: 'Tidak ada kolom untuk ditampilkan',
      collectionMessage: 'Koleksi "{collection}" tidak memiliki kolom yang terlihat',
    },
  },
  fieldLabel: {
    requiredIndicator: '*',
  },
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
    bullet: '•',
    messageFormat: '— {message}',
    hidden: '(tersembunyi)',
    hiddenInGroup: '(tersembunyi dalam grup: {group})',
  },
  fieldInterface: {
    componentNotFound: {
      title: 'Komponen antarmuka tidak ditemukan: {interfaceType}',
      detail: 'Kolom: {field} (Tipe: {type})',
    },
  },
  interfaceErrorBoundary: {
    title: 'Kesalahan tak terduga pada antarmuka {interfaceName}',
    unknownInterface: 'tidak diketahui',
  },
  systemDivider: {
    name: 'Pembatas Sistem',
  },
};
