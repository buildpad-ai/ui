/**
 * ListM2M strings. Keys are snake_case for backward compatibility with the
 * pre-existing `translations` prop of `ListM2M`.
 */
export interface ListM2MTranslations {
  // Header Actions
  create_new: string;
  add_existing: string;
  batch_edit: string;
  batch_edit_not_implemented: string;
  not_allowed: string;
  // States
  no_items: string;
  relationship_not_setup: string;
  relationship_not_setup_detail: string;
  no_singleton_relations: string;
  configuration_error: string;
  storybook_hint: string;
  loading: string;
  // Pagination
  per_page: string;
  showing_range: string;
  item_count_one: string;
  item_count_other: string;
  unsaved_changes: string;
  // Actions
  edit: string;
  remove: string;
  navigate_to_item: string;
  search_placeholder: string;
  select_items: string;
  add_selected: string;
  select_all: string;
  deselect_all: string;
  // Drawer
  create_item: string;
  edit_item: string;
  junction_fields: string;
  // Batch Edit
  batch_edit_title: string;
  batch_edit_apply: string;
  // Sorting
  move_up: string;
  move_down: string;
  drag_to_reorder: string;
  order: string;
  actions: string;
  // Versioning
  version: string;
  viewing_version: string;
  // Status badges
  badge_new: string;
  badge_edited: string;
  // Validation
  field_required: string;
  invalid_value: string;
}

export const listM2MDefaults: ListM2MTranslations = {
  // Header Actions
  create_new: 'Create New',
  add_existing: 'Add Existing',
  batch_edit: 'Edit Selected',
  batch_edit_not_implemented: 'Batch editing is not yet implemented',
  not_allowed: 'Not allowed',
  // States
  no_items: 'No related items',
  relationship_not_setup: 'Relationship not configured',
  relationship_not_setup_detail:
    'The many-to-many relationship is not properly configured for this field.',
  no_singleton_relations:
    'The related collection is a singleton and cannot be used in an M2M relationship.',
  configuration_error: 'Configuration Error',
  storybook_hint:
    'In Storybook, relational interfaces require API proxy routes. This component works fully in a Next.js app with DaaS integration.',
  loading: 'Loading...',
  // Pagination
  per_page: 'Items per page:',
  showing_range: 'Showing {start} to {end} of {total}',
  item_count_one: '1 item',
  item_count_other: '{count} items',
  unsaved_changes: '(unsaved changes)',
  // Actions
  edit: 'Edit',
  remove: 'Remove',
  navigate_to_item: 'Open item',
  search_placeholder: 'Search...',
  select_items: 'Select Items',
  add_selected: 'Add Selected',
  select_all: 'Select All',
  deselect_all: 'Deselect All',
  // Drawer
  create_item: 'Create New Item',
  edit_item: 'Edit Item',
  junction_fields: 'Junction Fields',
  // Batch Edit
  batch_edit_title: 'Editing {count} items',
  batch_edit_apply: 'Apply Changes',
  // Sorting
  move_up: 'Move up',
  move_down: 'Move down',
  drag_to_reorder: 'Drag to reorder',
  order: 'Order',
  actions: 'Actions',
  // Versioning
  version: 'Version',
  viewing_version: 'Viewing version: {name}',
  // Status badges
  badge_new: 'NEW',
  badge_edited: 'EDITED',
  // Validation
  field_required: 'This field is required',
  invalid_value: 'Invalid value',
};

export const listM2MId: ListM2MTranslations = {
  create_new: 'Buat Baru',
  add_existing: 'Tambah yang Ada',
  batch_edit: 'Ubah yang Dipilih',
  batch_edit_not_implemented: 'Pengeditan massal belum tersedia',
  not_allowed: 'Tidak diizinkan',
  no_items: 'Tidak ada item terkait',
  relationship_not_setup: 'Relasi belum dikonfigurasi',
  relationship_not_setup_detail:
    'Relasi many-to-many untuk kolom ini belum dikonfigurasi dengan benar.',
  no_singleton_relations:
    'Koleksi terkait adalah singleton dan tidak dapat digunakan dalam relasi M2M.',
  configuration_error: 'Kesalahan Konfigurasi',
  storybook_hint:
    'Di Storybook, antarmuka relasional memerlukan rute proxy API. Komponen ini berfungsi penuh di aplikasi Next.js dengan integrasi DaaS.',
  loading: 'Memuat...',
  per_page: 'Item per halaman:',
  showing_range: 'Menampilkan {start} sampai {end} dari {total}',
  item_count_one: '1 item',
  item_count_other: '{count} item',
  unsaved_changes: '(perubahan belum disimpan)',
  edit: 'Ubah',
  remove: 'Hapus',
  navigate_to_item: 'Buka item',
  search_placeholder: 'Cari...',
  select_items: 'Pilih Item',
  add_selected: 'Tambahkan yang Dipilih',
  select_all: 'Pilih Semua',
  deselect_all: 'Batalkan Semua Pilihan',
  create_item: 'Buat Item Baru',
  edit_item: 'Ubah Item',
  junction_fields: 'Kolom Junction',
  batch_edit_title: 'Mengubah {count} item',
  batch_edit_apply: 'Terapkan Perubahan',
  move_up: 'Pindah ke atas',
  move_down: 'Pindah ke bawah',
  drag_to_reorder: 'Seret untuk mengurutkan',
  order: 'Urutan',
  actions: 'Aksi',
  version: 'Versi',
  viewing_version: 'Melihat versi: {name}',
  badge_new: 'BARU',
  badge_edited: 'DIUBAH',
  field_required: 'Kolom ini wajib diisi',
  invalid_value: 'Nilai tidak valid',
};
