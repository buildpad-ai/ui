/**
 * `forms` namespace — ui-forms (FormBuilder chrome only — authored form content is data).
 *
 * Keys are grouped by component. Field names, collection names, interface ids
 * and everything the author types stay data; only the builder's own chrome
 * lives here. Keep the defaults and the Indonesian catalog in step — the parity
 * test enforces it.
 */
import type { PluralForms } from '../primitives';

export interface FormsTranslations {
  /**
   * Display labels of the provisionable-interface catalog
   * (`PROVISIONABLE_INTERFACES` in `@buildpad/utils`). `label` is keyed by the
   * camelCased interface id (`select-multiple-checkbox-tree` →
   * `selectMultipleCheckboxTree`); `group` by the camelCased group name.
   */
  interfaceCatalog: {
    label: {
      input: string;
      inputMultiline: string;
      inputCode: string;
      inputHash: string;
      tags: string;
      inputRichTextHtml: string;
      inputRichTextMd: string;
      inputBlockEditor: string;
      selectDropdown: string;
      selectRadio: string;
      selectMultipleCheckbox: string;
      selectMultipleCheckboxTree: string;
      selectMultipleDropdown: string;
      selectIcon: string;
      selectColor: string;
      boolean: string;
      toggle: string;
      slider: string;
      datetime: string;
      map: string;
    };
    group: {
      text: string;
      richContent: string;
      selection: string;
      numericAndDate: string;
      geospatial: string;
    };
  };
  /** field-name.ts — validation messages of a new field's column key */
  fieldName: {
    error: {
      required: string;
      invalidPattern: string;
      duplicate: string;
    };
  };
  addFieldModal: {
    title: string;
    label: { label: string; placeholder: string };
    fieldKey: { label: string; description: string; placeholder: string };
    type: { label: string };
    /** Labels of the scalar field types the builder can provision */
    typeOptions: {
      string: string;
      text: string;
      integer: string;
      bigInteger: string;
      float: string;
      decimal: string;
      boolean: string;
      date: string;
      time: string;
      dateTime: string;
      json: string;
      csv: string;
    };
    interface: {
      label: string;
      description: string;
      /** "Auto ({interface})" — `{interface}` is the renderer interface id */
      autoOption: string;
    };
    storage: {
      title: string;
      column: string;
      extras: string;
      columnHint: string;
      extrasHint: string;
      noSchemaRights: string;
      fullNoRights: string;
      fullHint: string;
    };
    required: { label: string };
    index: { label: string; description: string };
    error: { createFailed: string };
    cancel: string;
    submitColumn: string;
    submitExtras: string;
  };
  builderCanvas: {
    emptyState: string;
    addSection: string;
  };
  builderFieldRow: {
    /** aria-label of the drag handle */
    dragHandle: string;
    /** tooltip + aria-label of the remove action */
    remove: string;
    hiddenTooltip: string;
    badge: {
      missing: string;
      extra: string;
      required: string;
      /** "{count} cond" — plural */
      conditions: PluralForms;
      width: { half: string; full: string };
    };
  };
  builderSection: {
    dragHandle: string;
    titlePlaceholder: string;
    remove: string;
    emptyState: string;
  };
  choicesInput: {
    label: string;
    description: string;
    /** Multi-line example, one choice per line */
    placeholder: string;
  };
  conditionsEditor: {
    /** "Condition {number}" — default name of a new condition */
    defaultName: string;
    title: string;
    add: string;
    emptyState: string;
    precedenceHint: string;
    name: { label: string; placeholder: string };
    remove: string;
    when: string;
    then: string;
    overrides: { hidden: string; required: string; readonly: string };
  };
  dynamicForm: {
    error: { title: string; loadFailed: string; notFound: string };
  };
  fieldPalette: {
    title: string;
    searchPlaceholder: string;
    catalog: { title: string; noMatch: string };
    addExtraField: string;
    existing: {
      title: string;
      emptyWithCatalog: string;
      allPlaced: string;
      noMatch: string;
    };
  };
  fieldSettingsPanel: {
    /** "{field} · {type}" — column key and type badge */
    fieldBadge: string;
    newColumnLocked: string;
    newLabel: { label: string; description: string };
    width: { title: string; half: string; full: string };
    overrides: { required: string; readonly: string; hidden: string };
    noteOverride: { label: string; description: string };
  };
  formBuilder: {
    /** Title of the section created automatically for the first field */
    defaultSectionTitle: string;
    /** "Section {number}" — title of a section added by the author */
    newSectionTitle: string;
    /** Name used when the author saves without entering one */
    untitledForm: string;
    error: {
      loadDefinitionFailed: string;
      loadSchemaFailed: string;
      saveFailed: string;
      noTargetNoRights: string;
    };
    notify: {
      /** {column} {collection} */
      extrasAdded: { title: string; message: string };
      /** {label} {collection} */
      fieldCreated: { title: string; message: string };
      /** {key} */
      invalidFieldName: { title: string; message: string };
      /** {label} */
      choicesRequired: { title: string; message: string };
      nameRequired: { title: string; message: string };
      /** {collection} {count} — plural; English keeps the original "field(s)" wording */
      collectionCreated: { title: string; message: PluralForms };
      /** {count} {collection} — plural; English keeps the original "field(s)" wording */
      fieldsAdded: { title: string; message: PluralForms };
      /** {name} */
      saved: { title: string; message: string };
      saveFailed: { title: string };
    };
    dragOverlay: { newField: string; section: string };
    /** {collection} */
    noPermission: { title: string; message: string };
    name: { label: string; placeholder: string };
    key: { label: string; description: string; placeholder: string };
    save: string;
    /** "Target collection: {collection}" */
    targetCollection: string;
    /** "{prefix}" is the literal `fb_` collection prefix */
    autoCreateHint: string;
    tabs: { build: string; preview: string };
    settingsEmptyState: string;
  };
  formPreview: {
    emptyState: string;
    offlineHint: string;
    boundHint: string;
  };
  formsEmptyState: {
    title: string;
    /** {collection} */
    intro: string;
    introCanCreate: string;
    introManual: string;
    /** "{field} — …" — `{field}` is the column key rendered as code */
    fields: {
      id: string;
      name: string;
      targetCollection: string;
      key: string;
      definition: string;
    };
    /** "{prefix}" is the literal `daas_` system prefix */
    systemPrefixWarning: string;
    reloadHint: string;
    createCollection: string;
    error: { createFailed: string };
  };
  nameFieldModal: {
    title: string;
    /** "New {interfaceLabel} field" */
    interfaceHint: string;
    columnName: { label: string; description: string; placeholder: string };
    /** "Column: {fieldKey}" */
    derivedKey: string;
    cancel: string;
    submit: string;
  };
}

export const formsDefaults: FormsTranslations = {
  interfaceCatalog: {
    label: {
      input: 'Text input',
      inputMultiline: 'Multiline text',
      inputCode: 'Code / JSON',
      inputHash: 'Hash (masked)',
      tags: 'Tags',
      inputRichTextHtml: 'Rich text (WYSIWYG)',
      inputRichTextMd: 'Rich text (Markdown)',
      inputBlockEditor: 'Block editor',
      selectDropdown: 'Dropdown (choices)',
      selectRadio: 'Radio (choices)',
      selectMultipleCheckbox: 'Checkboxes (multiple)',
      selectMultipleCheckboxTree: 'Checkboxes (tree)',
      selectMultipleDropdown: 'Multi-select dropdown',
      selectIcon: 'Icon picker',
      selectColor: 'Color picker',
      boolean: 'Checkbox',
      toggle: 'Toggle',
      slider: 'Slider',
      datetime: 'Date / time picker',
      map: 'Map (geometry)',
    },
    group: {
      text: 'Text',
      richContent: 'Rich content',
      selection: 'Selection',
      numericAndDate: 'Numeric & date',
      geospatial: 'Geospatial',
    },
  },
  fieldName: {
    error: {
      required: 'A field name is required',
      invalidPattern: 'Use lowercase letters, numbers and underscores (start with a letter)',
      duplicate: 'A field with this name already exists',
    },
  },
  addFieldModal: {
    title: 'Add a field',
    label: { label: 'Label', placeholder: 'e.g. Steps to reproduce' },
    fieldKey: {
      label: 'Field key',
      description: 'Column / property name (snake_case)',
      placeholder: 'steps_to_reproduce',
    },
    type: { label: 'Type' },
    typeOptions: {
      string: 'Text (short)',
      text: 'Text (long)',
      integer: 'Number (integer)',
      bigInteger: 'Number (big integer)',
      float: 'Number (decimal)',
      decimal: 'Number (fixed decimal)',
      boolean: 'Boolean',
      date: 'Date',
      time: 'Time',
      dateTime: 'Date & time',
      json: 'JSON',
      csv: 'CSV (list of values)',
    },
    interface: {
      label: 'Interface',
      description: 'Only interfaces compatible with the type',
      autoOption: 'Auto ({interface})',
    },
    storage: {
      title: 'Storage',
      column: 'Real column',
      extras: 'Extra (jsonb)',
      columnHint: 'A real, searchable/sortable DaaS column provisioned via the schema API.',
      extrasHint:
        'Stored in the collection’s extras jsonb column — not server-searchable or individually permissioned.',
      noSchemaRights:
        'Real-column provisioning needs DaaS schema rights, which you don’t have — new fields are stored as extras.',
      fullNoRights:
        'This full-storage collection has no extras tail, and adding a real column needs DaaS schema rights you don’t have.',
      fullHint:
        'Full-storage collection — every field is a real, searchable DaaS column (no extras tail).',
    },
    required: { label: 'Required' },
    index: {
      label: 'Index this column',
      description: 'Create a B-tree index — pick this if the field will be filtered or sorted.',
    },
    error: { createFailed: 'Failed to create the field' },
    cancel: 'Cancel',
    submitColumn: 'Create field',
    submitExtras: 'Add extra field',
  },
  builderCanvas: {
    emptyState: 'Add a section, then drag fields from the palette to start building the form.',
    addSection: 'Add section',
  },
  builderFieldRow: {
    dragHandle: 'Drag to reorder',
    remove: 'Remove field',
    hiddenTooltip: 'Hidden by default',
    badge: {
      missing: 'missing',
      extra: 'extra',
      required: 'req',
      conditions: { other: '{count} cond' },
      width: { half: 'half', full: 'full' },
    },
  },
  builderSection: {
    dragHandle: 'Drag to reorder section',
    titlePlaceholder: 'Section title',
    remove: 'Remove section',
    emptyState: 'Drag fields here',
  },
  choicesInput: {
    label: 'Choices',
    description: 'One per line. Use label=value to set a separate value.',
    placeholder: 'Low\nMedium\nHigh',
  },
  conditionsEditor: {
    defaultName: 'Condition {number}',
    title: 'Conditions',
    add: 'Add condition',
    emptyState:
      "No conditions. The field is always shown with its default settings. Add a condition to show/hide, require, or lock the field based on other fields' values.",
    precedenceHint: 'When several conditions match, the last matching one wins.',
    name: { label: 'Name', placeholder: 'e.g. Show when bug' },
    remove: 'Remove condition',
    when: 'When',
    then: 'Then',
    overrides: { hidden: 'Hidden', required: 'Required', readonly: 'Read-only' },
  },
  dynamicForm: {
    error: {
      title: 'Could not load form',
      loadFailed: 'Failed to load form definition',
      notFound: 'Form definition not found.',
    },
  },
  fieldPalette: {
    title: 'Fields',
    searchPlaceholder: 'Search fields',
    catalog: { title: 'Field types', noMatch: 'No matching field types' },
    addExtraField: 'Add extra field',
    existing: {
      title: 'Existing fields',
      emptyWithCatalog: 'Drag a field type above, or use “Add extra field”',
      allPlaced: 'All fields placed',
      noMatch: 'No matching fields',
    },
  },
  fieldSettingsPanel: {
    fieldBadge: '{field} · {type}',
    newColumnLocked: 'New column — the name is locked and can’t be changed.',
    newLabel: { label: 'Field label', description: 'The column’s display label' },
    width: { title: 'Width', half: 'Half', full: 'Full' },
    overrides: { required: 'Required', readonly: 'Read-only', hidden: 'Hidden' },
    noteOverride: {
      label: 'Label / help override',
      description: 'Leave blank to use the schema display name',
    },
  },
  formBuilder: {
    defaultSectionTitle: 'Details',
    newSectionTitle: 'Section {number}',
    untitledForm: 'Untitled form',
    error: {
      loadDefinitionFailed: 'Failed to load definition',
      loadSchemaFailed: 'Failed to load collection schema',
      saveFailed: 'Failed to save definition',
      noTargetNoRights:
        'No target collection is set, and you lack the schema rights to create one. Bind this form to an existing collection instead.',
    },
    notify: {
      extrasAdded: {
        title: 'Extras column added',
        message: 'Added an “{column}” JSON column to {collection} to hold extra fields.',
      },
      fieldCreated: {
        title: 'Field created',
        message: '“{label}” was added to {collection}.',
      },
      invalidFieldName: {
        title: 'Invalid field name',
        message:
          '“{key}” isn’t a valid column name (lowercase letters, numbers, underscores; start with a letter).',
      },
      choicesRequired: {
        title: 'Choices required',
        message:
          '“{label}” is a choice field — add at least one choice in the settings panel before saving.',
      },
      nameRequired: {
        title: 'Name required',
        message: 'Enter a form name first — the new collection is named after it.',
      },
      collectionCreated: {
        title: 'Collection created',
        message: { other: 'Created “{collection}” with {count} field(s).' },
      },
      fieldsAdded: {
        title: 'Fields added',
        message: { other: 'Provisioned {count} new field(s) on {collection}.' },
      },
      saved: { title: 'Saved', message: '“{name}” has been saved.' },
      saveFailed: { title: 'Save failed' },
    },
    dragOverlay: { newField: 'New field', section: 'Section' },
    noPermission: {
      title: 'Not allowed',
      message: 'You need create or update permission on the {collection} collection to build forms.',
    },
    name: { label: 'Form name', placeholder: 'e.g. Bug report form' },
    key: {
      label: 'Key (optional)',
      description: 'Distinguishes forms that share a collection',
      placeholder: 'e.g. bug',
    },
    save: 'Save',
    targetCollection: 'Target collection: {collection}',
    autoCreateHint:
      'A new {prefix}-prefixed collection will be created from the form name when you save — every field becomes a real, searchable column.',
    tabs: { build: 'Build', preview: 'Preview' },
    settingsEmptyState: 'Select a field to edit its width, required/hidden settings, and conditions.',
  },
  formPreview: {
    emptyState: 'Add fields to a section to see a live preview.',
    offlineHint:
      'Preview — the new collection isn’t created yet, so this renders your in-progress fields. Conditions are live; submitting does nothing.',
    boundHint: 'Preview — submitting here does not create a record.',
  },
  formsEmptyState: {
    title: 'Form definitions collection not found',
    intro:
      "The form builder stores form definitions as items in a collection named {collection}, which doesn't exist yet.",
    introCanCreate: 'Create it in one click below, or set it up manually with these fields:',
    introManual: 'Create it once via the Data Model editor (or the DDL API) with these fields:',
    fields: {
      id: '{field} — uuid (primary key)',
      name: '{field} — string (form name)',
      targetCollection: '{field} — string (collection the form targets)',
      key: '{field} — string, nullable (optional form discriminator)',
      definition: '{field} — json (the form definition body)',
    },
    systemPrefixWarning: 'It must not be a {prefix}-prefixed system collection.',
    reloadHint: 'Once created, reload this page.',
    createCollection: 'Create collection',
    error: { createFailed: 'Failed to create the collection' },
  },
  nameFieldModal: {
    title: 'Name the new field',
    interfaceHint: 'New {interfaceLabel} field',
    columnName: {
      label: 'Column name',
      description: 'The real column name (snake_case). This can’t be changed later.',
      placeholder: 'e.g. steps_to_reproduce',
    },
    derivedKey: 'Column: {fieldKey}',
    cancel: 'Cancel',
    submit: 'Add field',
  },
};

export const formsId: FormsTranslations = {
  interfaceCatalog: {
    label: {
      input: 'Input teks',
      inputMultiline: 'Teks multibaris',
      inputCode: 'Kode / JSON',
      inputHash: 'Hash (tersamar)',
      tags: 'Tag',
      inputRichTextHtml: 'Teks kaya (WYSIWYG)',
      inputRichTextMd: 'Teks kaya (Markdown)',
      inputBlockEditor: 'Editor blok',
      selectDropdown: 'Dropdown (pilihan)',
      selectRadio: 'Radio (pilihan)',
      selectMultipleCheckbox: 'Kotak centang (banyak)',
      selectMultipleCheckboxTree: 'Kotak centang (pohon)',
      selectMultipleDropdown: 'Dropdown pilihan ganda',
      selectIcon: 'Pemilih ikon',
      selectColor: 'Pemilih warna',
      boolean: 'Kotak centang',
      toggle: 'Sakelar',
      slider: 'Penggeser',
      datetime: 'Pemilih tanggal / waktu',
      map: 'Peta (geometri)',
    },
    group: {
      text: 'Teks',
      richContent: 'Konten kaya',
      selection: 'Pilihan',
      numericAndDate: 'Numerik & tanggal',
      geospatial: 'Geospasial',
    },
  },
  fieldName: {
    error: {
      required: 'Nama kolom wajib diisi',
      invalidPattern: 'Gunakan huruf kecil, angka, dan garis bawah (diawali dengan huruf)',
      duplicate: 'Kolom dengan nama ini sudah ada',
    },
  },
  addFieldModal: {
    title: 'Tambah kolom',
    label: { label: 'Label', placeholder: 'mis. Langkah untuk mereproduksi' },
    fieldKey: {
      label: 'Kunci kolom',
      description: 'Nama kolom / properti (snake_case)',
      placeholder: 'langkah_untuk_mereproduksi',
    },
    type: { label: 'Tipe' },
    typeOptions: {
      string: 'Teks (pendek)',
      text: 'Teks (panjang)',
      integer: 'Angka (bilangan bulat)',
      bigInteger: 'Angka (bilangan bulat besar)',
      float: 'Angka (desimal)',
      decimal: 'Angka (desimal tetap)',
      boolean: 'Boolean',
      date: 'Tanggal',
      time: 'Waktu',
      dateTime: 'Tanggal & waktu',
      json: 'JSON',
      csv: 'CSV (daftar nilai)',
    },
    interface: {
      label: 'Antarmuka',
      description: 'Hanya antarmuka yang kompatibel dengan tipe',
      autoOption: 'Otomatis ({interface})',
    },
    storage: {
      title: 'Penyimpanan',
      column: 'Kolom nyata',
      extras: 'Ekstra (jsonb)',
      columnHint: 'Kolom DaaS nyata yang dapat dicari/diurutkan, disediakan melalui API skema.',
      extrasHint:
        'Disimpan di kolom jsonb extras milik koleksi — tidak dapat dicari di server dan tidak memiliki izin tersendiri.',
      noSchemaRights:
        'Penyediaan kolom nyata memerlukan hak skema DaaS yang tidak Anda miliki — kolom baru disimpan sebagai extras.',
      fullNoRights:
        'Koleksi penyimpanan penuh ini tidak memiliki kolom extras, dan menambahkan kolom nyata memerlukan hak skema DaaS yang tidak Anda miliki.',
      fullHint:
        'Koleksi penyimpanan penuh — setiap kolom adalah kolom DaaS nyata yang dapat dicari (tanpa kolom extras).',
    },
    required: { label: 'Wajib diisi' },
    index: {
      label: 'Indeks kolom ini',
      description: 'Buat indeks B-tree — pilih ini jika kolom akan difilter atau diurutkan.',
    },
    error: { createFailed: 'Gagal membuat kolom' },
    cancel: 'Batal',
    submitColumn: 'Buat kolom',
    submitExtras: 'Tambah kolom ekstra',
  },
  builderCanvas: {
    emptyState: 'Tambahkan bagian, lalu seret kolom dari palet untuk mulai menyusun formulir.',
    addSection: 'Tambah bagian',
  },
  builderFieldRow: {
    dragHandle: 'Seret untuk mengurutkan',
    remove: 'Hapus kolom',
    hiddenTooltip: 'Tersembunyi secara bawaan',
    badge: {
      missing: 'hilang',
      extra: 'ekstra',
      required: 'wajib',
      conditions: { other: '{count} kondisi' },
      width: { half: 'setengah', full: 'penuh' },
    },
  },
  builderSection: {
    dragHandle: 'Seret untuk mengurutkan bagian',
    titlePlaceholder: 'Judul bagian',
    remove: 'Hapus bagian',
    emptyState: 'Seret kolom ke sini',
  },
  choicesInput: {
    label: 'Pilihan',
    description: 'Satu per baris. Gunakan label=nilai untuk menetapkan nilai terpisah.',
    placeholder: 'Rendah\nSedang\nTinggi',
  },
  conditionsEditor: {
    defaultName: 'Kondisi {number}',
    title: 'Kondisi',
    add: 'Tambah kondisi',
    emptyState:
      'Tidak ada kondisi. Kolom selalu ditampilkan dengan pengaturan bawaannya. Tambahkan kondisi untuk menampilkan/menyembunyikan, mewajibkan, atau mengunci kolom berdasarkan nilai kolom lain.',
    precedenceHint: 'Jika beberapa kondisi cocok, kondisi terakhir yang cocok akan digunakan.',
    name: { label: 'Nama', placeholder: 'mis. Tampilkan saat bug' },
    remove: 'Hapus kondisi',
    when: 'Jika',
    then: 'Maka',
    overrides: { hidden: 'Tersembunyi', required: 'Wajib diisi', readonly: 'Hanya baca' },
  },
  dynamicForm: {
    error: {
      title: 'Tidak dapat memuat formulir',
      loadFailed: 'Gagal memuat definisi formulir',
      notFound: 'Definisi formulir tidak ditemukan.',
    },
  },
  fieldPalette: {
    title: 'Kolom',
    searchPlaceholder: 'Cari kolom',
    catalog: { title: 'Tipe kolom', noMatch: 'Tidak ada tipe kolom yang cocok' },
    addExtraField: 'Tambah kolom ekstra',
    existing: {
      title: 'Kolom yang ada',
      emptyWithCatalog: 'Seret tipe kolom di atas, atau gunakan “Tambah kolom ekstra”',
      allPlaced: 'Semua kolom sudah ditempatkan',
      noMatch: 'Tidak ada kolom yang cocok',
    },
  },
  fieldSettingsPanel: {
    fieldBadge: '{field} · {type}',
    newColumnLocked: 'Kolom baru — namanya terkunci dan tidak dapat diubah.',
    newLabel: { label: 'Label kolom', description: 'Label tampilan kolom' },
    width: { title: 'Lebar', half: 'Setengah', full: 'Penuh' },
    overrides: { required: 'Wajib diisi', readonly: 'Hanya baca', hidden: 'Tersembunyi' },
    noteOverride: {
      label: 'Penimpaan label / bantuan',
      description: 'Kosongkan untuk memakai nama tampilan dari skema',
    },
  },
  formBuilder: {
    defaultSectionTitle: 'Detail',
    newSectionTitle: 'Bagian {number}',
    untitledForm: 'Formulir tanpa judul',
    error: {
      loadDefinitionFailed: 'Gagal memuat definisi',
      loadSchemaFailed: 'Gagal memuat skema koleksi',
      saveFailed: 'Gagal menyimpan definisi',
      noTargetNoRights:
        'Koleksi target belum ditetapkan, dan Anda tidak memiliki hak skema untuk membuatnya. Hubungkan formulir ini ke koleksi yang sudah ada.',
    },
    notify: {
      extrasAdded: {
        title: 'Kolom extras ditambahkan',
        message: 'Kolom JSON “{column}” ditambahkan ke {collection} untuk menampung kolom ekstra.',
      },
      fieldCreated: {
        title: 'Kolom dibuat',
        message: '“{label}” ditambahkan ke {collection}.',
      },
      invalidFieldName: {
        title: 'Nama kolom tidak valid',
        message:
          '“{key}” bukan nama kolom yang valid (huruf kecil, angka, garis bawah; diawali dengan huruf).',
      },
      choicesRequired: {
        title: 'Pilihan wajib diisi',
        message:
          '“{label}” adalah kolom pilihan — tambahkan setidaknya satu pilihan di panel pengaturan sebelum menyimpan.',
      },
      nameRequired: {
        title: 'Nama wajib diisi',
        message: 'Masukkan nama formulir terlebih dahulu — koleksi baru dinamai berdasarkan nama tersebut.',
      },
      collectionCreated: {
        title: 'Koleksi dibuat',
        message: { other: 'Koleksi “{collection}” dibuat dengan {count} kolom.' },
      },
      fieldsAdded: {
        title: 'Kolom ditambahkan',
        message: { other: '{count} kolom baru disediakan di {collection}.' },
      },
      saved: { title: 'Tersimpan', message: '“{name}” telah disimpan.' },
      saveFailed: { title: 'Gagal menyimpan' },
    },
    dragOverlay: { newField: 'Kolom baru', section: 'Bagian' },
    noPermission: {
      title: 'Tidak diizinkan',
      message: 'Anda memerlukan izin buat atau ubah pada koleksi {collection} untuk menyusun formulir.',
    },
    name: { label: 'Nama formulir', placeholder: 'mis. Formulir laporan bug' },
    key: {
      label: 'Kunci (opsional)',
      description: 'Membedakan formulir yang berbagi koleksi',
      placeholder: 'mis. bug',
    },
    save: 'Simpan',
    targetCollection: 'Koleksi target: {collection}',
    autoCreateHint:
      'Koleksi baru berawalan {prefix} akan dibuat dari nama formulir saat Anda menyimpan — setiap kolom menjadi kolom nyata yang dapat dicari.',
    tabs: { build: 'Susun', preview: 'Pratinjau' },
    settingsEmptyState: 'Pilih kolom untuk mengubah lebar, pengaturan wajib/tersembunyi, dan kondisinya.',
  },
  formPreview: {
    emptyState: 'Tambahkan kolom ke sebuah bagian untuk melihat pratinjau langsung.',
    offlineHint:
      'Pratinjau — koleksi baru belum dibuat, jadi ini menampilkan kolom yang sedang Anda susun. Kondisi berjalan langsung; mengirim tidak melakukan apa pun.',
    boundHint: 'Pratinjau — mengirim di sini tidak membuat rekaman.',
  },
  formsEmptyState: {
    title: 'Koleksi definisi formulir tidak ditemukan',
    intro:
      'Pembuat formulir menyimpan definisi formulir sebagai item di koleksi bernama {collection}, yang belum ada.',
    introCanCreate: 'Buat dengan sekali klik di bawah, atau siapkan secara manual dengan kolom-kolom berikut:',
    introManual: 'Buat sekali melalui editor Model Data (atau API DDL) dengan kolom-kolom berikut:',
    fields: {
      id: '{field} — uuid (kunci utama)',
      name: '{field} — string (nama formulir)',
      targetCollection: '{field} — string (koleksi target formulir)',
      key: '{field} — string, nullable (pembeda formulir opsional)',
      definition: '{field} — json (isi definisi formulir)',
    },
    systemPrefixWarning: 'Tidak boleh berupa koleksi sistem berawalan {prefix}.',
    reloadHint: 'Setelah dibuat, muat ulang halaman ini.',
    createCollection: 'Buat koleksi',
    error: { createFailed: 'Gagal membuat koleksi' },
  },
  nameFieldModal: {
    title: 'Beri nama kolom baru',
    interfaceHint: 'Kolom {interfaceLabel} baru',
    columnName: {
      label: 'Nama kolom',
      description: 'Nama kolom sebenarnya (snake_case). Ini tidak dapat diubah nanti.',
      placeholder: 'mis. langkah_untuk_mereproduksi',
    },
    derivedKey: 'Kolom: {fieldKey}',
    cancel: 'Batal',
    submit: 'Tambah kolom',
  },
};
