/**
 * `table` namespace — ui-table (VTable, TableRow, TableHeader).
 *
 * One file per namespace so packages can be migrated in parallel without
 * touching a shared dictionary file: the English defaults and the Indonesian
 * catalog live next to the interface they must match.
 *
 * Keys are additive: `dragToReorder`, `sortBy`, `sortAscending`,
 * `sortDescending`, `resizeColumn` and `actions` predate the migration and are
 * kept for consumers' dictionaries even though no component reads them yet.
 */
export interface TableTranslations {
  // VTable — table states
  /** Default of the `loadingText` prop; rendered in the loading tbody */
  loading: string;
  /** Default of the `noItemsText` prop; rendered in the empty tbody */
  noItems: string;

  // TableHeader — header row controls
  /** sr-only accessible name of the clickable manual-sort column */
  toggleManualSort: string;
  /** aria-label of the select-all checkbox (`showSelect="multiple"`) */
  selectAll: string;
  /** aria-label of the per-column drag handle (`allowHeaderReorder`) */
  reorderColumn: string;

  // TableRow — row controls and default cell formatting
  /** aria-label of the row drag handle (`showManualSort`) */
  reorderRow: string;
  /** aria-label of the row radio (`showSelect="one"`) / checkbox (`"multiple"`) */
  selectRow: string;
  /** Default rendering of a boolean `true` cell value */
  booleanTrue: string;
  /** Default rendering of a boolean `false` cell value */
  booleanFalse: string;
  /** Glyph shown for a null/undefined cell value when no `renderCell` is given */
  emptyValue: string;

  // Reserved (not read by a component yet)
  /** aria-label for the drag handle */
  dragToReorder: string;
  /** "Sort by {column}" */
  sortBy: string;
  sortAscending: string;
  sortDescending: string;
  /** Column resize handle aria-label */
  resizeColumn: string;
  /** Header for the row-actions column */
  actions: string;
}

export const tableDefaults: TableTranslations = {
  loading: 'Loading...',
  noItems: 'No items',
  toggleManualSort: 'Toggle manual sort',
  selectAll: 'Select all',
  reorderColumn: 'Reorder column',
  reorderRow: 'Reorder row',
  selectRow: 'Select row',
  booleanTrue: 'Yes',
  booleanFalse: 'No',
  emptyValue: '—',
  dragToReorder: 'Drag to reorder',
  sortBy: 'Sort by {column}',
  sortAscending: 'Sorted ascending',
  sortDescending: 'Sorted descending',
  resizeColumn: 'Resize column',
  actions: 'Actions',
};

export const tableId: TableTranslations = {
  loading: 'Memuat...',
  noItems: 'Tidak ada item',
  toggleManualSort: 'Alihkan pengurutan manual',
  selectAll: 'Pilih semua',
  reorderColumn: 'Ubah urutan kolom',
  reorderRow: 'Ubah urutan baris',
  selectRow: 'Pilih baris',
  booleanTrue: 'Ya',
  booleanFalse: 'Tidak',
  emptyValue: '—',
  dragToReorder: 'Seret untuk mengurutkan',
  sortBy: 'Urutkan berdasarkan {column}',
  sortAscending: 'Diurutkan menaik',
  sortDescending: 'Diurutkan menurun',
  resizeColumn: 'Ubah lebar kolom',
  actions: 'Aksi',
};
