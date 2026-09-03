/** `interfaces.fileImage` — strings of the FileImage interface. */
export interface FileImageTranslations {
  /** Text under the uploader while nothing is selected (the `placeholder` prop overrides it) */
  placeholder: string;
  /** Shown in the disabled box when the field is not disabled but nothing can be selected */
  noImage: string;
  disabled: string;
  /** Badge next to the label in read-only mode */
  readOnly: string;
  noPreview: string;
  /** Pieces of the metadata line "{width}×{height} • {size} KB • {type}" */
  meta: {
    /** "{size} KB" */
    kilobytes: string;
    /** "{width}×{height}" */
    dimensions: string;
    /** Joins the present pieces */
    separator: string;
  };
  errors: {
    tooLarge: string;
    loadFailed: string;
    unsupportedMedia: string;
    canvasNotSupported: string;
  };
  /** Tooltips of the hover actions over the preview */
  actions: {
    zoom: string;
    download: string;
    editDetails: string;
    editImage: string;
    deselect: string;
  };
  lightbox: {
    title: string;
    download: string;
  };
  editModal: {
    title: string;
    titleLabel: string;
    descriptionLabel: string;
    cancel: string;
    save: string;
  };
  editor: {
    title: string;
    rotation: string;
    /** "{value}°" */
    degrees: string;
    crop: string;
    squareCrop: string;
    squareCropActive: string;
    cancel: string;
    apply: string;
  };
  notifications: {
    /** message: "Downloading {name}" */
    downloadStarted: { title: string; message: string };
    downloadFailed: { title: string; message: string };
    saved: { title: string; message: string };
    updateFailed: { title: string; message: string };
    editsApplied: { title: string; message: string };
    editFailed: { title: string; message: string };
  };
}

export const fileImageDefaults: FileImageTranslations = {
  placeholder: 'No image selected',
  noImage: 'No image selected',
  disabled: 'Disabled',
  readOnly: 'Read only',
  noPreview: 'No preview available',
  meta: {
    kilobytes: '{size} KB',
    dimensions: '{width}×{height}',
    separator: ' • ',
  },
  errors: {
    tooLarge: 'Image too large to preview',
    loadFailed: 'Failed to load image',
    unsupportedMedia: 'Unsupported media type',
    canvasNotSupported: 'Canvas not supported',
  },
  actions: {
    zoom: 'Zoom',
    download: 'Download',
    editDetails: 'Edit details',
    editImage: 'Edit image',
    deselect: 'Deselect',
  },
  lightbox: {
    title: 'Image Preview',
    download: 'Download',
  },
  editModal: {
    title: 'Edit Image Details',
    titleLabel: 'Title',
    descriptionLabel: 'Description',
    cancel: 'Cancel',
    save: 'Save',
  },
  editor: {
    title: 'Edit Image',
    rotation: 'Rotation',
    degrees: '{value}°',
    crop: 'Crop',
    squareCrop: 'Square crop',
    squareCropActive: 'Square crop ✓',
    cancel: 'Cancel',
    apply: 'Apply Changes',
  },
  notifications: {
    downloadStarted: { title: 'Download started', message: 'Downloading {name}' },
    downloadFailed: { title: 'Download failed', message: 'Unable to download file' },
    saved: { title: 'Saved', message: 'Image details updated' },
    updateFailed: { title: 'Error', message: 'Failed to update image details' },
    editsApplied: { title: 'Image updated', message: 'Applied edits and saved new image' },
    editFailed: { title: 'Edit failed', message: 'Unable to apply edits' },
  },
};

export const fileImageId: FileImageTranslations = {
  placeholder: 'Belum ada gambar dipilih',
  noImage: 'Belum ada gambar dipilih',
  disabled: 'Nonaktif',
  readOnly: 'Hanya baca',
  noPreview: 'Pratinjau tidak tersedia',
  meta: {
    kilobytes: '{size} KB',
    dimensions: '{width}×{height}',
    separator: ' • ',
  },
  errors: {
    tooLarge: 'Gambar terlalu besar untuk dipratinjau',
    loadFailed: 'Gagal memuat gambar',
    unsupportedMedia: 'Jenis media tidak didukung',
    canvasNotSupported: 'Canvas tidak didukung',
  },
  actions: {
    zoom: 'Perbesar',
    download: 'Unduh',
    editDetails: 'Ubah detail',
    editImage: 'Ubah gambar',
    deselect: 'Batalkan pilihan',
  },
  lightbox: {
    title: 'Pratinjau Gambar',
    download: 'Unduh',
  },
  editModal: {
    title: 'Ubah Detail Gambar',
    titleLabel: 'Judul',
    descriptionLabel: 'Deskripsi',
    cancel: 'Batal',
    save: 'Simpan',
  },
  editor: {
    title: 'Ubah Gambar',
    rotation: 'Rotasi',
    degrees: '{value}°',
    crop: 'Potong',
    squareCrop: 'Potong persegi',
    squareCropActive: 'Potong persegi ✓',
    cancel: 'Batal',
    apply: 'Terapkan Perubahan',
  },
  notifications: {
    downloadStarted: { title: 'Unduhan dimulai', message: 'Mengunduh {name}' },
    downloadFailed: { title: 'Unduhan gagal', message: 'Tidak dapat mengunduh berkas' },
    saved: { title: 'Tersimpan', message: 'Detail gambar diperbarui' },
    updateFailed: { title: 'Kesalahan', message: 'Gagal memperbarui detail gambar' },
    editsApplied: { title: 'Gambar diperbarui', message: 'Perubahan diterapkan dan gambar baru disimpan' },
    editFailed: { title: 'Pengeditan gagal', message: 'Tidak dapat menerapkan perubahan' },
  },
};
