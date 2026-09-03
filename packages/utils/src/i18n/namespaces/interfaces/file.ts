/** `interfaces.file` — strings of the File interface (single file picker). */
export interface FileTranslations {
  placeholder: string;
  /** Badge next to the label in read-only mode */
  readOnly: string;
  disabled: string;
  /** "{type} • {size}" — MIME type and formatted size under the file name */
  meta: string;
  loadFailed: string;
  actions: {
    download: string;
    editDetails: string;
    remove: string;
  };
  editDrawer: {
    title: string;
    titleLabel: string;
    descriptionLabel: string;
    cancel: string;
    save: string;
  };
  notifications: {
    downloadFailed: { title: string; message: string };
    saved: { title: string; message: string };
    updateFailed: { title: string; message: string };
  };
}

export const fileDefaults: FileTranslations = {
  placeholder: 'No file selected',
  readOnly: 'Read only',
  disabled: 'Disabled',
  meta: '{type} • {size}',
  loadFailed: 'Failed to load file',
  actions: {
    download: 'Download',
    editDetails: 'Edit details',
    remove: 'Remove',
  },
  editDrawer: {
    title: 'Edit File Details',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    cancel: 'Cancel',
    save: 'Save',
  },
  notifications: {
    downloadFailed: { title: 'Download failed', message: 'Unable to download file' },
    saved: { title: 'Saved', message: 'File details updated' },
    updateFailed: { title: 'Error', message: 'Failed to update file details' },
  },
};

export const fileId: FileTranslations = {
  placeholder: 'Belum ada berkas dipilih',
  readOnly: 'Hanya baca',
  disabled: 'Nonaktif',
  meta: '{type} • {size}',
  loadFailed: 'Gagal memuat berkas',
  actions: {
    download: 'Unduh',
    editDetails: 'Ubah detail',
    remove: 'Hapus',
  },
  editDrawer: {
    title: 'Ubah Detail Berkas',
    titleLabel: 'Judul',
    descriptionLabel: 'Deskripsi',
    cancel: 'Batal',
    save: 'Simpan',
  },
  notifications: {
    downloadFailed: { title: 'Unduhan gagal', message: 'Tidak dapat mengunduh berkas' },
    saved: { title: 'Tersimpan', message: 'Detail berkas diperbarui' },
    updateFailed: { title: 'Kesalahan', message: 'Gagal memperbarui detail berkas' },
  },
};
