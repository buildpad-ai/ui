/**
 * `interfaces.systemPermissions` — strings of the SystemPermissions interface:
 * the permission matrix, the Add Collection / Reset dialogs, the
 * PermissionDetailModal with its four tabs, and the Directus-style filter
 * rule editor (FilterRuleBuilder / FilterRuleNode).
 */
export interface SystemPermissionsTranslations {
  /** Display names of the `PermissionAction` enum (matrix column headers, modal title) */
  actions: {
    create: string;
    read: string;
    update: string;
    delete: string;
    share: string;
  };
  /** Single-letter badges of the matrix cells */
  actionShort: {
    create: string;
    read: string;
    update: string;
    delete: string;
    share: string;
  };
  /** Access-level names used in the toggle title */
  levels: {
    all: string;
    custom: string;
    none: string;
  };
  /** Present-participle action names ("when creating items") */
  actionGerund: {
    creating: string;
    updating: string;
  };
  /** `{policyName}` fallback when no policy name is known */
  policyFallback: string;
  /** Lower-case `{policyName}` fallback used mid-sentence */
  thisPolicyFallback: string;
  /** JSON editor error fallback */
  invalidJson: string;
  clear: string;
  systemCollections: string;
  addCollection: string;
  adminNotice: string;
  appAccessNotice: {
    /** Bold lead-in */
    title: string;
    message: string;
  };
  resetPrompt: string;
  resetMinimum: string;
  resetRecommended: string;
  toggle: {
    requiredForAppAccess: string;
    allAccess: string;
    noAccess: string;
    useCustom: string;
    /** Badge title: "{action} - {level}" */
    titleFormat: string;
  };
  row: {
    all: string;
    none: string;
    removeCollection: string;
  };
  table: {
    collectionHeader: string;
    empty: string;
  };
  addModal: {
    title: string;
    searchPlaceholder: string;
    /** 'No collections matching "{search}"' */
    noMatch: string;
    allConfigured: string;
    systemBadge: string;
  };
  resetDialog: {
    title: string;
    /** "Are you sure you want to reset all system collection permissions{target}?" */
    message: string;
    /** `{target}` — note the leading space */
    targetRecommended: string;
    /** `{target}` — note the leading space */
    targetMinimum: string;
    cancel: string;
    confirm: string;
  };
  detailModal: {
    tabs: {
      itemPermissions: string;
      fieldPermissions: string;
      fieldValidation: string;
      fieldPresets: string;
    };
    /** "{policyName} → {collection} → {action}" */
    title: string;
    delete: string;
    cancel: string;
    create: string;
    save: string;
    removeDialog: {
      title: string;
      message: string;
      cancel: string;
      confirm: string;
    };
  };
  fieldsTab: {
    /** `{action}` fallback when the draft has no action */
    actionFallback: string;
    /** "Select which fields {policyName} can {action} in {collection}." */
    intro: string;
    fieldsHeading: string;
    selectLabel: string;
    selectAll: string;
    selectNone: string;
    noFields: string;
    pkBadge: string;
    aliasBadge: string;
    appMinimalBadge: string;
    appMinimal: {
      title: string;
      description: string;
    };
  };
  /** Shared by FilterRuleBuilder, FilterRuleNode and PermissionFilterTab */
  filterEditor: {
    addFilter: string;
    andOrGroup: string;
    loadingFields: string;
    relatedFields: string;
  };
  filterRuleBuilder: {
    /** `{action}` of `intro` */
    action: {
      canDelete: string;
      canCreate: string;
      canUpdate: string;
      canShare: string;
      canRead: string;
    };
    /** "Items the {policyName} {action}." */
    intro: string;
    /** "... Use the {fields}, {validation}, and {presets} tabs ..." — the placeholders render bold */
    createActionInfo: string;
    createActionTabs: {
      fields: string;
      validation: string;
      presets: string;
    };
    ruleHeading: string;
    switchToVisual: string;
    switchToJson: string;
    jsonHint: string;
    /** `{has}`, `{some}`, `{none}` render as the operator names in code style */
    relationalWarning: string;
    noRules: string;
    appMinimal: {
      title: string;
      description: string;
    };
  };
  filterRuleNode: {
    /** Dynamic value option: "{key} - {label}" */
    dynamicOptionLabel: string;
    fieldSearchPlaceholder: string;
    hasRelatedItems: string;
    loading: string;
    relationAliasWarning: string;
    dotNotationWarning: string;
    removeRule: string;
    and: string;
    or: string;
    removeGroup: string;
    valueAriaLabel: string;
    valuesAriaLabel: string;
    fromValueAriaLabel: string;
    toValueAriaLabel: string;
    /** Word between the two range inputs */
    rangeTo: string;
    booleanTrue: string;
    booleanFalse: string;
    dateValueAriaLabel: string;
  };
  /** Filter operator labels (`getOperatorsForType` / `getOperatorsForRelation`) */
  operators: {
    equals: string;
    notEquals: string;
    contains: string;
    notContains: string;
    iContains: string;
    startsWith: string;
    notStartsWith: string;
    endsWith: string;
    notEndsWith: string;
    oneOf: string;
    notOneOf: string;
    isNull: string;
    isNotNull: string;
    isEmpty: string;
    isNotEmpty: string;
    lessThan: string;
    lessThanOrEqual: string;
    greaterThan: string;
    greaterThanOrEqual: string;
    between: string;
    notBetween: string;
    before: string;
    onOrBefore: string;
    after: string;
    onOrAfter: string;
    hasRelatedItems: string;
    /** Inline warning of the `_has` operator */
    hasRelationalLimitation: string;
  };
  /** Labels of the `$CURRENT_USER`-style dynamic values (`DYNAMIC_VALUES`) */
  dynamicValues: {
    currentUser: string;
    currentRole: string;
    now: string;
    currentRoles: string;
    currentPolicies: string;
    currentResourceUri: string;
  };
  /** Descriptions in the "Dynamic Variables" code block */
  dynamicVariableHelp: {
    currentUser: string;
    currentRole: string;
    now: string;
    nowRelative: string;
    slug: string;
    uuid: string;
  };
  dynamicVariables: {
    title: string;
    presetsDescription: string;
    validationDescription: string;
  };
  /** `validateNode` messages */
  validation: {
    fieldRequired: string;
    operatorRequired: string;
    valueRequired: string;
    groupNeedsCondition: string;
  };
  presetsTab: {
    /** "Define default values for fields when {action} items in {collection} by {policyName}." */
    intro: string;
    heading: string;
    relationalWarning: {
      title: string;
      description: string;
      hint: string;
    };
    /** "... when {action} items. ..." */
    jsonHint: string;
    examplesHeading: string;
    /** Comment lines of the example code block */
    examples: {
      staticValues: string;
      currentUser: string;
      timestamps: string;
      simpleRelational: string;
      detailedRelational: string;
      oneToMany: string;
      computedValues: string;
    };
    importantNotes: {
      title: string;
      appliedBeforeValidation: string;
      cannotOverride: string;
      useDetailedSyntax: string;
      combineWithValidation: string;
    };
  };
  validationTab: {
    /** "Define validation rules for fields when {action} items in {collection} by {policyName}." */
    intro: string;
    heading: string;
    /** "... before allowing {action} operations." */
    jsonHint: string;
    examplesHeading: string;
    /** Comment lines of the example code block */
    examples: {
      requiredField: string;
      enumValidation: string;
      dateRange: string;
      stringLength: string;
      numericRange: string;
      multipleConditions: string;
    };
    appMinimal: {
      title: string;
      description: string;
    };
  };
}

export const systemPermissionsDefaults: SystemPermissionsTranslations = {
  actions: {
    create: 'create',
    read: 'read',
    update: 'update',
    delete: 'delete',
    share: 'share',
  },
  actionShort: {
    create: 'C',
    read: 'R',
    update: 'U',
    delete: 'D',
    share: 'S',
  },
  levels: {
    all: 'all',
    custom: 'custom',
    none: 'none',
  },
  actionGerund: {
    creating: 'creating',
    updating: 'updating',
  },
  policyFallback: 'Policy',
  thisPolicyFallback: 'this policy',
  invalidJson: 'Invalid JSON',
  clear: 'Clear',
  systemCollections: 'System Collections',
  addCollection: 'Add Collection',
  adminNotice: 'Admin Access is enabled. This policy has full access to all collections and actions.',
  appAccessNotice: {
    title: 'App Access is enabled.',
    message: 'Minimal permissions are automatically applied and cannot be removed.',
  },
  resetPrompt: 'Reset system permissions to:',
  resetMinimum: 'app access minimum',
  resetRecommended: 'recommended defaults',
  toggle: {
    requiredForAppAccess: 'Required for app access',
    allAccess: 'All Access',
    noAccess: 'No Access',
    useCustom: 'Use Custom',
    titleFormat: '{action} - {level}',
  },
  row: {
    all: 'all',
    none: 'none',
    removeCollection: 'Remove collection',
  },
  table: {
    collectionHeader: 'Collection',
    empty: 'No permissions configured. Click "Add Collection" to get started.',
  },
  addModal: {
    title: 'Add Collection',
    searchPlaceholder: 'Search collections...',
    noMatch: 'No collections matching "{search}"',
    allConfigured: 'All collections have been configured',
    systemBadge: 'System',
  },
  resetDialog: {
    title: 'Reset System Permissions',
    message: 'Are you sure you want to reset all system collection permissions{target}?',
    targetRecommended: ' to recommended defaults',
    targetMinimum: ' to app access minimum',
    cancel: 'Cancel',
    confirm: 'Reset',
  },
  detailModal: {
    tabs: {
      itemPermissions: 'Item Permissions',
      fieldPermissions: 'Field Permissions',
      fieldValidation: 'Field Validation',
      fieldPresets: 'Field Presets',
    },
    title: '{policyName} → {collection} → {action}',
    delete: 'Delete',
    cancel: 'Cancel',
    create: 'Create',
    save: 'Save',
    removeDialog: {
      title: 'Remove permission',
      message: 'Are you sure you want to remove this permission? This action cannot be undone.',
      cancel: 'Cancel',
      confirm: 'Remove',
    },
  },
  fieldsTab: {
    actionFallback: 'access',
    intro: 'Select which fields {policyName} can {action} in {collection}.',
    fieldsHeading: 'Fields',
    selectLabel: 'Select:',
    selectAll: 'all',
    selectNone: 'none',
    noFields: 'No fields found for this collection',
    pkBadge: 'PK',
    aliasBadge: 'Alias',
    appMinimalBadge: 'App Minimal',
    appMinimal: {
      title: 'Minimum Permissions (App Access)',
      description: 'The following fields are automatically included with app access and cannot be removed:',
    },
  },
  filterEditor: {
    addFilter: 'Add Filter',
    andOrGroup: 'And / Or group',
    loadingFields: 'Loading fields...',
    relatedFields: 'Related Fields',
  },
  filterRuleBuilder: {
    action: {
      canDelete: 'can delete',
      canCreate: 'can create',
      canUpdate: 'can update',
      canShare: 'can share',
      canRead: 'can read',
    },
    intro: 'Items the {policyName} {action}.',
    createActionInfo:
      'Filter rules do not apply to create actions. Use the {fields}, {validation}, and {presets} tabs to restrict inserts.',
    createActionTabs: {
      fields: 'Fields',
      validation: 'Validation',
      presets: 'Presets',
    },
    ruleHeading: '• Rule',
    switchToVisual: 'Switch to Visual Editor',
    switchToJson: 'Switch to JSON Editor',
    jsonHint: 'Enter a filter object using Directus filter syntax. Leave empty for no restrictions.',
    relationalWarning:
      'This filter contains operators with limited relational enforcement ({has}, dot-notation, or {some}/{none}). A two-step query fallback is used for child mutations.',
    noRules: 'No configured rules',
    appMinimal: {
      title: 'Minimum Permissions (App Access)',
      description: 'The following filter rules are automatically applied with app access:',
    },
  },
  filterRuleNode: {
    dynamicOptionLabel: '{key} - {label}',
    fieldSearchPlaceholder: 'Search',
    hasRelatedItems: 'Has related items',
    loading: 'Loading...',
    relationAliasWarning: 'Relational existence filters (_has) require a two-step query fallback on child mutations.',
    dotNotationWarning:
      'Dot-notation filters have limited enforcement on relational mutations. On update/delete, a two-step query fallback is used (+1 SELECT).',
    removeRule: 'Remove rule',
    and: 'AND',
    or: 'OR',
    removeGroup: 'Remove group',
    valueAriaLabel: 'Value',
    valuesAriaLabel: 'Values',
    fromValueAriaLabel: 'From value',
    toValueAriaLabel: 'To value',
    rangeTo: 'to',
    booleanTrue: 'True',
    booleanFalse: 'False',
    dateValueAriaLabel: 'Date value',
  },
  operators: {
    equals: 'Equals',
    notEquals: 'Not equals',
    contains: 'Contains',
    notContains: 'Not contains',
    iContains: 'Contains (case-insensitive)',
    startsWith: 'Starts with',
    notStartsWith: 'Not starts with',
    endsWith: 'Ends with',
    notEndsWith: 'Not ends with',
    oneOf: 'One of',
    notOneOf: 'Not one of',
    isNull: 'Is null',
    isNotNull: 'Is not null',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
    lessThan: 'Less than',
    lessThanOrEqual: 'Less than or equal',
    greaterThan: 'Greater than',
    greaterThanOrEqual: 'Greater than or equal',
    between: 'Between',
    notBetween: 'Not between',
    before: 'Before',
    onOrBefore: 'On or before',
    after: 'After',
    onOrAfter: 'On or after',
    hasRelatedItems: 'Has related items',
    hasRelationalLimitation:
      'Requires two-step query on child mutations (update/delete). Performance cost: +1 SELECT per operation.',
  },
  dynamicValues: {
    currentUser: 'Current User ID',
    currentRole: 'Current User Role',
    now: 'Current Date/Time',
    currentRoles: 'Current User Roles (array)',
    currentPolicies: 'Current User Policies (array)',
    currentResourceUri: 'Current Resource URI',
  },
  dynamicVariableHelp: {
    currentUser: 'ID of the current user',
    currentRole: "ID of the current user's role",
    now: 'Current timestamp',
    nowRelative: 'Relative time calculations',
    slug: 'Generate URL slug from field',
    uuid: 'Generate new UUID',
  },
  dynamicVariables: {
    title: 'Dynamic Variables',
    presetsDescription: 'You can use the following dynamic variables in your presets:',
    validationDescription: 'You can use the following dynamic variables in your validation rules:',
  },
  validation: {
    fieldRequired: 'Field is required',
    operatorRequired: 'Operator is required',
    valueRequired: 'Value is required',
    groupNeedsCondition: 'Group must have at least one condition',
  },
  presetsTab: {
    intro: 'Define default values for fields when {action} items in {collection} by {policyName}.',
    heading: 'Field Presets',
    relationalWarning: {
      title: 'Warning: Relational Field Preset Syntax',
      description:
        'The following relational fields use array syntax which may not work correctly in the app interface:',
      hint: 'Consider using the detailed syntax for relational fields (see examples below).',
    },
    jsonHint:
      'Enter default field values that will be automatically applied when {action} items. These values can be static or dynamic.',
    examplesHeading: 'Example Preset Patterns:',
    examples: {
      staticValues: 'Static values',
      currentUser: 'Current user',
      timestamps: 'Timestamps',
      simpleRelational: 'Simple relational field (array syntax)',
      detailedRelational: 'Relational field (detailed syntax - RECOMMENDED)',
      oneToMany: 'One-to-Many relationship',
      computedValues: 'Computed values',
    },
    importantNotes: {
      title: 'Important Notes',
      appliedBeforeValidation: '• Presets are applied before validation rules',
      cannotOverride: '• Users cannot override preset values in the app',
      useDetailedSyntax: '• For relational fields used in app interfaces, use detailed syntax instead of arrays',
      combineWithValidation: '• Presets can be combined with validation to ensure data consistency',
    },
  },
  validationTab: {
    intro: 'Define validation rules for fields when {action} items in {collection} by {policyName}.',
    heading: 'Validation Rules',
    jsonHint:
      'Enter field validation rules using Directus filter syntax. These rules will be checked before allowing {action} operations.',
    examplesHeading: 'Example Validation Patterns:',
    examples: {
      requiredField: 'Required field (not null and not empty)',
      enumValidation: 'Enum validation',
      dateRange: 'Date range validation',
      stringLength: 'String length validation',
      numericRange: 'Numeric range',
      multipleConditions: 'Multiple conditions (AND)',
    },
    appMinimal: {
      title: 'Minimum Validation (App Access)',
      description: 'The following validation rules are automatically applied with app access:',
    },
  },
};

export const systemPermissionsId: SystemPermissionsTranslations = {
  actions: {
    create: 'buat',
    read: 'baca',
    update: 'ubah',
    delete: 'hapus',
    share: 'bagikan',
  },
  // The CRUD initials are an acronym used verbatim in Indonesian UIs too;
  // the Indonesian action names would collide (Buat/Baca/Bagikan).
  actionShort: {
    create: 'C',
    read: 'R',
    update: 'U',
    delete: 'D',
    share: 'S',
  },
  levels: {
    all: 'semua',
    custom: 'kustom',
    none: 'tidak ada',
  },
  actionGerund: {
    creating: 'membuat',
    updating: 'mengubah',
  },
  policyFallback: 'Kebijakan',
  thisPolicyFallback: 'kebijakan ini',
  invalidJson: 'JSON tidak valid',
  clear: 'Bersihkan',
  systemCollections: 'Koleksi Sistem',
  addCollection: 'Tambah Koleksi',
  adminNotice: 'Akses Admin aktif. Kebijakan ini memiliki akses penuh ke semua koleksi dan aksi.',
  appAccessNotice: {
    title: 'Akses Aplikasi aktif.',
    message: 'Izin minimal diterapkan secara otomatis dan tidak dapat dihapus.',
  },
  resetPrompt: 'Atur ulang izin sistem ke:',
  resetMinimum: 'minimum akses aplikasi',
  resetRecommended: 'bawaan yang direkomendasikan',
  toggle: {
    requiredForAppAccess: 'Diperlukan untuk akses aplikasi',
    allAccess: 'Akses Penuh',
    noAccess: 'Tanpa Akses',
    useCustom: 'Gunakan Kustom',
    titleFormat: '{action} - {level}',
  },
  row: {
    all: 'semua',
    none: 'tidak ada',
    removeCollection: 'Hapus koleksi',
  },
  table: {
    collectionHeader: 'Koleksi',
    empty: 'Belum ada izin dikonfigurasi. Klik "Tambah Koleksi" untuk memulai.',
  },
  addModal: {
    title: 'Tambah Koleksi',
    searchPlaceholder: 'Cari koleksi...',
    noMatch: 'Tidak ada koleksi yang cocok dengan "{search}"',
    allConfigured: 'Semua koleksi sudah dikonfigurasi',
    systemBadge: 'Sistem',
  },
  resetDialog: {
    title: 'Atur Ulang Izin Sistem',
    message: 'Yakin ingin mengatur ulang semua izin koleksi sistem{target}?',
    targetRecommended: ' ke bawaan yang direkomendasikan',
    targetMinimum: ' ke minimum akses aplikasi',
    cancel: 'Batal',
    confirm: 'Atur ulang',
  },
  detailModal: {
    tabs: {
      itemPermissions: 'Izin Item',
      fieldPermissions: 'Izin Kolom',
      fieldValidation: 'Validasi Kolom',
      fieldPresets: 'Preset Kolom',
    },
    title: '{policyName} → {collection} → {action}',
    delete: 'Hapus',
    cancel: 'Batal',
    create: 'Buat',
    save: 'Simpan',
    removeDialog: {
      title: 'Hapus izin',
      message: 'Yakin ingin menghapus izin ini? Tindakan ini tidak dapat dibatalkan.',
      cancel: 'Batal',
      confirm: 'Hapus',
    },
  },
  fieldsTab: {
    actionFallback: 'akses',
    intro: 'Pilih kolom yang dapat {policyName} {action} di {collection}.',
    fieldsHeading: 'Kolom',
    selectLabel: 'Pilih:',
    selectAll: 'semua',
    selectNone: 'tidak ada',
    noFields: 'Tidak ada kolom ditemukan untuk koleksi ini',
    pkBadge: 'PK',
    aliasBadge: 'Alias',
    appMinimalBadge: 'Minimal Aplikasi',
    appMinimal: {
      title: 'Izin Minimum (Akses Aplikasi)',
      description: 'Kolom berikut disertakan secara otomatis dengan akses aplikasi dan tidak dapat dihapus:',
    },
  },
  filterEditor: {
    addFilter: 'Tambah Filter',
    andOrGroup: 'Grup And / Or',
    loadingFields: 'Memuat kolom...',
    relatedFields: 'Kolom Terkait',
  },
  filterRuleBuilder: {
    action: {
      canDelete: 'dapat dihapus',
      canCreate: 'dapat dibuat',
      canUpdate: 'dapat diubah',
      canShare: 'dapat dibagikan',
      canRead: 'dapat dibaca',
    },
    intro: 'Item yang {action} oleh {policyName}.',
    createActionInfo:
      'Aturan filter tidak berlaku untuk aksi buat. Gunakan tab {fields}, {validation}, dan {presets} untuk membatasi penyisipan.',
    createActionTabs: {
      fields: 'Kolom',
      validation: 'Validasi',
      presets: 'Preset',
    },
    ruleHeading: '• Aturan',
    switchToVisual: 'Beralih ke Editor Visual',
    switchToJson: 'Beralih ke Editor JSON',
    jsonHint: 'Masukkan objek filter menggunakan sintaks filter Directus. Kosongkan jika tanpa batasan.',
    relationalWarning:
      'Filter ini berisi operator dengan penegakan relasional terbatas ({has}, notasi titik, atau {some}/{none}). Fallback kueri dua langkah digunakan untuk mutasi turunan.',
    noRules: 'Belum ada aturan dikonfigurasi',
    appMinimal: {
      title: 'Izin Minimum (Akses Aplikasi)',
      description: 'Aturan filter berikut diterapkan secara otomatis dengan akses aplikasi:',
    },
  },
  filterRuleNode: {
    dynamicOptionLabel: '{key} - {label}',
    fieldSearchPlaceholder: 'Cari',
    hasRelatedItems: 'Memiliki item terkait',
    loading: 'Memuat...',
    relationAliasWarning: 'Filter keberadaan relasional (_has) memerlukan fallback kueri dua langkah pada mutasi turunan.',
    dotNotationWarning:
      'Filter notasi titik memiliki penegakan terbatas pada mutasi relasional. Saat ubah/hapus, fallback kueri dua langkah digunakan (+1 SELECT).',
    removeRule: 'Hapus aturan',
    and: 'DAN',
    or: 'ATAU',
    removeGroup: 'Hapus grup',
    valueAriaLabel: 'Nilai',
    valuesAriaLabel: 'Nilai-nilai',
    fromValueAriaLabel: 'Nilai awal',
    toValueAriaLabel: 'Nilai akhir',
    rangeTo: 'sampai',
    booleanTrue: 'Benar',
    booleanFalse: 'Salah',
    dateValueAriaLabel: 'Nilai tanggal',
  },
  operators: {
    equals: 'Sama dengan',
    notEquals: 'Tidak sama dengan',
    contains: 'Mengandung',
    notContains: 'Tidak mengandung',
    iContains: 'Mengandung (abaikan huruf besar/kecil)',
    startsWith: 'Diawali dengan',
    notStartsWith: 'Tidak diawali dengan',
    endsWith: 'Diakhiri dengan',
    notEndsWith: 'Tidak diakhiri dengan',
    oneOf: 'Salah satu dari',
    notOneOf: 'Bukan salah satu dari',
    isNull: 'Bernilai null',
    isNotNull: 'Tidak bernilai null',
    isEmpty: 'Kosong',
    isNotEmpty: 'Tidak kosong',
    lessThan: 'Kurang dari',
    lessThanOrEqual: 'Kurang dari atau sama dengan',
    greaterThan: 'Lebih dari',
    greaterThanOrEqual: 'Lebih dari atau sama dengan',
    between: 'Di antara',
    notBetween: 'Tidak di antara',
    before: 'Sebelum',
    onOrBefore: 'Pada atau sebelum',
    after: 'Setelah',
    onOrAfter: 'Pada atau setelah',
    hasRelatedItems: 'Memiliki item terkait',
    hasRelationalLimitation:
      'Memerlukan kueri dua langkah pada mutasi turunan (ubah/hapus). Biaya performa: +1 SELECT per operasi.',
  },
  dynamicValues: {
    currentUser: 'ID Pengguna Saat Ini',
    currentRole: 'Peran Pengguna Saat Ini',
    now: 'Tanggal/Waktu Saat Ini',
    currentRoles: 'Peran Pengguna Saat Ini (array)',
    currentPolicies: 'Kebijakan Pengguna Saat Ini (array)',
    currentResourceUri: 'URI Sumber Daya Saat Ini',
  },
  dynamicVariableHelp: {
    currentUser: 'ID pengguna saat ini',
    currentRole: 'ID peran pengguna saat ini',
    now: 'Stempel waktu saat ini',
    nowRelative: 'Perhitungan waktu relatif',
    slug: 'Buat slug URL dari kolom',
    uuid: 'Buat UUID baru',
  },
  dynamicVariables: {
    title: 'Variabel Dinamis',
    presetsDescription: 'Anda dapat menggunakan variabel dinamis berikut dalam preset Anda:',
    validationDescription: 'Anda dapat menggunakan variabel dinamis berikut dalam aturan validasi Anda:',
  },
  validation: {
    fieldRequired: 'Kolom wajib diisi',
    operatorRequired: 'Operator wajib diisi',
    valueRequired: 'Nilai wajib diisi',
    groupNeedsCondition: 'Grup harus memiliki setidaknya satu kondisi',
  },
  presetsTab: {
    intro: 'Tentukan nilai bawaan kolom saat {action} item di {collection} oleh {policyName}.',
    heading: 'Preset Kolom',
    relationalWarning: {
      title: 'Peringatan: Sintaks Preset Kolom Relasional',
      description:
        'Kolom relasional berikut menggunakan sintaks array yang mungkin tidak berfungsi dengan benar di antarmuka aplikasi:',
      hint: 'Pertimbangkan menggunakan sintaks terperinci untuk kolom relasional (lihat contoh di bawah).',
    },
    jsonHint:
      'Masukkan nilai bawaan kolom yang akan diterapkan secara otomatis saat {action} item. Nilai ini dapat bersifat statis atau dinamis.',
    examplesHeading: 'Contoh Pola Preset:',
    examples: {
      staticValues: 'Nilai statis',
      currentUser: 'Pengguna saat ini',
      timestamps: 'Stempel waktu',
      simpleRelational: 'Kolom relasional sederhana (sintaks array)',
      detailedRelational: 'Kolom relasional (sintaks terperinci - DIREKOMENDASIKAN)',
      oneToMany: 'Relasi One-to-Many',
      computedValues: 'Nilai terhitung',
    },
    importantNotes: {
      title: 'Catatan Penting',
      appliedBeforeValidation: '• Preset diterapkan sebelum aturan validasi',
      cannotOverride: '• Pengguna tidak dapat menimpa nilai preset di aplikasi',
      useDetailedSyntax: '• Untuk kolom relasional yang digunakan di antarmuka aplikasi, gunakan sintaks terperinci alih-alih array',
      combineWithValidation: '• Preset dapat digabungkan dengan validasi untuk menjaga konsistensi data',
    },
  },
  validationTab: {
    intro: 'Tentukan aturan validasi kolom saat {action} item di {collection} oleh {policyName}.',
    heading: 'Aturan Validasi',
    jsonHint:
      'Masukkan aturan validasi kolom menggunakan sintaks filter Directus. Aturan ini akan diperiksa sebelum operasi {action} diizinkan.',
    examplesHeading: 'Contoh Pola Validasi:',
    examples: {
      requiredField: 'Kolom wajib (tidak null dan tidak kosong)',
      enumValidation: 'Validasi enum',
      dateRange: 'Validasi rentang tanggal',
      stringLength: 'Validasi panjang string',
      numericRange: 'Rentang numerik',
      multipleConditions: 'Beberapa kondisi (AND)',
    },
    appMinimal: {
      title: 'Validasi Minimum (Akses Aplikasi)',
      description: 'Aturan validasi berikut diterapkan secara otomatis dengan akses aplikasi:',
    },
  },
};
