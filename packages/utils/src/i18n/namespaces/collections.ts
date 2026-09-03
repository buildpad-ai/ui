/**
 * `collections` namespace — ui-collections (CollectionList, CollectionForm,
 * ContentNavigation, FilterPanel, SaveOptions, BulkActionsBar, …).
 *
 * One file per namespace so packages can be migrated in parallel without
 * touching a shared dictionary file: the English defaults and the Indonesian
 * catalog live next to the interface they must match (the parity test in
 * `utils/tests/i18n.test.ts` enforces it).
 *
 * Keys are grouped by component. Strings that are technical tokens rather than
 * prose (`JSON`, `+{count}`, `YYYY-MM-DD`, `Ctrl`) are still keyed so a locale
 * can adapt them, and are intentionally identical in the Indonesian catalog.
 */
import type { PluralForms } from '../primitives';

/** CollectionList — header context menu (right-click on a column). */
export interface CollectionListHeaderMenuTranslations {
  sort: string;
  sortAscending: string;
  sortDescending: string;
  alignment: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  hideField: string;
}

/** CollectionList — footer / pagination item count. */
export interface CollectionListItemCountTranslations {
  loading: string;
  none: string;
  /** "{count} items" — plural */
  singlePage: PluralForms;
  /** "{from}–{to} of {count} items" — plural (always more than one page, so `other` suffices) */
  range: PluralForms;
  /** "{count} items (filtered from {total})" — plural */
  filteredSinglePage: PluralForms;
  /** "{from}–{to} of {count} items (filtered from {total})" — plural */
  filteredRange: PluralForms;
}

/** CollectionList strings. */
export interface CollectionListTranslations {
  errors: {
    /** 'No visible fields found for collection "{collection}". …' */
    noVisibleFields: string;
    loadFieldsFailed: string;
    loadItemsFailed: string;
    deleteFailed: string;
  };
  headerMenu: CollectionListHeaderMenuTranslations;
  addField: {
    /** ActionIcon title + Menu.Label */
    label: string;
  };
  cell: {
    /** aria-label of the boolean "true" icon */
    booleanTrue: string;
    /** aria-label of the boolean "false" icon */
    booleanFalse: string;
    /** Badge shown for json columns */
    jsonBadge: string;
    /** "+{count}" — overflow of a multi-choice cell */
    moreChoices: string;
    /** "{value}…" — truncated uuid / key */
    truncated: string;
  };
  itemCount: CollectionListItemCountTranslations;
  /** The inline filter panel header inside CollectionList */
  filterPanel: {
    title: string;
    clearAll: string;
  };
  table: {
    loading: string;
    noItems: string;
    noResultsFiltered: string;
  };
}

/** CollectionListToolbar strings. */
export interface CollectionListToolbarTranslations {
  searchPlaceholder: string;
  clearSearch: string;
  showFilters: string;
  hideFilters: string;
  toggleFilterPanel: string;
  archive: {
    all: string;
    active: string;
    archived: string;
  };
  refresh: string;
  createItem: string;
  createItemNotAllowed: string;
}

/** BulkActionsBar strings. */
export interface BulkActionsTranslations {
  /** "{count} selected" — plural */
  selectedCount: PluralForms;
  deleteSelectedTooltip: string;
  delete: string;
  clearSelection: string;
}

/** DeleteConfirmModal strings (bulk delete from CollectionList). */
export interface DeleteConfirmTranslations {
  title: string;
  /** "Are you sure you want to delete {count} item(s)? …" — plural */
  message: PluralForms;
  cancel: string;
  confirm: string;
}

/** CollectionForm strings (plus the extras-storage helper message). */
export interface CollectionFormTranslations {
  actions: {
    create: string;
    save: string;
    cancel: string;
    delete: string;
  };
  success: {
    created: string;
    updated: string;
    previewOnly: string;
  };
  errors: {
    loadFailed: string;
    saveFailed: string;
    deleteFailed: string;
    validationFailed: string;
    /** Fallback per-field message when the backend error carries none */
    fieldValidationFallback: string;
    /** 'Cannot update junction row in "{junctionCollection}": staged entry has no "{junctionPrimaryKeyField}" value.' */
    junctionUpdateMissingKey: string;
    /** 'This screen has "extras" fields, but the "{collection}" collection has no "{extrasColumn}" (json) column …' */
    missingExtrasColumn: string;
  };
  emptyState: {
    /** "You don't have permission to create items in {collection}" */
    noPermissionCreate: string;
    /** "You don't have permission to edit items in {collection}" */
    noPermissionEdit: string;
    /** "No editable fields found for {collection}" */
    noEditableFields: string;
  };
  deleteConfirm: {
    title: string;
    message: string;
    cancel: string;
    confirm: string;
  };
}

/** FilterPanel — operator labels per field type. */
export interface FilterOperatorTranslations {
  equals: string;
  notEquals: string;
  contains: string;
  doesNotContain: string;
  startsWith: string;
  endsWith: string;
  isEmpty: string;
  isNotEmpty: string;
  isNull: string;
  isNotNull: string;
  greaterThan: string;
  greaterOrEqual: string;
  lessThan: string;
  lessOrEqual: string;
  after: string;
  onOrAfter: string;
  before: string;
  onOrBefore: string;
}

/** FilterPanel strings. */
export interface FilterPanelTranslations {
  title: string;
  /** "{count} active" — plural */
  activeCount: PluralForms;
  clearAll: string;
  clearAllFilters: string;
  match: string;
  matchAll: string;
  matchAny: string;
  emptyState: string;
  addFilter: string;
  addGroup: string;
  group: {
    and: string;
    or: string;
    /** "{logical} group ({count} rules)" — plural; `{logical}` is `group.and` / `group.or` */
    summary: PluralForms;
  };
  rule: {
    fieldPlaceholder: string;
    valuePlaceholder: string;
    /** Expected input pattern for date values — an ISO format hint, not prose */
    datePlaceholder: string;
    booleanTrue: string;
    booleanFalse: string;
    remove: string;
  };
  operators: FilterOperatorTranslations;
}

/** ContentNavigation strings. */
export interface ContentNavigationTranslations {
  searchPlaceholder: string;
  collectionOptions: string;
  editCollection: string;
  untitledBookmark: string;
  showHiddenCollections: string;
  hideHiddenCollections: string;
  emptyState: {
    title: string;
    adminHint: string;
  };
}

/** SaveOptions strings. */
export interface SaveOptionsTranslations {
  moreOptions: string;
  saveAndStay: string;
  saveAndCreateNew: string;
  saveAsCopy: string;
  discardChanges: string;
  kbd: {
    /** Modifier key cap on non-Mac platforms (Mac shows ⌘) */
    ctrl: string;
  };
}

export interface CollectionsTranslations {
  list: CollectionListTranslations;
  listToolbar: CollectionListToolbarTranslations;
  listFooter: {
    perPage: string;
  };
  bulkActions: BulkActionsTranslations;
  deleteConfirm: DeleteConfirmTranslations;
  form: CollectionFormTranslations;
  filterPanel: FilterPanelTranslations;
  navigation: ContentNavigationTranslations;
  saveOptions: SaveOptionsTranslations;
}

export const collectionsDefaults: CollectionsTranslations = {
  list: {
    errors: {
      noVisibleFields:
        'No visible fields found for collection "{collection}". Verify the collection exists and has non-hidden fields.',
      loadFieldsFailed:
        'Failed to load collection fields. Make sure the Storybook Host app is running (pnpm dev:host) and connected at http://localhost:3000.',
      loadItemsFailed: 'Failed to load items',
      deleteFailed: 'Failed to delete items',
    },
    headerMenu: {
      sort: 'Sort',
      sortAscending: 'Sort ascending',
      sortDescending: 'Sort descending',
      alignment: 'Alignment',
      alignLeft: 'Align left',
      alignCenter: 'Align center',
      alignRight: 'Align right',
      hideField: 'Hide field',
    },
    addField: {
      label: 'Add field',
    },
    cell: {
      booleanTrue: 'Yes',
      booleanFalse: 'No',
      jsonBadge: 'JSON',
      moreChoices: '+{count}',
      truncated: '{value}…',
    },
    itemCount: {
      loading: 'Loading...',
      none: 'No items',
      singlePage: { one: '{count} item', other: '{count} items' },
      range: { other: '{from}–{to} of {count} items' },
      filteredSinglePage: {
        one: '{count} item (filtered from {total})',
        other: '{count} items (filtered from {total})',
      },
      filteredRange: { other: '{from}–{to} of {count} items (filtered from {total})' },
    },
    filterPanel: {
      title: 'Filters',
      clearAll: 'Clear all',
    },
    table: {
      loading: 'Loading items...',
      noItems: 'No items in this collection',
      noResultsFiltered: 'No results — try adjusting your search or filters',
    },
  },
  listToolbar: {
    searchPlaceholder: 'Search...',
    clearSearch: 'Clear search',
    showFilters: 'Show filters',
    hideFilters: 'Hide filters',
    toggleFilterPanel: 'Toggle filter panel',
    archive: {
      all: 'All Items',
      active: 'Active Items',
      archived: 'Archived Items',
    },
    refresh: 'Refresh',
    createItem: 'Create item',
    createItemNotAllowed: 'Create item (not allowed)',
  },
  listFooter: {
    perPage: 'Per page:',
  },
  bulkActions: {
    selectedCount: { one: '{count} selected', other: '{count} selected' },
    deleteSelectedTooltip: 'Delete selected',
    delete: 'Delete',
    clearSelection: 'Clear selection',
  },
  deleteConfirm: {
    title: 'Confirm Delete',
    message: {
      one: 'Are you sure you want to delete {count} item? This action cannot be undone.',
      other: 'Are you sure you want to delete {count} items? This action cannot be undone.',
    },
    cancel: 'Cancel',
    confirm: 'Delete',
  },
  form: {
    actions: {
      create: 'Create',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    },
    success: {
      created: 'Item created successfully!',
      updated: 'Item updated successfully!',
      previewOnly: 'Looks valid — preview only, no record was created.',
    },
    errors: {
      loadFailed: 'Failed to load form data',
      saveFailed: 'Failed to save item',
      deleteFailed: 'Failed to delete item',
      validationFailed: 'Validation failed. Please fix the highlighted fields.',
      fieldValidationFallback: 'Validation failed',
      junctionUpdateMissingKey:
        'Cannot update junction row in "{junctionCollection}": staged entry has no "{junctionPrimaryKeyField}" value.',
      missingExtrasColumn:
        'This screen has "extras" fields, but the "{collection}" collection has no "{extrasColumn}" (json) column to store them. Add a "{extrasColumn}" json column to "{collection}" (or switch those fields to real columns).',
    },
    emptyState: {
      noPermissionCreate: "You don't have permission to create items in {collection}",
      noPermissionEdit: "You don't have permission to edit items in {collection}",
      noEditableFields: 'No editable fields found for {collection}',
    },
    deleteConfirm: {
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      cancel: 'Cancel',
      confirm: 'Delete',
    },
  },
  filterPanel: {
    title: 'Filters',
    activeCount: { one: '{count} active', other: '{count} active' },
    clearAll: 'Clear all',
    clearAllFilters: 'Clear all filters',
    match: 'Match',
    matchAll: 'ALL',
    matchAny: 'ANY',
    emptyState: 'No filter rules. Click "Add filter" to get started.',
    addFilter: 'Add filter',
    addGroup: 'Add group',
    group: {
      and: 'AND',
      or: 'OR',
      summary: { other: '{logical} group ({count} rules)' },
    },
    rule: {
      fieldPlaceholder: 'Field...',
      valuePlaceholder: 'Value...',
      datePlaceholder: 'YYYY-MM-DD',
      booleanTrue: 'True',
      booleanFalse: 'False',
      remove: 'Remove filter',
    },
    operators: {
      equals: 'Equals',
      notEquals: 'Not equals',
      contains: 'Contains',
      doesNotContain: 'Does not contain',
      startsWith: 'Starts with',
      endsWith: 'Ends with',
      isEmpty: 'Is empty',
      isNotEmpty: 'Is not empty',
      isNull: 'Is null',
      isNotNull: 'Is not null',
      greaterThan: 'Greater than',
      greaterOrEqual: 'Greater or equal',
      lessThan: 'Less than',
      lessOrEqual: 'Less or equal',
      after: 'After',
      onOrAfter: 'On or after',
      before: 'Before',
      onOrBefore: 'On or before',
    },
  },
  navigation: {
    searchPlaceholder: 'Search collections...',
    collectionOptions: 'Collection options',
    editCollection: 'Edit Collection',
    untitledBookmark: 'Untitled Bookmark',
    showHiddenCollections: 'Show hidden collections',
    hideHiddenCollections: 'Hide hidden collections',
    emptyState: {
      title: 'No collections available',
      adminHint: 'Create your first collection in the data model settings',
    },
  },
  saveOptions: {
    moreOptions: 'More save options',
    saveAndStay: 'Save and Stay',
    saveAndCreateNew: 'Save and Create New',
    saveAsCopy: 'Save as Copy',
    discardChanges: 'Discard Changes',
    kbd: {
      ctrl: 'Ctrl',
    },
  },
};

export const collectionsId: CollectionsTranslations = {
  list: {
    errors: {
      noVisibleFields:
        'Tidak ada kolom yang terlihat untuk koleksi "{collection}". Pastikan koleksi tersebut ada dan memiliki kolom yang tidak tersembunyi.',
      loadFieldsFailed:
        'Gagal memuat kolom koleksi. Pastikan aplikasi Storybook Host sedang berjalan (pnpm dev:host) dan terhubung di http://localhost:3000.',
      loadItemsFailed: 'Gagal memuat item',
      deleteFailed: 'Gagal menghapus item',
    },
    headerMenu: {
      sort: 'Urutkan',
      sortAscending: 'Urutkan menaik',
      sortDescending: 'Urutkan menurun',
      alignment: 'Perataan',
      alignLeft: 'Rata kiri',
      alignCenter: 'Rata tengah',
      alignRight: 'Rata kanan',
      hideField: 'Sembunyikan kolom',
    },
    addField: {
      label: 'Tambah kolom',
    },
    cell: {
      booleanTrue: 'Ya',
      booleanFalse: 'Tidak',
      jsonBadge: 'JSON',
      moreChoices: '+{count}',
      truncated: '{value}…',
    },
    itemCount: {
      loading: 'Memuat...',
      none: 'Tidak ada item',
      singlePage: { other: '{count} item' },
      range: { other: '{from}–{to} dari {count} item' },
      filteredSinglePage: { other: '{count} item (difilter dari {total})' },
      filteredRange: { other: '{from}–{to} dari {count} item (difilter dari {total})' },
    },
    filterPanel: {
      title: 'Filter',
      clearAll: 'Bersihkan semua',
    },
    table: {
      loading: 'Memuat item...',
      noItems: 'Tidak ada item dalam koleksi ini',
      noResultsFiltered: 'Tidak ada hasil — coba ubah pencarian atau filter Anda',
    },
  },
  listToolbar: {
    searchPlaceholder: 'Cari...',
    clearSearch: 'Bersihkan pencarian',
    showFilters: 'Tampilkan filter',
    hideFilters: 'Sembunyikan filter',
    toggleFilterPanel: 'Buka/tutup panel filter',
    archive: {
      all: 'Semua Item',
      active: 'Item Aktif',
      archived: 'Item Terarsip',
    },
    refresh: 'Muat ulang',
    createItem: 'Buat item',
    createItemNotAllowed: 'Buat item (tidak diizinkan)',
  },
  listFooter: {
    perPage: 'Per halaman:',
  },
  bulkActions: {
    selectedCount: { other: '{count} dipilih' },
    deleteSelectedTooltip: 'Hapus yang dipilih',
    delete: 'Hapus',
    clearSelection: 'Bersihkan pilihan',
  },
  deleteConfirm: {
    title: 'Konfirmasi Hapus',
    message: {
      other: 'Yakin ingin menghapus {count} item? Tindakan ini tidak dapat dibatalkan.',
    },
    cancel: 'Batal',
    confirm: 'Hapus',
  },
  form: {
    actions: {
      create: 'Buat',
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
    },
    success: {
      created: 'Item berhasil dibuat!',
      updated: 'Item berhasil diperbarui!',
      previewOnly: 'Terlihat valid — hanya pratinjau, tidak ada data yang dibuat.',
    },
    errors: {
      loadFailed: 'Gagal memuat data formulir',
      saveFailed: 'Gagal menyimpan item',
      deleteFailed: 'Gagal menghapus item',
      validationFailed: 'Validasi gagal. Harap perbaiki kolom yang ditandai.',
      fieldValidationFallback: 'Validasi gagal',
      junctionUpdateMissingKey:
        'Tidak dapat memperbarui baris junction di "{junctionCollection}": entri yang disiapkan tidak memiliki nilai "{junctionPrimaryKeyField}".',
      missingExtrasColumn:
        'Layar ini memiliki kolom "extras", tetapi koleksi "{collection}" tidak memiliki kolom "{extrasColumn}" (json) untuk menyimpannya. Tambahkan kolom json "{extrasColumn}" ke "{collection}" (atau ubah kolom tersebut menjadi kolom sebenarnya).',
    },
    emptyState: {
      noPermissionCreate: 'Anda tidak memiliki izin untuk membuat item di {collection}',
      noPermissionEdit: 'Anda tidak memiliki izin untuk mengubah item di {collection}',
      noEditableFields: 'Tidak ada kolom yang dapat diubah untuk {collection}',
    },
    deleteConfirm: {
      title: 'Konfirmasi Hapus',
      message: 'Yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.',
      cancel: 'Batal',
      confirm: 'Hapus',
    },
  },
  filterPanel: {
    title: 'Filter',
    activeCount: { other: '{count} aktif' },
    clearAll: 'Bersihkan semua',
    clearAllFilters: 'Bersihkan semua filter',
    match: 'Cocokkan',
    matchAll: 'SEMUA',
    matchAny: 'SALAH SATU',
    emptyState: 'Belum ada aturan filter. Klik "Tambah filter" untuk memulai.',
    addFilter: 'Tambah filter',
    addGroup: 'Tambah grup',
    group: {
      and: 'DAN',
      or: 'ATAU',
      summary: { other: 'Grup {logical} ({count} aturan)' },
    },
    rule: {
      fieldPlaceholder: 'Kolom...',
      valuePlaceholder: 'Nilai...',
      datePlaceholder: 'YYYY-MM-DD',
      booleanTrue: 'Benar',
      booleanFalse: 'Salah',
      remove: 'Hapus filter',
    },
    operators: {
      equals: 'Sama dengan',
      notEquals: 'Tidak sama dengan',
      contains: 'Mengandung',
      doesNotContain: 'Tidak mengandung',
      startsWith: 'Diawali dengan',
      endsWith: 'Diakhiri dengan',
      isEmpty: 'Kosong',
      isNotEmpty: 'Tidak kosong',
      isNull: 'Bernilai null',
      isNotNull: 'Tidak bernilai null',
      greaterThan: 'Lebih besar dari',
      greaterOrEqual: 'Lebih besar atau sama dengan',
      lessThan: 'Lebih kecil dari',
      lessOrEqual: 'Lebih kecil atau sama dengan',
      after: 'Setelah',
      onOrAfter: 'Pada atau setelah',
      before: 'Sebelum',
      onOrBefore: 'Pada atau sebelum',
    },
  },
  navigation: {
    searchPlaceholder: 'Cari koleksi...',
    collectionOptions: 'Opsi koleksi',
    editCollection: 'Ubah Koleksi',
    untitledBookmark: 'Markah Tanpa Judul',
    showHiddenCollections: 'Tampilkan koleksi tersembunyi',
    hideHiddenCollections: 'Sembunyikan koleksi tersembunyi',
    emptyState: {
      title: 'Tidak ada koleksi tersedia',
      adminHint: 'Buat koleksi pertama Anda di pengaturan model data',
    },
  },
  saveOptions: {
    moreOptions: 'Opsi simpan lainnya',
    saveAndStay: 'Simpan dan Tetap di Sini',
    saveAndCreateNew: 'Simpan dan Buat Baru',
    saveAsCopy: 'Simpan sebagai Salinan',
    discardChanges: 'Buang Perubahan',
    kbd: {
      ctrl: 'Ctrl',
    },
  },
};
