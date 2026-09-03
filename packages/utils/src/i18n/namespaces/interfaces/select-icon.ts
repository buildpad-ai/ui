/** `interfaces.selectIcon` — strings of the SelectIcon interface. */
import type { PluralForms } from '../../primitives';

export interface SelectIconTranslations {
  /** Default trigger placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  /** aria-label of the trigger when no visible label is rendered */
  triggerAriaLabel: string;
  searchPlaceholder: string;
  /** 'No icons found for "{search}"' */
  noIconsFound: string;
  /** "{count} icons" footer */
  iconCount: PluralForms;
  /** "{count} icons found" footer while searching */
  iconCountFound: PluralForms;
  /** Title of the clear button */
  clearSelection: string;
  /** Category headings of the icon grid (Material Design categories) */
  category: {
    action: string;
    alert: string;
    communication: string;
    content: string;
    device: string;
    editor: string;
    file: string;
    image: string;
    maps: string;
    navigation: string;
    notification: string;
    social: string;
    toggle: string;
    securityIdentity: string;
  };
}

export const selectIconDefaults: SelectIconTranslations = {
  placeholder: 'Search for an icon...',
  triggerAriaLabel: 'Select an icon',
  searchPlaceholder: 'Search icons...',
  noIconsFound: 'No icons found for "{search}"',
  iconCount: { one: '{count} icon', other: '{count} icons' },
  iconCountFound: { one: '{count} icon found', other: '{count} icons found' },
  clearSelection: 'Clear selection',
  category: {
    action: 'Action',
    alert: 'Alert',
    communication: 'Communication',
    content: 'Content',
    device: 'Device',
    editor: 'Editor',
    file: 'File',
    image: 'Image',
    maps: 'Maps',
    navigation: 'Navigation',
    notification: 'Notification',
    social: 'Social',
    toggle: 'Toggle',
    securityIdentity: 'Security & Identity',
  },
};

export const selectIconId: SelectIconTranslations = {
  placeholder: 'Cari ikon...',
  triggerAriaLabel: 'Pilih ikon',
  searchPlaceholder: 'Cari ikon...',
  noIconsFound: 'Tidak ada ikon ditemukan untuk "{search}"',
  iconCount: { other: '{count} ikon' },
  iconCountFound: { other: '{count} ikon ditemukan' },
  clearSelection: 'Bersihkan pilihan',
  category: {
    action: 'Aksi',
    alert: 'Peringatan',
    communication: 'Komunikasi',
    content: 'Konten',
    device: 'Perangkat',
    editor: 'Penyunting',
    file: 'Berkas',
    image: 'Gambar',
    maps: 'Peta',
    navigation: 'Navigasi',
    notification: 'Notifikasi',
    social: 'Sosial',
    toggle: 'Sakelar',
    securityIdentity: 'Keamanan & Identitas',
  },
};
