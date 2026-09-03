/**
 * `files` namespace — ui-files (FileManager, FileDetail, FilesGrid/List, FileMetadataForm, …).
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test
 * enforces it. Every `PluralForms` entry has `{count}` available; the
 * Indonesian catalog only needs `other` (one plural category).
 */
import type { PluralForms } from '../primitives';

export interface FilesTranslations {
  /** Marker shown in place of a missing value ("—") */
  emptyValue: string;
  /** Notification body when a caught error is not an `Error` */
  unknownError: string;
  /** Display labels for `getFileCategory()` values (rendered with CSS `text-transform: capitalize`) */
  fileCategory: {
    image: string;
    video: string;
    audio: string;
    document: string;
    archive: string;
    code: string;
    other: string;
  };
  bulkActionsBar: {
    /** "{count} selected" — plural */
    selectedCount: PluralForms;
    deleteSelectedTooltip: string;
    /** Title + aria-label of the clear button */
    clearSelection: string;
  };
  deleteConfirmModal: {
    title: string;
    /** "Are you sure you want to delete {count} {noun}? …" — plural; `{noun}` is resolved from `noun.*` */
    message: PluralForms;
    noun: {
      /** "file" / "files" — plural */
      file: PluralForms;
      /** "folder" / "folders" — plural */
      folder: PluralForms;
    };
  };
  fileCard: {
    /** "Select {filename}" */
    selectAriaLabel: string;
  };
  fileDetail: {
    backAriaLabel: string;
    notFound: string;
    /** Fallback for an empty MIME type in the header subtitle */
    unknownType: string;
    /** "{type} · {size}" */
    subtitle: string;
    tabs: {
      preview: string;
      details: string;
    };
    actions: {
      heading: string;
      openInNewTab: string;
      replaceFile: string;
    };
    notifications: {
      loadFailedTitle: string;
      saved: string;
      saveFailedTitle: string;
      replaced: string;
      replaceFailedTitle: string;
      deleted: string;
      deleteFailedTitle: string;
    };
  };
  fileInfoPanel: {
    heading: string;
    /** Copy tooltip */
    copyId: string;
    /** Copy tooltip after copying */
    copied: string;
    copyFileIdAriaLabel: string;
    /** "{id}…" — the first characters of the id */
    idTruncated: string;
    /** "{width} × {height} px" */
    dimensionsFormat: string;
    /** "{minutes}:{seconds}" — seconds are zero-padded */
    durationFormat: string;
    rows: {
      id: string;
      type: string;
      size: string;
      dimensions: string;
      duration: string;
      storage: string;
      uploaded: string;
      modified: string;
    };
  };
  fileManager: {
    emptyState: {
      title: string;
      /** Shown after `title` when the user may upload */
      uploadHint: string;
      /** Shown after `title` when the user may not upload */
      readOnlyHint: string;
    };
    pagination: {
      /** "Showing {from}–{to} of {total}" */
      showingOfTotal: string;
      /** "Showing {from}–{to}" — while the total is unknown */
      showingRange: string;
    };
    folderDialog: {
      createTitle: string;
      renameTitle: string;
      createSubmit: string;
      renameSubmit: string;
    };
    notifications: {
      loadFailedTitle: string;
      folderRenamed: string;
      /** "Folder “{name}” created" */
      folderCreated: string;
      renameFolderFailedTitle: string;
      createFolderFailedTitle: string;
      folderDeleted: string;
      fileDeleted: string;
      filesDeleted: string;
      deleteFailedTitle: string;
      downloadFailed: string;
      uploadComplete: string;
    };
  };
  fileMetadataForm: {
    title: { label: string; placeholder: string };
    description: { label: string; placeholder: string };
    tags: { label: string; placeholder: string };
    folder: { label: string; placeholder: string; nothingFound: string };
    location: { label: string; placeholder: string };
    downloadFilename: { label: string; description: string };
    focalPointX: { label: string; description: string };
    focalPointY: { label: string; description: string };
    save: string;
  };
  filePreview: {
    /** Fallback for an empty MIME type in the fallback preview */
    unknownType: string;
    /** "{type} · {size}" */
    subtitle: string;
  };
  filesList: {
    selectAllAriaLabel: string;
    /** "Select {filename}" */
    selectAriaLabel: string;
    fileActionsAriaLabel: string;
    /** Type cell of a folder row */
    folderType: string;
    columns: {
      name: string;
      type: string;
      size: string;
      uploaded: string;
    };
  };
  filesToolbar: {
    searchPlaceholder: string;
    newFolder: string;
    /** Visually hidden label of the grid toggle */
    gridView: string;
    /** Visually hidden label of the list toggle */
    listView: string;
  };
  folderBreadcrumb: {
    /** Root crumb (default `rootLabel`) */
    root: string;
  };
  folderCard: {
    folderActionsAriaLabel: string;
    rename: string;
  };
  newFolderDialog: {
    /** Default `title` prop */
    title: string;
    /** Default `submitLabel` prop */
    submitLabel: string;
    nameLabel: string;
    namePlaceholder: string;
  };
}

export const filesDefaults: FilesTranslations = {
  emptyValue: '—',
  unknownError: 'Unknown error',
  fileCategory: {
    image: 'image',
    video: 'video',
    audio: 'audio',
    document: 'document',
    archive: 'archive',
    code: 'code',
    other: 'other',
  },
  bulkActionsBar: {
    selectedCount: { one: '{count} selected', other: '{count} selected' },
    deleteSelectedTooltip: 'Delete selected',
    clearSelection: 'Clear selection',
  },
  deleteConfirmModal: {
    title: 'Confirm Delete',
    message: {
      one: 'Are you sure you want to delete {count} {noun}? This action cannot be undone.',
      other: 'Are you sure you want to delete {count} {noun}? This action cannot be undone.',
    },
    noun: {
      file: { one: 'file', other: 'files' },
      folder: { one: 'folder', other: 'folders' },
    },
  },
  fileCard: {
    selectAriaLabel: 'Select {filename}',
  },
  fileDetail: {
    backAriaLabel: 'Back',
    notFound: 'File not found.',
    unknownType: 'Unknown',
    subtitle: '{type} · {size}',
    tabs: {
      preview: 'Preview',
      details: 'Details',
    },
    actions: {
      heading: 'Actions',
      openInNewTab: 'Open in new tab',
      replaceFile: 'Replace file',
    },
    notifications: {
      loadFailedTitle: 'Failed to load file',
      saved: 'Changes saved',
      saveFailedTitle: 'Save failed',
      replaced: 'File replaced',
      replaceFailedTitle: 'Replace failed',
      deleted: 'File deleted',
      deleteFailedTitle: 'Delete failed',
    },
  },
  fileInfoPanel: {
    heading: 'File info',
    copyId: 'Copy ID',
    copied: 'Copied',
    copyFileIdAriaLabel: 'Copy file ID',
    idTruncated: '{id}…',
    dimensionsFormat: '{width} × {height} px',
    durationFormat: '{minutes}:{seconds}',
    rows: {
      id: 'ID',
      type: 'Type',
      size: 'Size',
      dimensions: 'Dimensions',
      duration: 'Duration',
      storage: 'Storage',
      uploaded: 'Uploaded',
      modified: 'Modified',
    },
  },
  fileManager: {
    emptyState: {
      title: 'No files here yet.',
      uploadHint: 'Drag files above or use the upload button to get started.',
      readOnlyHint: 'No files are available.',
    },
    pagination: {
      showingOfTotal: 'Showing {from}–{to} of {total}',
      showingRange: 'Showing {from}–{to}',
    },
    folderDialog: {
      createTitle: 'New Folder',
      renameTitle: 'Rename Folder',
      createSubmit: 'Create',
      renameSubmit: 'Rename',
    },
    notifications: {
      loadFailedTitle: 'Failed to load files',
      folderRenamed: 'Folder renamed',
      folderCreated: 'Folder “{name}” created',
      renameFolderFailedTitle: 'Could not rename folder',
      createFolderFailedTitle: 'Could not create folder',
      folderDeleted: 'Folder deleted',
      fileDeleted: 'File deleted',
      filesDeleted: 'Files deleted',
      deleteFailedTitle: 'Delete failed',
      downloadFailed: 'Could not start download',
      uploadComplete: 'Upload complete',
    },
  },
  fileMetadataForm: {
    title: { label: 'Title', placeholder: 'Display name' },
    description: { label: 'Description', placeholder: 'Free-text description' },
    tags: { label: 'Tags', placeholder: 'Add tag and press Enter' },
    folder: { label: 'Folder', placeholder: 'Root', nothingFound: 'No folders' },
    location: { label: 'Location', placeholder: 'Optional location' },
    downloadFilename: {
      label: 'Download filename',
      description: 'Filename used when the file is downloaded',
    },
    focalPointX: { label: 'Focal point X', description: 'Crop center (px)' },
    focalPointY: { label: 'Focal point Y', description: 'Crop center (px)' },
    save: 'Save',
  },
  filePreview: {
    unknownType: 'Unknown type',
    subtitle: '{type} · {size}',
  },
  filesList: {
    selectAllAriaLabel: 'Select all files',
    selectAriaLabel: 'Select {filename}',
    fileActionsAriaLabel: 'File actions',
    folderType: 'Folder',
    columns: {
      name: 'Name',
      type: 'Type',
      size: 'Size',
      uploaded: 'Uploaded',
    },
  },
  filesToolbar: {
    searchPlaceholder: 'Search files…',
    newFolder: 'New Folder',
    gridView: 'Grid view',
    listView: 'List view',
  },
  folderBreadcrumb: {
    root: 'Files',
  },
  folderCard: {
    folderActionsAriaLabel: 'Folder actions',
    rename: 'Rename',
  },
  newFolderDialog: {
    title: 'New Folder',
    submitLabel: 'Create',
    nameLabel: 'Folder name',
    namePlaceholder: 'My folder',
  },
};

export const filesId: FilesTranslations = {
  emptyValue: '—',
  unknownError: 'Kesalahan tidak diketahui',
  fileCategory: {
    image: 'gambar',
    video: 'video',
    audio: 'audio',
    document: 'dokumen',
    archive: 'arsip',
    code: 'kode',
    other: 'lainnya',
  },
  bulkActionsBar: {
    selectedCount: { other: '{count} dipilih' },
    deleteSelectedTooltip: 'Hapus yang dipilih',
    clearSelection: 'Bersihkan pilihan',
  },
  deleteConfirmModal: {
    title: 'Konfirmasi Hapus',
    message: {
      other: 'Yakin ingin menghapus {count} {noun}? Tindakan ini tidak dapat dibatalkan.',
    },
    noun: {
      file: { other: 'berkas' },
      folder: { other: 'folder' },
    },
  },
  fileCard: {
    selectAriaLabel: 'Pilih {filename}',
  },
  fileDetail: {
    backAriaLabel: 'Kembali',
    notFound: 'Berkas tidak ditemukan.',
    unknownType: 'Tidak diketahui',
    subtitle: '{type} · {size}',
    tabs: {
      preview: 'Pratinjau',
      details: 'Detail',
    },
    actions: {
      heading: 'Aksi',
      openInNewTab: 'Buka di tab baru',
      replaceFile: 'Ganti berkas',
    },
    notifications: {
      loadFailedTitle: 'Gagal memuat berkas',
      saved: 'Perubahan disimpan',
      saveFailedTitle: 'Gagal menyimpan',
      replaced: 'Berkas diganti',
      replaceFailedTitle: 'Gagal mengganti berkas',
      deleted: 'Berkas dihapus',
      deleteFailedTitle: 'Gagal menghapus',
    },
  },
  fileInfoPanel: {
    heading: 'Info berkas',
    copyId: 'Salin ID',
    copied: 'Tersalin',
    copyFileIdAriaLabel: 'Salin ID berkas',
    idTruncated: '{id}…',
    dimensionsFormat: '{width} × {height} px',
    durationFormat: '{minutes}:{seconds}',
    rows: {
      id: 'ID',
      type: 'Tipe',
      size: 'Ukuran',
      dimensions: 'Dimensi',
      duration: 'Durasi',
      storage: 'Penyimpanan',
      uploaded: 'Diunggah',
      modified: 'Diubah',
    },
  },
  fileManager: {
    emptyState: {
      title: 'Belum ada berkas di sini.',
      uploadHint: 'Seret berkas ke area di atas atau gunakan tombol unggah untuk memulai.',
      readOnlyHint: 'Tidak ada berkas yang tersedia.',
    },
    pagination: {
      showingOfTotal: 'Menampilkan {from}–{to} dari {total}',
      showingRange: 'Menampilkan {from}–{to}',
    },
    folderDialog: {
      createTitle: 'Folder Baru',
      renameTitle: 'Ubah Nama Folder',
      createSubmit: 'Buat',
      renameSubmit: 'Ubah Nama',
    },
    notifications: {
      loadFailedTitle: 'Gagal memuat berkas',
      folderRenamed: 'Nama folder diubah',
      folderCreated: 'Folder “{name}” dibuat',
      renameFolderFailedTitle: 'Tidak dapat mengubah nama folder',
      createFolderFailedTitle: 'Tidak dapat membuat folder',
      folderDeleted: 'Folder dihapus',
      fileDeleted: 'Berkas dihapus',
      filesDeleted: 'Berkas yang dipilih dihapus',
      deleteFailedTitle: 'Gagal menghapus',
      downloadFailed: 'Tidak dapat memulai unduhan',
      uploadComplete: 'Unggahan selesai',
    },
  },
  fileMetadataForm: {
    title: { label: 'Judul', placeholder: 'Nama tampilan' },
    description: { label: 'Deskripsi', placeholder: 'Deskripsi bebas' },
    tags: { label: 'Tag', placeholder: 'Tambahkan tag lalu tekan Enter' },
    folder: { label: 'Folder', placeholder: 'Folder utama', nothingFound: 'Tidak ada folder' },
    location: { label: 'Lokasi', placeholder: 'Lokasi (opsional)' },
    downloadFilename: {
      label: 'Nama berkas unduhan',
      description: 'Nama berkas yang dipakai saat berkas diunduh',
    },
    focalPointX: { label: 'Titik fokus X', description: 'Pusat potongan (px)' },
    focalPointY: { label: 'Titik fokus Y', description: 'Pusat potongan (px)' },
    save: 'Simpan',
  },
  filePreview: {
    unknownType: 'Tipe tidak diketahui',
    subtitle: '{type} · {size}',
  },
  filesList: {
    selectAllAriaLabel: 'Pilih semua berkas',
    selectAriaLabel: 'Pilih {filename}',
    fileActionsAriaLabel: 'Aksi berkas',
    folderType: 'Folder',
    columns: {
      name: 'Nama',
      type: 'Tipe',
      size: 'Ukuran',
      uploaded: 'Diunggah',
    },
  },
  filesToolbar: {
    searchPlaceholder: 'Cari berkas…',
    newFolder: 'Folder Baru',
    gridView: 'Tampilan kisi',
    listView: 'Tampilan daftar',
  },
  folderBreadcrumb: {
    root: 'Berkas',
  },
  folderCard: {
    folderActionsAriaLabel: 'Aksi folder',
    rename: 'Ubah nama',
  },
  newFolderDialog: {
    title: 'Folder Baru',
    submitLabel: 'Buat',
    nameLabel: 'Nama folder',
    namePlaceholder: 'Folder saya',
  },
};
