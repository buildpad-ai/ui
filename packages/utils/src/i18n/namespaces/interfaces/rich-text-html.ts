/** `interfaces.richTextHtml` — strings of the RichTextHTML interface. */

/**
 * Labels of Mantine's `RichTextEditor` toolbar and dialogs (its `labels`
 * prop), shared by the HTML and Markdown editors. The English defaults equal
 * Mantine's own `DEFAULT_LABELS`. The two colour labels are `{color}`
 * templates because the dictionary carries strings, not functions.
 */
export interface RichTextEditorLabelsTranslations {
  linkControlLabel: string;
  colorPickerControlLabel: string;
  highlightControlLabel: string;
  /** "Set text color {color}" */
  colorControlLabel: string;
  boldControlLabel: string;
  italicControlLabel: string;
  underlineControlLabel: string;
  strikeControlLabel: string;
  clearFormattingControlLabel: string;
  unlinkControlLabel: string;
  bulletListControlLabel: string;
  orderedListControlLabel: string;
  sourceCodeControlLabel: string;
  h1ControlLabel: string;
  h2ControlLabel: string;
  h3ControlLabel: string;
  h4ControlLabel: string;
  h5ControlLabel: string;
  h6ControlLabel: string;
  blockquoteControlLabel: string;
  alignLeftControlLabel: string;
  alignCenterControlLabel: string;
  alignRightControlLabel: string;
  alignJustifyControlLabel: string;
  codeControlLabel: string;
  codeBlockControlLabel: string;
  subscriptControlLabel: string;
  superscriptControlLabel: string;
  unsetColorControlLabel: string;
  hrControlLabel: string;
  undoControlLabel: string;
  redoControlLabel: string;
  tasksControlLabel: string;
  tasksSinkLabel: string;
  tasksLiftLabel: string;
  linkEditorInputLabel: string;
  linkEditorInputPlaceholder: string;
  linkEditorExternalLink: string;
  linkEditorInternalLink: string;
  linkEditorSave: string;
  colorPickerCancel: string;
  colorPickerClear: string;
  colorPickerColorPicker: string;
  colorPickerPalette: string;
  colorPickerSave: string;
  /** "Set text color {color}" */
  colorPickerColorLabel: string;
}

export const richTextEditorLabelsDefaults: RichTextEditorLabelsTranslations = {
  linkControlLabel: 'Link',
  colorPickerControlLabel: 'Text color',
  highlightControlLabel: 'Highlight text',
  colorControlLabel: 'Set text color {color}',
  boldControlLabel: 'Bold',
  italicControlLabel: 'Italic',
  underlineControlLabel: 'Underline',
  strikeControlLabel: 'Strikethrough',
  clearFormattingControlLabel: 'Clear formatting',
  unlinkControlLabel: 'Remove link',
  bulletListControlLabel: 'Bullet list',
  orderedListControlLabel: 'Ordered list',
  sourceCodeControlLabel: 'Switch between text/source code',
  h1ControlLabel: 'Heading 1',
  h2ControlLabel: 'Heading 2',
  h3ControlLabel: 'Heading 3',
  h4ControlLabel: 'Heading 4',
  h5ControlLabel: 'Heading 5',
  h6ControlLabel: 'Heading 6',
  blockquoteControlLabel: 'Blockquote',
  alignLeftControlLabel: 'Align text: left',
  alignCenterControlLabel: 'Align text: center',
  alignRightControlLabel: 'Align text: right',
  alignJustifyControlLabel: 'Align text: justify',
  codeControlLabel: 'Code',
  codeBlockControlLabel: 'Code block',
  subscriptControlLabel: 'Subscript',
  superscriptControlLabel: 'Superscript',
  unsetColorControlLabel: 'Unset color',
  hrControlLabel: 'Horizontal line',
  undoControlLabel: 'Undo',
  redoControlLabel: 'Redo',
  tasksControlLabel: 'Task list',
  tasksSinkLabel: 'Decrease task level',
  tasksLiftLabel: 'Increase task level',
  linkEditorInputLabel: 'Enter URL',
  linkEditorInputPlaceholder: 'https://example.com/',
  linkEditorExternalLink: 'Open link in a new tab',
  linkEditorInternalLink: 'Open link in the same tab',
  linkEditorSave: 'Save',
  colorPickerCancel: 'Cancel',
  colorPickerClear: 'Clear color',
  colorPickerColorPicker: 'Color picker',
  colorPickerPalette: 'Color palette',
  colorPickerSave: 'Save',
  colorPickerColorLabel: 'Set text color {color}',
};

export const richTextEditorLabelsId: RichTextEditorLabelsTranslations = {
  linkControlLabel: 'Tautan',
  colorPickerControlLabel: 'Warna teks',
  highlightControlLabel: 'Sorot teks',
  colorControlLabel: 'Atur warna teks {color}',
  boldControlLabel: 'Tebal',
  italicControlLabel: 'Miring',
  underlineControlLabel: 'Garis bawah',
  strikeControlLabel: 'Coret',
  clearFormattingControlLabel: 'Hapus pemformatan',
  unlinkControlLabel: 'Hapus tautan',
  bulletListControlLabel: 'Daftar poin',
  orderedListControlLabel: 'Daftar bernomor',
  sourceCodeControlLabel: 'Beralih antara teks/kode sumber',
  h1ControlLabel: 'Judul 1',
  h2ControlLabel: 'Judul 2',
  h3ControlLabel: 'Judul 3',
  h4ControlLabel: 'Judul 4',
  h5ControlLabel: 'Judul 5',
  h6ControlLabel: 'Judul 6',
  blockquoteControlLabel: 'Kutipan',
  alignLeftControlLabel: 'Rata teks: kiri',
  alignCenterControlLabel: 'Rata teks: tengah',
  alignRightControlLabel: 'Rata teks: kanan',
  alignJustifyControlLabel: 'Rata teks: kiri-kanan',
  codeControlLabel: 'Kode',
  codeBlockControlLabel: 'Blok kode',
  subscriptControlLabel: 'Subskrip',
  superscriptControlLabel: 'Superskrip',
  unsetColorControlLabel: 'Hapus warna',
  hrControlLabel: 'Garis horizontal',
  undoControlLabel: 'Urungkan',
  redoControlLabel: 'Ulangi',
  tasksControlLabel: 'Daftar tugas',
  tasksSinkLabel: 'Turunkan level tugas',
  tasksLiftLabel: 'Naikkan level tugas',
  linkEditorInputLabel: 'Masukkan URL',
  linkEditorInputPlaceholder: 'https://contoh.com/',
  linkEditorExternalLink: 'Buka tautan di tab baru',
  linkEditorInternalLink: 'Buka tautan di tab yang sama',
  linkEditorSave: 'Simpan',
  colorPickerCancel: 'Batal',
  colorPickerClear: 'Hapus warna',
  colorPickerColorPicker: 'Pemilih warna',
  colorPickerPalette: 'Palet warna',
  colorPickerSave: 'Simpan',
  colorPickerColorLabel: 'Atur warna teks {color}',
};

export interface RichTextHtmlTranslations {
  /** Default editor placeholder (the `placeholder` prop overrides it) */
  placeholder: string;
  /** Shown until the Tiptap editor instance exists */
  loading: string;
  /** Mantine `RichTextEditor` toolbar labels */
  editor: RichTextEditorLabelsTranslations;
}

export const richTextHtmlDefaults: RichTextHtmlTranslations = {
  placeholder: 'Start typing...',
  loading: 'Loading editor...',
  editor: richTextEditorLabelsDefaults,
};

export const richTextHtmlId: RichTextHtmlTranslations = {
  placeholder: 'Mulai mengetik...',
  loading: 'Memuat editor...',
  editor: richTextEditorLabelsId,
};
