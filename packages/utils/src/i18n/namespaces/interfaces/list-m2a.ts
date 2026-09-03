/** `interfaces.listM2A` — strings of the ListM2A (many-to-any) interface and its JunctionItemForm. */
import type { PluralForms } from '../../primitives';

export interface ListM2ATranslations {
  /** aria-label of the drag handle */
  reorderItem: string;
  /** Collection badge when the item's collection cannot be resolved */
  unknownCollection: string;
  searchPlaceholder: string;
  /** "{count} items" — plural */
  itemCount: PluralForms;
  addExisting: string;
  createNew: string;
  /** Tooltip of the disabled "Create New" button while the parent is unsaved */
  saveFirstHint: string;
  unsavedChanges: string;
  dragDisabledPaginated: string;
  noItems: string;
  invalidItem: string;
  /** Shown for a boolean `error` prop */
  invalidValue: string;
  /** "{prefix}:" — collection prefix before the item in list layout */
  prefixFormat: string;
  /** "Showing {start} to {end} of {total}" */
  showingRange: string;
  perPage: string;
  configError: { title: string };
  noCollections: { title: string; message: string };
  notConfigured: { title: string; message: string };
  columns: { collection: string; item: string; actions: string };
  badges: { new: string; edited: string; removed: string };
  actions: { viewItem: string; edit: string; undoRemove: string; remove: string };
  editModal: {
    /** "Create New {collection}" */
    createTitle: string;
    /** "Edit {collection}" */
    editTitle: string;
  };
  selectModal: {
    /** "Select from {collection}" */
    title: string;
    errorTitle: string;
    stagedTitle: string;
    stagedMessage: string;
    addSelected: string;
  };
  junctionForm: {
    newItem: string;
    /** "Editing item {id}" */
    editingItem: string;
    /** "No editable fields found for {collection}" */
    noEditableFields: string;
    junctionSettings: string;
    cancel: string;
    addItem: string;
    updateItem: string;
    errors: { title: string; loadFields: string };
  };
}

export const listM2ADefaults: ListM2ATranslations = {
  reorderItem: 'Reorder item',
  unknownCollection: 'Unknown',
  searchPlaceholder: 'Search...',
  itemCount: { one: '{count} item', other: '{count} items' },
  addExisting: 'Add Existing',
  createNew: 'Create New',
  saveFirstHint: 'Save the item first before creating related items',
  unsavedChanges: 'You have unsaved changes. Save the parent item to persist them.',
  dragDisabledPaginated:
    'Drag & drop sorting is disabled when items are paginated. Reduce items or increase page size to enable.',
  noItems: 'No items',
  invalidItem: 'Invalid item',
  invalidValue: 'Invalid value',
  prefixFormat: '{prefix}:',
  showingRange: 'Showing {start} to {end} of {total}',
  perPage: 'Items per page:',
  configError: { title: 'Configuration Error' },
  noCollections: {
    title: 'No available collections',
    message: 'No non-singleton collections are configured for this M2A relationship.',
  },
  notConfigured: {
    title: 'Relationship not configured',
    message: 'The many-to-any relationship is not properly configured for this field.',
  },
  columns: { collection: 'Collection', item: 'Item', actions: 'Actions' },
  badges: { new: 'new', edited: 'edited', removed: 'removed' },
  actions: { viewItem: 'View item', edit: 'Edit', undoRemove: 'Undo remove', remove: 'Remove' },
  editModal: {
    createTitle: 'Create New {collection}',
    editTitle: 'Edit {collection}',
  },
  selectModal: {
    title: 'Select from {collection}',
    errorTitle: 'Error',
    stagedTitle: 'Items will be linked when you save',
    stagedMessage: 'Selected items will be staged locally and saved when you save the parent item.',
    addSelected: 'Add Selected',
  },
  junctionForm: {
    newItem: 'New item',
    editingItem: 'Editing item {id}',
    noEditableFields: 'No editable fields found for {collection}',
    junctionSettings: 'Junction settings',
    cancel: 'Cancel',
    addItem: 'Add Item',
    updateItem: 'Update Item',
    errors: { title: 'Error loading fields', loadFields: 'Failed to load fields' },
  },
};

export const listM2AId: ListM2ATranslations = {
  reorderItem: 'Urutkan ulang item',
  unknownCollection: 'Tidak diketahui',
  searchPlaceholder: 'Cari...',
  itemCount: { other: '{count} item' },
  addExisting: 'Tambah yang Ada',
  createNew: 'Buat Baru',
  saveFirstHint: 'Simpan item terlebih dahulu sebelum membuat item terkait',
  unsavedChanges: 'Ada perubahan yang belum disimpan. Simpan item induk untuk menyimpannya.',
  dragDisabledPaginated:
    'Pengurutan seret & lepas dinonaktifkan saat item dipaginasi. Kurangi item atau perbesar ukuran halaman untuk mengaktifkannya.',
  noItems: 'Tidak ada item',
  invalidItem: 'Item tidak valid',
  invalidValue: 'Nilai tidak valid',
  prefixFormat: '{prefix}:',
  showingRange: 'Menampilkan {start} sampai {end} dari {total}',
  perPage: 'Item per halaman:',
  configError: { title: 'Kesalahan Konfigurasi' },
  noCollections: {
    title: 'Tidak ada koleksi tersedia',
    message: 'Tidak ada koleksi non-singleton yang dikonfigurasi untuk relasi M2A ini.',
  },
  notConfigured: {
    title: 'Relasi belum dikonfigurasi',
    message: 'Relasi many-to-any untuk kolom ini belum dikonfigurasi dengan benar.',
  },
  columns: { collection: 'Koleksi', item: 'Item', actions: 'Aksi' },
  badges: { new: 'baru', edited: 'diubah', removed: 'dihapus' },
  actions: { viewItem: 'Lihat item', edit: 'Ubah', undoRemove: 'Batalkan penghapusan', remove: 'Hapus' },
  editModal: {
    createTitle: 'Buat {collection} Baru',
    editTitle: 'Ubah {collection}',
  },
  selectModal: {
    title: 'Pilih dari {collection}',
    errorTitle: 'Kesalahan',
    stagedTitle: 'Item akan ditautkan saat Anda menyimpan',
    stagedMessage:
      'Item yang dipilih akan disimpan sementara secara lokal dan disimpan saat Anda menyimpan item induk.',
    addSelected: 'Tambahkan yang Dipilih',
  },
  junctionForm: {
    newItem: 'Item baru',
    editingItem: 'Mengubah item {id}',
    noEditableFields: 'Tidak ada kolom yang dapat diubah untuk {collection}',
    junctionSettings: 'Pengaturan junction',
    cancel: 'Batal',
    addItem: 'Tambah Item',
    updateItem: 'Perbarui Item',
    errors: { title: 'Kesalahan saat memuat kolom', loadFields: 'Gagal memuat kolom' },
  },
};
