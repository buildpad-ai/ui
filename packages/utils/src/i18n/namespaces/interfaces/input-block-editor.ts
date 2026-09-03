/**
 * `interfaces.inputBlockEditor` — strings of the InputBlockEditor interface.
 *
 * `editor` is wired into EditorJS's own `i18n.messages` config (the only way
 * its toolbox, tunes and tool placeholders can be translated). EditorJS keys
 * its dictionary by the English string; the component maps these keys onto
 * that shape, so the values here are what the editor shows.
 */
export interface InputBlockEditorTranslations {
  placeholder: string;
  editor: {
    /** EditorJS chrome (`ui` section) */
    ui: {
      clickToTune: string;
      orDragToMove: string;
      convertTo: string;
      add: string;
      filter: string;
      nothingFound: string;
    };
    /** Toolbox names of the bundled tools (`toolNames` section) */
    toolNames: {
      text: string;
      heading: string;
      list: string;
      code: string;
      quote: string;
      checklist: string;
      delimiter: string;
      table: string;
      underline: string;
      inlineCode: string;
    };
    /** Block settings menu (`blockTunes` section) */
    blockTunes: {
      delete: string;
      clickToDelete: string;
      moveUp: string;
      moveDown: string;
    };
    /** Strings the bundled tools ask for through `api.i18n.t()` (`tools` section) */
    tools: {
      quote: { enterQuote: string; enterCaption: string };
      code: { enterCode: string };
      list: { ordered: string; unordered: string };
      table: {
        addColumnLeft: string;
        addColumnRight: string;
        deleteColumn: string;
        addRowAbove: string;
        addRowBelow: string;
        deleteRow: string;
        withHeadings: string;
        withoutHeadings: string;
        heading: string;
        collapse: string;
        stretch: string;
      };
    };
  };
}

export const inputBlockEditorDefaults: InputBlockEditorTranslations = {
  placeholder: 'Start writing or press Tab to add a block...',
  editor: {
    ui: {
      clickToTune: 'Click to tune',
      orDragToMove: 'or drag to move',
      convertTo: 'Convert to',
      add: 'Add',
      filter: 'Filter',
      nothingFound: 'Nothing found',
    },
    toolNames: {
      text: 'Text',
      heading: 'Heading',
      list: 'List',
      code: 'Code',
      quote: 'Quote',
      checklist: 'Checklist',
      delimiter: 'Delimiter',
      table: 'Table',
      underline: 'Underline',
      inlineCode: 'InlineCode',
    },
    blockTunes: {
      delete: 'Delete',
      clickToDelete: 'Click to delete',
      moveUp: 'Move up',
      moveDown: 'Move down',
    },
    tools: {
      quote: { enterQuote: 'Enter a quote', enterCaption: 'Enter a caption' },
      code: { enterCode: 'Enter a code' },
      list: { ordered: 'Ordered', unordered: 'Unordered' },
      table: {
        addColumnLeft: 'Add column to left',
        addColumnRight: 'Add column to right',
        deleteColumn: 'Delete column',
        addRowAbove: 'Add row above',
        addRowBelow: 'Add row below',
        deleteRow: 'Delete row',
        withHeadings: 'With headings',
        withoutHeadings: 'Without headings',
        heading: 'Heading',
        collapse: 'Collapse',
        stretch: 'Stretch',
      },
    },
  },
};

export const inputBlockEditorId: InputBlockEditorTranslations = {
  placeholder: 'Mulai menulis atau tekan Tab untuk menambah blok...',
  editor: {
    ui: {
      clickToTune: 'Klik untuk mengatur',
      orDragToMove: 'atau seret untuk memindahkan',
      convertTo: 'Ubah menjadi',
      add: 'Tambah',
      filter: 'Saring',
      nothingFound: 'Tidak ada yang ditemukan',
    },
    toolNames: {
      text: 'Teks',
      heading: 'Judul',
      list: 'Daftar',
      code: 'Kode',
      quote: 'Kutipan',
      checklist: 'Daftar centang',
      delimiter: 'Pemisah',
      table: 'Tabel',
      underline: 'Garis bawah',
      inlineCode: 'Kode sebaris',
    },
    blockTunes: {
      delete: 'Hapus',
      clickToDelete: 'Klik untuk menghapus',
      moveUp: 'Pindah ke atas',
      moveDown: 'Pindah ke bawah',
    },
    tools: {
      quote: { enterQuote: 'Masukkan kutipan', enterCaption: 'Masukkan keterangan' },
      code: { enterCode: 'Masukkan kode' },
      list: { ordered: 'Bernomor', unordered: 'Tanpa nomor' },
      table: {
        addColumnLeft: 'Tambah kolom di kiri',
        addColumnRight: 'Tambah kolom di kanan',
        deleteColumn: 'Hapus kolom',
        addRowAbove: 'Tambah baris di atas',
        addRowBelow: 'Tambah baris di bawah',
        deleteRow: 'Hapus baris',
        withHeadings: 'Dengan judul',
        withoutHeadings: 'Tanpa judul',
        heading: 'Judul',
        collapse: 'Ciutkan',
        stretch: 'Rentangkan',
      },
    },
  },
};
