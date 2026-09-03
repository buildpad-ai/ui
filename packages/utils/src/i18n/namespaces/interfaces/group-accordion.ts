/** `interfaces.groupAccordion` — strings of the GroupAccordion interface. */
export interface GroupAccordionTranslations {
  /** Tooltip of the "edited" dot on a collapsed section */
  edited: string;
  emptySection: string;
  validation: {
    /** "{field} must be unique" */
    unique: string;
    /** "{field} {type}" — generic validation message; `{type}` is the lower-cased error type */
    generic: string;
    /** `{type}` used when the error carries no type */
    fallbackType: string;
  };
}

export const groupAccordionDefaults: GroupAccordionTranslations = {
  edited: 'Edited',
  emptySection: 'No content for this section',
  validation: {
    unique: '{field} must be unique',
    generic: '{field} {type}',
    fallbackType: 'error',
  },
};

export const groupAccordionId: GroupAccordionTranslations = {
  edited: 'Diubah',
  emptySection: 'Tidak ada konten untuk bagian ini',
  validation: {
    unique: '{field} harus unik',
    generic: '{field} {type}',
    fallbackType: 'kesalahan',
  },
};
