/** `interfaces.selectRadio` — strings of the SelectRadio interface. */
export interface SelectRadioTranslations {
  /** Shown when `choices` is empty */
  misconfigured: string;
  /** Label of the "Other" radio (custom value) */
  other: string;
  customValuePlaceholder: string;
}

export const selectRadioDefaults: SelectRadioTranslations = {
  misconfigured: 'Choices option configured incorrectly',
  other: 'Other',
  customValuePlaceholder: 'Enter custom value',
};

export const selectRadioId: SelectRadioTranslations = {
  misconfigured: 'Opsi choices tidak dikonfigurasi dengan benar',
  other: 'Lainnya',
  customValuePlaceholder: 'Masukkan nilai kustom',
};
