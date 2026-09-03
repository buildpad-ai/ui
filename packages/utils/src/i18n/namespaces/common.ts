/**
 * `common` namespace — chrome shared by several packages: buttons, states, pagination.
 *
 * One file per namespace so packages can be migrated in parallel without
 * touching a shared dictionary file: the English defaults and the Indonesian
 * catalog live next to the interface they must match.
 */
import type { PluralForms } from '../primitives';

/** Chrome shared by several packages: buttons, states, pagination. */
export interface CommonTranslations {
  loading: string;
  save: string;
  saving: string;
  cancel: string;
  create: string;
  edit: string;
  delete: string;
  deleting: string;
  remove: string;
  close: string;
  confirm: string;
  yes: string;
  no: string;
  ok: string;
  back: string;
  next: string;
  previous: string;
  search: string;
  /** Search input placeholder */
  searchPlaceholder: string;
  clear: string;
  apply: string;
  reset: string;
  refresh: string;
  retry: string;
  select: string;
  selectAll: string;
  deselectAll: string;
  actions: string;
  more: string;
  none: string;
  all: string;
  copy: string;
  copied: string;
  download: string;
  upload: string;
  open: string;
  view: string;
  error: string;
  success: string;
  warning: string;
  required: string;
  optional: string;
  unknown: string;
  /** Generic "something went wrong" body */
  somethingWentWrong: string;
  /** Pagination */
  perPage: string;
  /** "Showing {start} to {end} of {total}" */
  showingRange: string;
  /** "Page {page} of {pages}" */
  pageOf: string;
  /** "{count} items" — plural */
  itemCount: PluralForms;
  /** "{count} selected" — plural */
  selectedCount: PluralForms;
  unsavedChanges: string;
  /** Leave-page guard body */
  unsavedChangesPrompt: string;
  discardChanges: string;
  keepEditing: string;
  /** Delete confirmation */
  confirmDeleteTitle: string;
  /** "Are you sure you want to delete {count} item(s)?" — plural */
  confirmDeleteMessage: PluralForms;
  /** "Not allowed" tooltip for permission-gated actions */
  notAllowed: string;
  noPermission: string;
  /** Word joiner used when composing "Untitled" fallbacks */
  untitled: string;
}

export const commonDefaults: CommonTranslations = {
  loading: 'Loading...',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  deleting: 'Deleting...',
  remove: 'Remove',
  close: 'Close',
  confirm: 'Confirm',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  back: 'Back',
  next: 'Next',
  previous: 'Previous',
  search: 'Search',
  searchPlaceholder: 'Search...',
  clear: 'Clear',
  apply: 'Apply',
  reset: 'Reset',
  refresh: 'Refresh',
  retry: 'Retry',
  select: 'Select',
  selectAll: 'Select all',
  deselectAll: 'Deselect all',
  actions: 'Actions',
  more: 'More',
  none: 'None',
  all: 'All',
  copy: 'Copy',
  copied: 'Copied',
  download: 'Download',
  upload: 'Upload',
  open: 'Open',
  view: 'View',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
  required: 'Required',
  optional: 'Optional',
  unknown: 'Unknown',
  somethingWentWrong: 'Something went wrong',
  perPage: 'Items per page:',
  showingRange: 'Showing {start} to {end} of {total}',
  pageOf: 'Page {page} of {pages}',
  itemCount: { one: '{count} item', other: '{count} items' },
  selectedCount: { one: '{count} selected', other: '{count} selected' },
  unsavedChanges: 'Unsaved changes',
  unsavedChangesPrompt: 'You have unsaved changes. Are you sure you want to leave?',
  discardChanges: 'Discard changes',
  keepEditing: 'Keep editing',
  confirmDeleteTitle: 'Confirm delete',
  confirmDeleteMessage: {
    one: 'Are you sure you want to delete this item? This action cannot be undone.',
    other: 'Are you sure you want to delete {count} items? This action cannot be undone.',
  },
  notAllowed: 'Not allowed',
  noPermission: 'You do not have permission to perform this action',
  untitled: 'Untitled',
};

export const commonId: CommonTranslations = {
  loading: 'Memuat...',
  save: 'Simpan',
  saving: 'Menyimpan...',
  cancel: 'Batal',
  create: 'Buat',
  edit: 'Ubah',
  delete: 'Hapus',
  deleting: 'Menghapus...',
  remove: 'Hapus',
  close: 'Tutup',
  confirm: 'Konfirmasi',
  yes: 'Ya',
  no: 'Tidak',
  ok: 'OK',
  back: 'Kembali',
  next: 'Berikutnya',
  previous: 'Sebelumnya',
  search: 'Cari',
  searchPlaceholder: 'Cari...',
  clear: 'Bersihkan',
  apply: 'Terapkan',
  reset: 'Atur ulang',
  refresh: 'Muat ulang',
  retry: 'Coba lagi',
  select: 'Pilih',
  selectAll: 'Pilih semua',
  deselectAll: 'Batalkan semua pilihan',
  actions: 'Aksi',
  more: 'Lainnya',
  none: 'Tidak ada',
  all: 'Semua',
  copy: 'Salin',
  copied: 'Tersalin',
  download: 'Unduh',
  upload: 'Unggah',
  open: 'Buka',
  view: 'Lihat',
  error: 'Kesalahan',
  success: 'Berhasil',
  warning: 'Peringatan',
  required: 'Wajib diisi',
  optional: 'Opsional',
  unknown: 'Tidak diketahui',
  somethingWentWrong: 'Terjadi kesalahan',
  perPage: 'Item per halaman:',
  showingRange: 'Menampilkan {start} sampai {end} dari {total}',
  pageOf: 'Halaman {page} dari {pages}',
  itemCount: { other: '{count} item' },
  selectedCount: { other: '{count} dipilih' },
  unsavedChanges: 'Perubahan belum disimpan',
  unsavedChangesPrompt: 'Ada perubahan yang belum disimpan. Yakin ingin keluar?',
  discardChanges: 'Buang perubahan',
  keepEditing: 'Lanjutkan mengedit',
  confirmDeleteTitle: 'Konfirmasi hapus',
  confirmDeleteMessage: {
    other: 'Yakin ingin menghapus {count} item? Tindakan ini tidak dapat dibatalkan.',
  },
  notAllowed: 'Tidak diizinkan',
  noPermission: 'Anda tidak memiliki izin untuk melakukan tindakan ini',
  untitled: 'Tanpa judul',
};
