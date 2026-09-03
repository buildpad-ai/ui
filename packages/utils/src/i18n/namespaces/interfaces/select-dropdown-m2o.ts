/**
 * `interfaces.selectDropdownM2O` — strings of the SelectDropdownM2O interface
 * and of the render-prop placeholder `SelectDropdownM2OInterface`
 * (`placeholderInterface`).
 */
export interface SelectDropdownM2OTranslations {
  /** Default placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  configError: {
    title: string;
    storybookNote: string;
  };
  notConfigured: {
    title: string;
    message: string;
  };
  /** aria-label of the clear button in the dropdown trigger */
  clearSelection: string;
  searchPlaceholder: string;
  loading: string;
  noItemsFound: string;
  createNew: string;
  /** Tooltip of the external-link action (dropdown layout) */
  viewRelatedItem: string;
  /** Tooltip of the external-link action (modal layout) */
  viewItem: string;
  change: string;
  remove: string;
  noItemSelected: string;
  selectItem: string;
  /** Used in modal titles when the related collection name is unknown */
  itemFallback: string;
  createModal: {
    /** "Create New {collection}" */
    title: string;
    notImplemented: string;
  };
  selectModal: {
    /** "Select {collection}" */
    title: string;
    actionsColumn: string;
    selected: string;
    select: string;
    clearSelection: string;
    cancel: string;
  };
  /** `SelectDropdownM2OInterface` — the render-prop placeholder component */
  placeholderInterface: {
    componentName: string;
    /** "{component} requires render props to be provided." */
    missingRenderProps: string;
    /** "Collection: {collection}, Field: {field}" */
    collectionField: string;
    validationError: string;
    select: string;
    create: string;
    /** "Item {id}" — shown when no template resolves the selected item */
    itemFallback: string;
  };
}

export const selectDropdownM2ODefaults: SelectDropdownM2OTranslations = {
  placeholder: 'Select an item...',
  configError: {
    title: 'Configuration Error',
    storybookNote:
      'Note: In Storybook, relational interfaces require API proxy routes. This component works fully in a Next.js app with DaaS integration.',
  },
  notConfigured: {
    title: 'Relationship not configured',
    message: 'The many-to-one relationship is not properly configured for this field.',
  },
  clearSelection: 'Clear selection',
  searchPlaceholder: 'Search...',
  loading: 'Loading...',
  noItemsFound: 'No items found',
  createNew: 'Create New',
  viewRelatedItem: 'View related item',
  viewItem: 'View item',
  change: 'Change',
  remove: 'Remove',
  noItemSelected: 'No item selected',
  selectItem: 'Select Item',
  itemFallback: 'Item',
  createModal: {
    title: 'Create New {collection}',
    notImplemented: 'Create functionality will be available when CollectionForm component is implemented.',
  },
  selectModal: {
    title: 'Select {collection}',
    actionsColumn: 'Actions',
    selected: 'Selected',
    select: 'Select',
    clearSelection: 'Clear Selection',
    cancel: 'Cancel',
  },
  placeholderInterface: {
    componentName: 'SelectDropdownM2O Interface',
    missingRenderProps: '{component} requires render props to be provided.',
    collectionField: 'Collection: {collection}, Field: {field}',
    validationError: 'Validation error',
    select: 'Select',
    create: 'Create',
    itemFallback: 'Item {id}',
  },
};

export const selectDropdownM2OId: SelectDropdownM2OTranslations = {
  placeholder: 'Pilih item...',
  configError: {
    title: 'Kesalahan Konfigurasi',
    storybookNote:
      'Catatan: Di Storybook, antarmuka relasional memerlukan rute proxy API. Komponen ini berfungsi penuh di aplikasi Next.js dengan integrasi DaaS.',
  },
  notConfigured: {
    title: 'Relasi belum dikonfigurasi',
    message: 'Relasi many-to-one untuk kolom ini belum dikonfigurasi dengan benar.',
  },
  clearSelection: 'Bersihkan pilihan',
  searchPlaceholder: 'Cari...',
  loading: 'Memuat...',
  noItemsFound: 'Tidak ada item ditemukan',
  createNew: 'Buat Baru',
  viewRelatedItem: 'Lihat item terkait',
  viewItem: 'Lihat item',
  change: 'Ganti',
  remove: 'Hapus',
  noItemSelected: 'Tidak ada item dipilih',
  selectItem: 'Pilih Item',
  itemFallback: 'Item',
  createModal: {
    title: 'Buat {collection} Baru',
    notImplemented: 'Fungsi buat akan tersedia setelah komponen CollectionForm diimplementasikan.',
  },
  selectModal: {
    title: 'Pilih {collection}',
    actionsColumn: 'Aksi',
    selected: 'Terpilih',
    select: 'Pilih',
    clearSelection: 'Bersihkan Pilihan',
    cancel: 'Batal',
  },
  placeholderInterface: {
    componentName: 'Antarmuka SelectDropdownM2O',
    missingRenderProps: '{component} memerlukan render props.',
    collectionField: 'Koleksi: {collection}, Kolom: {field}',
    validationError: 'Kesalahan validasi',
    select: 'Pilih',
    create: 'Buat',
    itemFallback: 'Item {id}',
  },
};
