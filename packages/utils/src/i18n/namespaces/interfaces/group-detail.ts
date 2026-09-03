/** `interfaces.groupDetail` — strings of the GroupDetail interface. */
export interface GroupDetailTranslations {
  /** Tooltip of the "edited" dot on a collapsed group */
  edited: string;
  loading: string;
  empty: string;
  validation: {
    /** "{field} must be unique" */
    unique: string;
    /** "{field} {type}" — generic validation message; `{type}` is the lower-cased error type */
    generic: string;
    /** `{type}` used when the error carries no type */
    fallbackType: string;
  };
}

export const groupDetailDefaults: GroupDetailTranslations = {
  edited: 'Edited',
  loading: 'Loading...',
  empty: 'No content available',
  validation: {
    unique: '{field} must be unique',
    generic: '{field} {type}',
    fallbackType: 'error',
  },
};

export const groupDetailId: GroupDetailTranslations = {
  edited: 'Diubah',
  loading: 'Memuat...',
  empty: 'Tidak ada konten tersedia',
  validation: {
    unique: '{field} harus unik',
    generic: '{field} {type}',
    fallbackType: 'kesalahan',
  },
};
