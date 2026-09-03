/** `interfaces.listO2M` — strings of the ListO2M (one-to-many) interface and the ListO2MInterface placeholder. */
import type { PluralForms } from '../../primitives';

export interface ListO2MTranslations {
  /** "No items" / "1 item" / "{count} items" — plural with an explicit zero form */
  itemCount: PluralForms;
  searchPlaceholder: string;
  addExisting: string;
  createNew: string;
  noItems: string;
  /** Retry button of the preserve-fetch failure notice */
  retry: string;
  /** aria-label of the header checkbox */
  selectAll: string;
  /** "Select item {id}" — aria-label of a row checkbox */
  selectItem: string;
  /** Rendered for an empty table cell */
  emptyCell: string;
  /** Shown for a boolean `error` prop */
  invalidValue: string;
  /** "Showing {start} to {end} of {total}" */
  showingRange: string;
  perPage: string;
  singletonWarning: string;
  uniqueConstraintNotice: string;
  errors: {
    preserveFailed: string;
    selectFailed: string;
  };
  configError: { title: string; storybookHint: string };
  notConfigured: { title: string; message: string };
  columns: { actions: string };
  /** "Delete {count} selected" / "Unlink {count} selected" — plural */
  batchRemove: { delete: PluralForms; unlink: PluralForms };
  actions: {
    viewItem: string;
    edit: string;
    editItem: string;
    delete: string;
    unlink: string;
    deleteItem: string;
    unlinkItem: string;
  };
  editModal: { createTitle: string; editTitle: string };
  selectModal: {
    title: string;
    errorTitle: string;
    stagedTitle: string;
    stagedMessage: string;
    addSelected: string;
  };
  /** ListO2MInterface — the render-props placeholder component */
  placeholder: {
    title: string;
    requiresRenderProps: string;
    collectionLabel: string;
    fieldLabel: string;
    validationError: string;
    createNew: string;
    loading: string;
    noItems: string;
    /** "Item {id}" */
    itemFallback: string;
  };
}

export const listO2MDefaults: ListO2MTranslations = {
  itemCount: { zero: 'No items', one: '{count} item', other: '{count} items' },
  searchPlaceholder: 'Search...',
  addExisting: 'Add Existing',
  createNew: 'Create New',
  noItems: 'No related items',
  retry: 'Retry',
  selectAll: 'Select all',
  selectItem: 'Select item {id}',
  emptyCell: '-',
  invalidValue: 'Invalid value',
  showingRange: 'Showing {start} to {end} of {total}',
  perPage: 'Items per page:',
  singletonWarning: 'The related collection is a singleton. Only one item can exist.',
  uniqueConstraintNotice: 'This relationship has a unique constraint. Only one related item is allowed.',
  errors: {
    preserveFailed:
      "Couldn't load the currently linked items, so the pending change was not staged for save.",
    selectFailed: 'Failed to select items. Please try again.',
  },
  configError: {
    title: 'Configuration Error',
    storybookHint:
      'Note: In Storybook, relational interfaces require API proxy routes. This component works fully in a Next.js app with DaaS integration.',
  },
  notConfigured: {
    title: 'Relationship not configured',
    message: 'The one-to-many relationship is not properly configured for this field.',
  },
  columns: { actions: 'Actions' },
  batchRemove: {
    delete: { other: 'Delete {count} selected' },
    unlink: { other: 'Unlink {count} selected' },
  },
  actions: {
    viewItem: 'View item',
    edit: 'Edit',
    editItem: 'Edit item',
    delete: 'Delete',
    unlink: 'Unlink',
    deleteItem: 'Delete item',
    unlinkItem: 'Unlink item',
  },
  editModal: { createTitle: 'Create New Item', editTitle: 'Edit Item' },
  selectModal: {
    title: 'Select Existing Items',
    errorTitle: 'Error',
    stagedTitle: 'Items will be linked when you save',
    stagedMessage: 'Selected items will be linked after you save the current item.',
    addSelected: 'Add Selected',
  },
  placeholder: {
    title: 'ListO2M Interface',
    requiresRenderProps: 'requires render props to be provided.',
    collectionLabel: 'Collection:',
    fieldLabel: 'Field:',
    validationError: 'Validation error',
    createNew: 'Create New',
    loading: 'Loading...',
    noItems: 'No items',
    itemFallback: 'Item {id}',
  },
};

export const listO2MId: ListO2MTranslations = {
  itemCount: { zero: 'Tidak ada item', other: '{count} item' },
  searchPlaceholder: 'Cari...',
  addExisting: 'Tambah yang Ada',
  createNew: 'Buat Baru',
  noItems: 'Tidak ada item terkait',
  retry: 'Coba lagi',
  selectAll: 'Pilih semua',
  selectItem: 'Pilih item {id}',
  emptyCell: '-',
  invalidValue: 'Nilai tidak valid',
  showingRange: 'Menampilkan {start} sampai {end} dari {total}',
  perPage: 'Item per halaman:',
  singletonWarning: 'Koleksi terkait adalah singleton. Hanya satu item yang dapat ada.',
  uniqueConstraintNotice: 'Relasi ini memiliki batasan unik. Hanya satu item terkait yang diizinkan.',
  errors: {
    preserveFailed:
      'Tidak dapat memuat item yang saat ini tertaut, sehingga perubahan tertunda tidak disiapkan untuk disimpan.',
    selectFailed: 'Gagal memilih item. Silakan coba lagi.',
  },
  configError: {
    title: 'Kesalahan Konfigurasi',
    storybookHint:
      'Catatan: Di Storybook, antarmuka relasional memerlukan rute proxy API. Komponen ini berfungsi penuh di aplikasi Next.js dengan integrasi DaaS.',
  },
  notConfigured: {
    title: 'Relasi belum dikonfigurasi',
    message: 'Relasi one-to-many untuk kolom ini belum dikonfigurasi dengan benar.',
  },
  columns: { actions: 'Aksi' },
  batchRemove: {
    delete: { other: 'Hapus {count} yang dipilih' },
    unlink: { other: 'Lepas tautan {count} yang dipilih' },
  },
  actions: {
    viewItem: 'Lihat item',
    edit: 'Ubah',
    editItem: 'Ubah item',
    delete: 'Hapus',
    unlink: 'Lepas tautan',
    deleteItem: 'Hapus item',
    unlinkItem: 'Lepas tautan item',
  },
  editModal: { createTitle: 'Buat Item Baru', editTitle: 'Ubah Item' },
  selectModal: {
    title: 'Pilih Item yang Ada',
    errorTitle: 'Kesalahan',
    stagedTitle: 'Item akan ditautkan saat Anda menyimpan',
    stagedMessage: 'Item yang dipilih akan ditautkan setelah Anda menyimpan item saat ini.',
    addSelected: 'Tambahkan yang Dipilih',
  },
  placeholder: {
    title: 'Antarmuka ListO2M',
    requiresRenderProps: 'memerlukan render props.',
    collectionLabel: 'Koleksi:',
    fieldLabel: 'Kolom:',
    validationError: 'Kesalahan validasi',
    createNew: 'Buat Baru',
    loading: 'Memuat...',
    noItems: 'Tidak ada item',
    itemFallback: 'Item {id}',
  },
};
