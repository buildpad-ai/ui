/**
 * `interfaces.selectMultipleCheckbox` — strings of the SelectMultipleCheckbox,
 * SelectMultipleCheckboxTree (`tree`) and SelectMultipleDropdown (`dropdown`)
 * interfaces.
 */
import type { PluralForms } from '../../primitives';

export interface SelectMultipleCheckboxTranslations {
  /** Shown when `choices` is empty */
  misconfigured: string;
  /** aria-label of a choice checkbox: "Select {text}" */
  selectOption: string;
  /** "Show {count} more options" */
  showMore: PluralForms;
  /** aria-label of a checked custom value: "Selected custom value: {value}" */
  selectedCustomValue: string;
  /** aria-label of a custom-value row checkbox: "Custom value checkbox: {value}" */
  customValueCheckbox: string;
  /** `{value}` used in `customValueCheckbox` while the row is still empty */
  emptyValue: string;
  customValuePlaceholder: string;
  /** "Other" — add-custom-value button */
  other: string;
  tree: {
    searchPlaceholder: string;
    clearSearch: string;
    /** aria-label of the tree when no label is given */
    treeLabel: string;
    /** "{label} tree" */
    treeLabelWithLabel: string;
    showAll: string;
    showSelected: string;
    collapse: string;
    expand: string;
  };
  dropdown: {
    nothingFound: string;
    ariaLabel: string;
  };
}

export const selectMultipleCheckboxDefaults: SelectMultipleCheckboxTranslations = {
  misconfigured: 'Choices option configured incorrectly',
  selectOption: 'Select {text}',
  showMore: { one: 'Show {count} more option', other: 'Show {count} more options' },
  selectedCustomValue: 'Selected custom value: {value}',
  customValueCheckbox: 'Custom value checkbox: {value}',
  emptyValue: 'empty',
  customValuePlaceholder: 'Enter custom value',
  other: 'Other',
  tree: {
    searchPlaceholder: 'Search...',
    clearSearch: 'Clear search',
    treeLabel: 'Tree selection',
    treeLabelWithLabel: '{label} tree',
    showAll: 'Show All',
    showSelected: 'Show Selected',
    collapse: 'Collapse',
    expand: 'Expand',
  },
  dropdown: {
    nothingFound: 'No options found',
    ariaLabel: 'Multiple select dropdown',
  },
};

export const selectMultipleCheckboxId: SelectMultipleCheckboxTranslations = {
  misconfigured: 'Opsi choices tidak dikonfigurasi dengan benar',
  selectOption: 'Pilih {text}',
  showMore: { other: 'Tampilkan {count} opsi lagi' },
  selectedCustomValue: 'Nilai kustom terpilih: {value}',
  customValueCheckbox: 'Kotak centang nilai kustom: {value}',
  emptyValue: 'kosong',
  customValuePlaceholder: 'Masukkan nilai kustom',
  other: 'Lainnya',
  tree: {
    searchPlaceholder: 'Cari...',
    clearSearch: 'Bersihkan pencarian',
    treeLabel: 'Pilihan pohon',
    treeLabelWithLabel: 'Pohon {label}',
    showAll: 'Tampilkan Semua',
    showSelected: 'Tampilkan yang Dipilih',
    collapse: 'Ciutkan',
    expand: 'Bentangkan',
  },
  dropdown: {
    nothingFound: 'Tidak ada opsi ditemukan',
    ariaLabel: 'Dropdown pilihan ganda',
  },
};
