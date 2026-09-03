/** `interfaces.richTextMarkdown` — strings of the RichTextMarkdown interface. */
import {
  richTextEditorLabelsDefaults,
  richTextEditorLabelsId,
  type RichTextEditorLabelsTranslations,
} from './rich-text-html';

export interface RichTextMarkdownTranslations {
  /** Default editor placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  /** Shown until the Tiptap editor instance exists */
  loading: string;
  link: {
    /** `window.prompt` message when inserting a link */
    promptUrl: string;
  };
  image: {
    /** Alt text of an image inserted from the image dialog */
    defaultAlt: string;
  };
  toolbar: {
    heading1: string;
    heading2: string;
    heading3: string;
    insertTable: string;
    insertImage: string;
  };
  viewMode: {
    edit: string;
    source: string;
  };
  source: {
    /** aria-label of the raw-Markdown textarea */
    ariaLabel: string;
    /** "{label} (Markdown source)" */
    ariaLabelWithLabel: string;
  };
  tableDialog: {
    title: string;
    rows: string;
    rowsAriaLabel: string;
    columns: string;
    columnsAriaLabel: string;
    create: string;
    cancel: string;
  };
  dialog: {
    /** aria-label of the backdrop that closes an open dialog */
    closeAriaLabel: string;
  };
  imageDialog: {
    title: string;
    fileAriaLabel: string;
    cancel: string;
  };
  /** Mantine `RichTextEditor` toolbar labels */
  editor: RichTextEditorLabelsTranslations;
}

export const richTextMarkdownDefaults: RichTextMarkdownTranslations = {
  placeholder: 'Start typing...',
  loading: 'Loading editor...',
  link: {
    promptUrl: 'Enter URL',
  },
  image: {
    defaultAlt: 'Image',
  },
  toolbar: {
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    insertTable: 'Insert Table',
    insertImage: 'Insert Image',
  },
  viewMode: {
    edit: 'Edit',
    source: 'Source',
  },
  source: {
    ariaLabel: 'Markdown source',
    ariaLabelWithLabel: '{label} (Markdown source)',
  },
  tableDialog: {
    title: 'Create Table',
    rows: 'Rows',
    rowsAriaLabel: 'Number of rows',
    columns: 'Columns',
    columnsAriaLabel: 'Number of columns',
    create: 'Create',
    cancel: 'Cancel',
  },
  dialog: {
    closeAriaLabel: 'Close dialog',
  },
  imageDialog: {
    title: 'Insert Image',
    fileAriaLabel: 'Select image file',
    cancel: 'Cancel',
  },
  editor: richTextEditorLabelsDefaults,
};

export const richTextMarkdownId: RichTextMarkdownTranslations = {
  placeholder: 'Mulai mengetik...',
  loading: 'Memuat editor...',
  link: {
    promptUrl: 'Masukkan URL',
  },
  image: {
    defaultAlt: 'Gambar',
  },
  toolbar: {
    heading1: 'Judul 1',
    heading2: 'Judul 2',
    heading3: 'Judul 3',
    insertTable: 'Sisipkan Tabel',
    insertImage: 'Sisipkan Gambar',
  },
  viewMode: {
    edit: 'Ubah',
    source: 'Sumber',
  },
  source: {
    ariaLabel: 'Sumber Markdown',
    ariaLabelWithLabel: '{label} (sumber Markdown)',
  },
  tableDialog: {
    title: 'Buat Tabel',
    rows: 'Baris',
    rowsAriaLabel: 'Jumlah baris',
    columns: 'Kolom',
    columnsAriaLabel: 'Jumlah kolom',
    create: 'Buat',
    cancel: 'Batal',
  },
  dialog: {
    closeAriaLabel: 'Tutup dialog',
  },
  imageDialog: {
    title: 'Sisipkan Gambar',
    fileAriaLabel: 'Pilih berkas gambar',
    cancel: 'Batal',
  },
  editor: richTextEditorLabelsId,
};
