/** `interfaces.collectionItemDropdown` — strings of the CollectionItemDropdown interface. */
export interface CollectionItemDropdownTranslations {
  placeholder: string;
  searchPlaceholder: string;
  loading: string;
  noItems: string;
  /** aria-label of the clear button */
  clearSelection: string;
  viewItem: string;
  configError: {
    title: string;
    message: string;
  };
  /** Collection picker shown with `showCollectionSelect` */
  collectionSelect: {
    label: string;
    placeholder: string;
    description: string;
    /** Tooltip of the menu trigger */
    menuTooltip: string;
    /** Section header above the system collections */
    systemSection: string;
    empty: string;
  };
  selectModal: {
    /** "Select from {collection}" */
    title: string;
    actionsColumn: string;
    /** Rendered for an empty cell */
    emptyCell: string;
    select: string;
    view: string;
  };
}

export const collectionItemDropdownDefaults: CollectionItemDropdownTranslations = {
  placeholder: 'Select an item...',
  searchPlaceholder: 'Search...',
  loading: 'Loading...',
  noItems: 'No items found',
  clearSelection: 'Clear selection',
  viewItem: 'View item',
  configError: {
    title: 'Configuration Error',
    message:
      'The selectedCollection prop is required for CollectionItemDropdown, or enable showCollectionSelect.',
  },
  collectionSelect: {
    label: 'Collection',
    placeholder: 'Select a collection...',
    description: 'Select which collection to pick items from',
    menuTooltip: 'Select existing collection',
    systemSection: 'System',
    empty: 'No collections found',
  },
  selectModal: {
    title: 'Select from {collection}',
    actionsColumn: 'Actions',
    emptyCell: '-',
    select: 'Select',
    view: 'View',
  },
};

export const collectionItemDropdownId: CollectionItemDropdownTranslations = {
  placeholder: 'Pilih item...',
  searchPlaceholder: 'Cari...',
  loading: 'Memuat...',
  noItems: 'Tidak ada item ditemukan',
  clearSelection: 'Hapus pilihan',
  viewItem: 'Lihat item',
  configError: {
    title: 'Kesalahan Konfigurasi',
    message:
      'Prop selectedCollection wajib diisi untuk CollectionItemDropdown, atau aktifkan showCollectionSelect.',
  },
  collectionSelect: {
    label: 'Koleksi',
    placeholder: 'Pilih koleksi...',
    description: 'Pilih koleksi sumber item',
    menuTooltip: 'Pilih koleksi yang ada',
    systemSection: 'Sistem',
    empty: 'Tidak ada koleksi ditemukan',
  },
  selectModal: {
    title: 'Pilih dari {collection}',
    actionsColumn: 'Aksi',
    emptyCell: '-',
    select: 'Pilih',
    view: 'Lihat',
  },
};
