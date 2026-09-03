/** `interfaces.upload` — strings of the Upload interface and the shared LibraryPickerModal. */
import type { PluralForms } from '../../primitives';

export interface UploadTranslations {
  /** `LibraryPickerModal` — the "Choose from library" browser */
  library: {
    /** Default modal title (the `title` prop overrides it) */
    title: string;
    loadError: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    clearSearch: string;
    layoutAriaLabel: string;
    gridView: string;
    listView: string;
    /** Root crumb of the folder breadcrumb */
    breadcrumbRoot: string;
    loading: string;
    /** 'No files match "{search}"' */
    noMatch: string;
    empty: string;
    /** aria-label of a folder tile: "Open folder {name}" */
    openFolder: string;
    /** Type label of a folder entry */
    folder: string;
    /** aria-label of a file tile: "Select {name}" */
    selectFile: string;
    columns: {
      name: string;
      type: string;
      size: string;
    };
    /** "Showing {start}–{end}" (filtered — total unknown) */
    showingRange: string;
    /** "Showing {start}–{end} of {total}" */
    showingRangeOfTotal: string;
    filesPerPage: string;
    /** "{count} / page" page-size option */
    perPageOption: string;
    previous: string;
    /** "Page {page}" */
    pageNumber: string;
    next: string;
  };
  /** File category badge labels (`getFileCategory` keys) */
  categories: {
    image: string;
    document: string;
    audio: string;
    video: string;
    archive: string;
    code: string;
    other: string;
  };
  notifications: {
    uploadComplete: {
      title: string;
      /** "Successfully uploaded {count} file(s)" */
      message: PluralForms;
    };
    uploadFailed: {
      title: string;
      message: string;
    };
    importComplete: {
      title: string;
      message: string;
    };
    importFailed: {
      title: string;
      message: string;
    };
  };
  dropzone: {
    uploading: string;
    dropHere: string;
    dragHint: string;
    /** "Accepts: {accept}" */
    accepts: string;
    acceptsAll: string;
  };
  actions: {
    fromDevice: string;
    fromLibrary: string;
    fromUrl: string;
  };
  urlDialog: {
    title: string;
    urlLabel: string;
    urlPlaceholder: string;
    cancel: string;
    import: string;
  };
}

export const uploadDefaults: UploadTranslations = {
  library: {
    title: 'Choose from library',
    loadError: 'Failed to load files from the library',
    searchPlaceholder: 'Search files...',
    searchAriaLabel: 'Search files',
    clearSearch: 'Clear search',
    layoutAriaLabel: 'Library layout',
    gridView: 'Grid view',
    listView: 'List view',
    breadcrumbRoot: 'Library',
    loading: 'Loading files...',
    noMatch: 'No files match "{search}"',
    empty: 'No files found',
    openFolder: 'Open folder {name}',
    folder: 'Folder',
    selectFile: 'Select {name}',
    columns: {
      name: 'Name',
      type: 'Type',
      size: 'Size',
    },
    showingRange: 'Showing {start}–{end}',
    showingRangeOfTotal: 'Showing {start}–{end} of {total}',
    filesPerPage: 'Files per page',
    perPageOption: '{count} / page',
    previous: 'Previous',
    pageNumber: 'Page {page}',
    next: 'Next',
  },
  categories: {
    image: 'image',
    document: 'document',
    audio: 'audio',
    video: 'video',
    archive: 'archive',
    code: 'code',
    other: 'other',
  },
  notifications: {
    uploadComplete: {
      title: 'Upload complete',
      message: { other: 'Successfully uploaded {count} file(s)' },
    },
    uploadFailed: {
      title: 'Upload failed',
      message: 'Failed to upload files',
    },
    importComplete: {
      title: 'Import complete',
      message: 'File imported successfully',
    },
    importFailed: {
      title: 'Import failed',
      message: 'Failed to import from URL',
    },
  },
  dropzone: {
    uploading: 'Uploading...',
    dropHere: 'Drop files here',
    dragHint: 'Drag files here or click to select',
    accepts: 'Accepts: {accept}',
    acceptsAll: 'All file types accepted',
  },
  actions: {
    fromDevice: 'Upload from device',
    fromLibrary: 'Choose from library',
    fromUrl: 'Import from URL',
  },
  urlDialog: {
    title: 'Import from URL',
    urlLabel: 'File URL',
    urlPlaceholder: 'https://example.com/file.jpg',
    cancel: 'Cancel',
    import: 'Import',
  },
};

export const uploadId: UploadTranslations = {
  library: {
    title: 'Pilih dari pustaka',
    loadError: 'Gagal memuat berkas dari pustaka',
    searchPlaceholder: 'Cari berkas...',
    searchAriaLabel: 'Cari berkas',
    clearSearch: 'Bersihkan pencarian',
    layoutAriaLabel: 'Tata letak pustaka',
    gridView: 'Tampilan kisi',
    listView: 'Tampilan daftar',
    breadcrumbRoot: 'Pustaka',
    loading: 'Memuat berkas...',
    noMatch: 'Tidak ada berkas yang cocok dengan "{search}"',
    empty: 'Tidak ada berkas ditemukan',
    openFolder: 'Buka folder {name}',
    folder: 'Folder',
    selectFile: 'Pilih {name}',
    columns: {
      name: 'Nama',
      type: 'Tipe',
      size: 'Ukuran',
    },
    showingRange: 'Menampilkan {start}–{end}',
    showingRangeOfTotal: 'Menampilkan {start}–{end} dari {total}',
    filesPerPage: 'Berkas per halaman',
    perPageOption: '{count} / halaman',
    previous: 'Sebelumnya',
    pageNumber: 'Halaman {page}',
    next: 'Berikutnya',
  },
  categories: {
    image: 'gambar',
    document: 'dokumen',
    audio: 'audio',
    video: 'video',
    archive: 'arsip',
    code: 'kode',
    other: 'lainnya',
  },
  notifications: {
    uploadComplete: {
      title: 'Unggahan selesai',
      message: { other: 'Berhasil mengunggah {count} berkas' },
    },
    uploadFailed: {
      title: 'Unggahan gagal',
      message: 'Gagal mengunggah berkas',
    },
    importComplete: {
      title: 'Impor selesai',
      message: 'Berkas berhasil diimpor',
    },
    importFailed: {
      title: 'Impor gagal',
      message: 'Gagal mengimpor dari URL',
    },
  },
  dropzone: {
    uploading: 'Mengunggah...',
    dropHere: 'Lepaskan berkas di sini',
    dragHint: 'Seret berkas ke sini atau klik untuk memilih',
    accepts: 'Menerima: {accept}',
    acceptsAll: 'Semua tipe berkas diterima',
  },
  actions: {
    fromDevice: 'Unggah dari perangkat',
    fromLibrary: 'Pilih dari pustaka',
    fromUrl: 'Impor dari URL',
  },
  urlDialog: {
    title: 'Impor dari URL',
    urlLabel: 'URL Berkas',
    urlPlaceholder: 'https://contoh.com/berkas.jpg',
    cancel: 'Batal',
    import: 'Impor',
  },
};
