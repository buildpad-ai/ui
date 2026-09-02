/**
 * `table` namespace — ui-table (VTable, TableRow, TableHeader).
 *
 * One file per namespace so packages can be migrated in parallel without
 * touching a shared dictionary file: the English defaults and the Indonesian
 * catalog live next to the interface they must match.
 */
export interface TableTranslations {
  loading: string;
  noItems: string;
  selectAll: string;
  selectRow: string;
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
  selectAll: 'Select all rows',
  selectRow: 'Select row',
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
  selectAll: 'Pilih semua baris',
  selectRow: 'Pilih baris',
  dragToReorder: 'Seret untuk mengurutkan',
  sortBy: 'Urutkan berdasarkan {column}',
  sortAscending: 'Diurutkan menaik',
  sortDescending: 'Diurutkan menurun',
  resizeColumn: 'Ubah lebar kolom',
  actions: 'Aksi',
};
