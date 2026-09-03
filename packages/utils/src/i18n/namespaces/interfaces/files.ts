/** `interfaces.files` — strings of the Files interface (multiple files). */
export interface FilesTranslations {
  placeholder: string;
  loading: string;
  /** Badge next to the label in read-only mode */
  readOnly: string;
  uploadFile: string;
  addExisting: string;
  actions: {
    /** Tooltip of the remove button */
    remove: string;
    /** aria-label of the remove button */
    removeFile: string;
    /** aria-label of the "more" menu trigger */
    moreOptions: string;
    openInNewTab: string;
    downloadFile: string;
  };
}

export const filesDefaults: FilesTranslations = {
  placeholder: 'No items',
  loading: 'Loading files...',
  readOnly: 'Read only',
  uploadFile: 'Upload File',
  addExisting: 'Add Existing',
  actions: {
    remove: 'Remove',
    removeFile: 'Remove file',
    moreOptions: 'More options',
    openInNewTab: 'Open in new tab',
    downloadFile: 'Download file',
  },
};

export const filesId: FilesTranslations = {
  placeholder: 'Tidak ada item',
  loading: 'Memuat berkas...',
  readOnly: 'Hanya baca',
  uploadFile: 'Unggah Berkas',
  addExisting: 'Tambah yang Ada',
  actions: {
    remove: 'Hapus',
    removeFile: 'Hapus berkas',
    moreOptions: 'Opsi lainnya',
    openInNewTab: 'Buka di tab baru',
    downloadFile: 'Unduh berkas',
  },
};
