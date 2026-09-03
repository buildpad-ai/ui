/**
 * `hooks` namespace — @buildpad/hooks: notifications raised by the relation
 * hooks (useRelationM2M, useRelationM2MItems, useRelationM2A).
 */
import type { PluralForms } from '../primitives';

export interface HooksRelationsTranslations {
  errorTitle: string;
  successTitle: string;
  saveRequiredTitle: string;
  partiallyAddedTitle: string;
  loadConfigFailed: string;
  loadM2AConfigFailed: string;
  loadItemsFailed: string;
  saveFirst: string;
  itemAdded: string;
  addItemFailed: string;
  /** "Added {count} items" */
  addedCount: PluralForms;
  /** "Added {added} of {total} items; {failed} failed" */
  addedPartial: string;
  addSelectedFailed: string;
  removeNoPrimaryKey: string;
  itemRemoved: string;
  removeItemFailed: string;
  reorderNoPrimaryKey: string;
  /** "Failed to reorder {failed} of {total} items" */
  reorderFailed: string;
}

export interface HooksTranslations {
  relations: HooksRelationsTranslations;
}

export const hooksDefaults: HooksTranslations = {
  relations: {
    errorTitle: 'Error',
    successTitle: 'Success',
    saveRequiredTitle: 'Save Required',
    partiallyAddedTitle: 'Partially added',
    loadConfigFailed: 'Failed to load relationship configuration',
    loadM2AConfigFailed: 'Failed to load M2A relationship configuration',
    loadItemsFailed: 'Failed to load related items',
    saveFirst: 'Please save the item first before adding related items',
    itemAdded: 'Item added successfully',
    addItemFailed: 'Failed to add item',
    addedCount: { other: 'Added {count} items' },
    addedPartial: 'Added {added} of {total} items; {failed} failed',
    addSelectedFailed: 'Failed to add selected items',
    removeNoPrimaryKey: 'Cannot remove this item: it has no primary key',
    itemRemoved: 'Item removed successfully',
    removeItemFailed: 'Failed to remove item',
    reorderNoPrimaryKey: 'Cannot reorder: some items have no primary key',
    reorderFailed: 'Failed to reorder {failed} of {total} items',
  },
};

export const hooksId: HooksTranslations = {
  relations: {
    errorTitle: 'Kesalahan',
    successTitle: 'Berhasil',
    saveRequiredTitle: 'Perlu Disimpan',
    partiallyAddedTitle: 'Sebagian ditambahkan',
    loadConfigFailed: 'Gagal memuat konfigurasi relasi',
    loadM2AConfigFailed: 'Gagal memuat konfigurasi relasi M2A',
    loadItemsFailed: 'Gagal memuat item terkait',
    saveFirst: 'Simpan item ini terlebih dahulu sebelum menambahkan item terkait',
    itemAdded: 'Item berhasil ditambahkan',
    addItemFailed: 'Gagal menambahkan item',
    addedCount: { other: '{count} item ditambahkan' },
    addedPartial: '{added} dari {total} item ditambahkan; {failed} gagal',
    addSelectedFailed: 'Gagal menambahkan item yang dipilih',
    removeNoPrimaryKey: 'Item ini tidak dapat dihapus: tidak memiliki kunci utama',
    itemRemoved: 'Item berhasil dihapus',
    removeItemFailed: 'Gagal menghapus item',
    reorderNoPrimaryKey: 'Tidak dapat mengurutkan ulang: beberapa item tidak memiliki kunci utama',
    reorderFailed: 'Gagal mengurutkan ulang {failed} dari {total} item',
  },
};
