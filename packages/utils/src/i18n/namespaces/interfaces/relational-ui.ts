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
     * "CollectionForm, CollectionList" (the form-renderer slot is shown as
     * "VForm").
     *
     * Only CollectionForm and CollectionsRelationalProvider supply every
     * component; a VForm supplies only itself (the form renderer), so the
     * message must not send a developer to VForm for the other two.
     */
    message: string;
  };
}

export const relationalUIDefaults: RelationalUITranslations = {
  loading: 'Loading…',
  missingProvider: {
    title: 'Related items cannot be edited here',
    message:
      'Creating, selecting and editing related items needs {components}, which no relational provider supplies. Render this field inside a CollectionForm, wrap it (or the VForm around it) in CollectionsRelationalProvider, or pass them through its `components` prop.',
  },
};

export const relationalUIId: RelationalUITranslations = {
  loading: 'Memuat…',
  missingProvider: {
    title: 'Item terkait tidak dapat diubah di sini',
    message:
      'Membuat, memilih, dan mengubah item terkait memerlukan {components}, yang tidak disediakan oleh penyedia relasi mana pun. Tampilkan kolom ini di dalam CollectionForm, bungkus kolom ini (atau VForm di sekitarnya) dengan CollectionsRelationalProvider, atau berikan komponen tersebut melalui prop `components`.',
  },
};
