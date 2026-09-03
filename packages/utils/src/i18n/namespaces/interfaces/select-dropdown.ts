/** `interfaces.selectDropdown` — strings of the SelectDropdown interface. */
export interface SelectDropdownTranslations {
  /** Default placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  /** Shown when `choices` is empty and custom values are not allowed */
  misconfigured: string;
  /** Mantine `nothingFoundMessage` while searching */
  nothingFound: string;
}

export const selectDropdownDefaults: SelectDropdownTranslations = {
  placeholder: 'Select an option',
  misconfigured: 'Choices option configured incorrectly',
  nothingFound: 'No options found',
};

export const selectDropdownId: SelectDropdownTranslations = {
  placeholder: 'Pilih salah satu opsi',
  misconfigured: 'Opsi choices tidak dikonfigurasi dengan benar',
  nothingFound: 'Tidak ada opsi ditemukan',
};
