/**
 * `interfaces.relationalUI` — strings shared by the relational interfaces
 * (ListO2M, ListM2M, ListM2A, JunctionItemForm) about the components they
 * render in their dialogs, which come from a `RelationalUIProvider`.
 */
export interface RelationalUITranslations {
  /** Shown while a dialog's form or picker is loading */
  loading: string;
  missingProvider: {
    title: string;
    /**
     * "{components}" is the list of missing components, e.g.
     * "CollectionForm, CollectionList".
     */
    message: string;
  };
}

export const relationalUIDefaults: RelationalUITranslations = {
  loading: 'Loading…',
  missingProvider: {
    title: 'Related items cannot be edited here',
    message:
      'Creating, selecting and editing related items needs {components}, which no relational provider supplies. Render this field inside CollectionForm or VForm, or wrap the page in CollectionsRelationalProvider.',
  },
};

export const relationalUIId: RelationalUITranslations = {
  loading: 'Memuat…',
  missingProvider: {
    title: 'Item terkait tidak dapat diubah di sini',
    message:
      'Membuat, memilih, dan mengubah item terkait memerlukan {components}, yang tidak disediakan oleh penyedia relasi mana pun. Tampilkan kolom ini di dalam CollectionForm atau VForm, atau bungkus halaman dengan CollectionsRelationalProvider.',
  },
};
