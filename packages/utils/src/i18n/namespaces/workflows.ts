/**
 * `workflows` namespace — the workflow admin surfaces: the definitions list
 * and editor (with its state diagram and the State and Command dialogs), the
 * assignments list and form, and the instances list and detail.
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test
 * enforces it. Every `PluralForms` entry has `{count}` available; the
 * Indonesian catalog only needs `other` (one plural category).
 *
 * Generic chrome (Cancel, Edit, Delete, Back, Actions, Error, Success,
 * "Loading...", "Unsaved changes") comes from the shared `common` namespace
 * and is not repeated here.
 *
 * Rich text: a few strings carry `<tag>…</tag>` markers (`<strong>`, `<code>`,
 * `<from>`, `<to>`) that the component maps to inline elements — keep the
 * tags, translate the text between them. Two placeholders are JSON samples
 * (`{"status": …}`); they are shown as they are and never interpolated.
 *
 * The English wording is the reference admin UI's (buildpad-daas), with three
 * kinds of exception: `workflowDetail.diagramHint` says what the diagram does
 * (the original promised "Click to edit", and a click only selects); the
 * strings for states the original pages never drew — a failed load, a missing
 * record, a refusal, a search without matches; and labels for controls that
 * were icons without a name. `stateModal.validation.endStateHasCommands` is
 * the refusal behind the End State switch's own description ("End states
 * cannot have outgoing commands"), which the original never enforced.
 */
import type { PluralForms } from '../primitives';

export interface WorkflowsTranslations {
  /** Marker shown in place of a missing value ("—") */
  emptyValue: string;
  /** Notification title for a client-side validation failure */
  validationErrorTitle: string;
  /** Submit label of every edit form and dialog */
  saveChanges: string;
  /** Instance status badge — list and detail */
  status: {
    active: string;
    terminated: string;
  };
  /** "{count} workflow(s)" style counts — toolbar badges */
  count: {
    workflows: PluralForms;
    assignments: PluralForms;
    instances: PluralForms;
    transitions: PluralForms;
  };
  searchInput: {
    clearAriaLabel: string;
  };
  rowActions: {
    ariaLabel: string;
  };
  listFooter: {
    /** "Showing {shown} of {totalCount} {itemsLabel}" — `itemsLabel` is the manager's plural noun */
    showing: string;
    /** "{n} / page" — page-size option label */
    perPage: string;
    itemsPerPageAriaLabel: string;
  };
  /** Shown in place of a page or a record the caller may not read */
  accessDenied: {
    title: string;
    description: string;
  };
  workflowsManager: {
    title: string;
    subtitle: string;
    addWorkflow: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    /** Marker shown for a definition without an initial state or a description ("-") */
    emptyValue: string;
    columns: {
      name: string;
      initialState: string;
      states: string;
      description: string;
    };
    emptyState: {
      /** "Failed to load workflow definitions — {error}" */
      loadError: string;
      title: string;
      search: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      loadFailed: string;
      deleted: string;
      deleteFailed: string;
    };
  };
  workflowDetail: {
    /** Breadcrumb back to the list */
    breadcrumbRoot: string;
    /** Breadcrumb of an unsaved definition */
    breadcrumbNew: string;
    titleNew: string;
    createWorkflow: string;
    detailsHeading: string;
    fields: {
      name: string;
      namePlaceholder: string;
      description: string;
      descriptionPlaceholder: string;
    };
    statistics: {
      title: string;
      states: string;
      commands: string;
      initialState: string;
      /** Shown while no initial state is set */
      notSet: string;
    };
    statesOverview: {
      title: string;
      initialBadge: string;
      endBadge: string;
      /** "{count} cmd" — number of commands of a state */
      commandCount: string;
    };
    diagramTitle: string;
    /** How to work the diagram, parts joined by "•" */
    diagramHint: string;
    validation: {
      nameRequired: string;
      noStates: string;
      noInitialState: string;
    };
    notFound: {
      title: string;
      description: string;
    };
    /** "Failed to load workflow definition — {error}" */
    loadError: string;
    notifications: {
      fetchFailed: string;
      created: string;
      updated: string;
      saveFailed: string;
    };
  };
  diagram: {
    initialStateTooltip: string;
    endStateTooltip: string;
    editState: string;
    deleteState: string;
    /** "→ {state}" — where a command leads */
    commandTarget: string;
    /** Shown on a state that has no commands yet */
    connectHint: string;
    /** Shown on an end state */
    endStateNote: string;
    emptyTitle: string;
    emptyHint: string;
    addStateAriaLabel: string;
    /** "Actions for state {name}" */
    stateActionsAriaLabel: string;
    /** "Delete command {name}" */
    deleteCommandAriaLabel: string;
  };
  stateModal: {
    titleAdd: string;
    titleEdit: string;
    /** Submit label for a new state */
    addState: string;
    fields: {
      name: string;
      namePlaceholder: string;
      endState: string;
      endStateDescription: string;
      initialState: string;
      initialStateDescription: string;
    };
    validation: {
      nameRequired: string;
      duplicateName: string;
      /** Shown when End State is turned on for a state that has commands */
      endStateHasCommands: string;
    };
  };
  commandModal: {
    titleAdd: string;
    titleEdit: string;
    /** Submit label for a new command */
    addCommand: string;
    tabs: {
      general: string;
      /** "Actions ({count})" */
      actions: string;
      /** "Policies ({count})" */
      policies: string;
    };
    general: {
      /** Shown when the workflow has no other state to lead to */
      noTargetStates: string;
      name: string;
      namePlaceholder: string;
      targetState: string;
      targetStatePlaceholder: string;
      /** Target State placeholder when there is no other state */
      targetStatePlaceholderNone: string;
      /** "{name} (End State)" — option label of an end state */
      endStateOption: string;
      /** Rich text: "From: <from>{from}</from> → To: <to>{to}</to>" */
      route: string;
      /** `{to}` of `route` while no target state is chosen */
      routeUnsetTarget: string;
    };
    actions: {
      promotionTitle: string;
      /** Rich text: "Use <code>xtr.item.promote</code> as the Event Name …" */
      promotionBody: string;
      heading: string;
      addAction: string;
      emptyState: string;
      /** "Action {number}" — header of an action without a name */
      fallbackName: string;
      name: string;
      namePlaceholder: string;
      eventName: string;
      eventNameDescription: string;
      eventNamePlaceholder: string;
      parameters: string;
      parametersDescription: string;
      /** A JSON sample — shown as it is, never interpolated */
      parametersPlaceholder: string;
      removeAction: string;
    };
    policies: {
      intro: string;
      label: string;
      placeholder: string;
      loading: string;
      loadFailed: string;
      selectedHeading: string;
      /** Shown when the command names no policy (and no module access key) */
      openToAllWarning: string;
      /** "… module access keys: {keys}" — keys the dialog keeps but does not edit */
      moduleAccessKeysNotice: string;
    };
    validation: {
      nameRequired: string;
      targetStateRequired: string;
      duplicateName: string;
      /** "Invalid JSON: {reason}" — `{reason}` is the parser's own message */
      invalidJson: string;
    };
  };
  assignmentsManager: {
    title: string;
    subtitle: string;
    newAssignment: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    columns: {
      collection: string;
      workflow: string;
      filterRule: string;
      created: string;
    };
    hasFilter: string;
    noFilter: string;
    /** "Edit assignment for {collection}" */
    editAriaLabel: string;
    /** "Delete assignment for {collection}" */
    deleteAriaLabel: string;
    emptyState: {
      /** "Failed to load workflow assignments — {error}" */
      loadError: string;
      search: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      /** Rich text: "… for collection <strong>{collection}</strong>? …" */
      description: string;
    };
    notifications: {
      loadFailed: string;
      deleted: string;
      deleteFailed: string;
    };
  };
  assignmentDetail: {
    /** Breadcrumb back to the list */
    breadcrumbRoot: string;
    breadcrumbNew: string;
    breadcrumbEdit: string;
    titleNew: string;
    titleEdit: string;
    createAssignment: string;
    fields: {
      workflow: string;
      workflowPlaceholder: string;
      collection: string;
      collectionDescription: string;
      collectionPlaceholder: string;
      filterRule: string;
      filterRuleDescription: string;
      /** A JSON sample — shown as it is, never interpolated */
      filterRulePlaceholder: string;
    };
    validation: {
      required: string;
      filterRuleInvalidJson: string;
      filterRuleNotObject: string;
    };
    notFound: {
      title: string;
      description: string;
    };
    /** "Failed to load workflow assignment — {error}" */
    loadError: string;
    notifications: {
      fetchFailed: string;
      workflowsLoadFailed: string;
      collectionsLoadFailed: string;
      created: string;
      updated: string;
      createFailed: string;
      updateFailed: string;
    };
  };
  instancesManager: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    columns: {
      workflow: string;
      collection: string;
      itemId: string;
      currentState: string;
      version: string;
      status: string;
      created: string;
    };
    viewDetails: string;
    emptyState: {
      /** "Failed to load workflow instances — {error}" */
      loadError: string;
      search: string;
      pristine: string;
    };
    notifications: {
      loadFailed: string;
    };
  };
  instanceDetail: {
    /** Breadcrumb back to the list */
    breadcrumbRoot: string;
    breadcrumbCurrent: string;
    title: string;
    informationHeading: string;
    fields: {
      workflow: string;
      currentState: string;
      collection: string;
      itemId: string;
      versionKey: string;
      created: string;
      lastUpdated: string;
      instanceId: string;
    };
    notFound: {
      title: string;
      description: string;
    };
    /** "Failed to load workflow instance — {error}" */
    loadError: string;
    history: {
      title: string;
      emptyState: string;
      /** "Failed to load transition history — {error}" */
      loadError: string;
      /** Shown to a caller without read access to the history */
      accessDenied: string;
      columns: {
        date: string;
        command: string;
        fromState: string;
        toState: string;
        transitionedBy: string;
      };
    };
    notifications: {
      fetchFailed: string;
      historyFetchFailed: string;
    };
  };
}

export const workflowsDefaults: WorkflowsTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Validation Error',
  saveChanges: 'Save Changes',
  status: {
    active: 'Active',
    terminated: 'Terminated',
  },
  count: {
    workflows: { one: '{count} workflow', other: '{count} workflows' },
    assignments: { one: '{count} assignment', other: '{count} assignments' },
    instances: { one: '{count} instance', other: '{count} instances' },
    transitions: { one: '{count} transition', other: '{count} transitions' },
  },
  searchInput: {
    clearAriaLabel: 'Clear search',
  },
  rowActions: {
    ariaLabel: 'Row actions',
  },
  listFooter: {
    showing: 'Showing {shown} of {totalCount} {itemsLabel}',
    perPage: '{n} / page',
    itemsPerPageAriaLabel: 'Items per page',
  },
  accessDenied: {
    title: 'Access denied',
    description: 'You do not have permission to view this.',
  },
  workflowsManager: {
    title: 'Workflow Definitions',
    subtitle: 'Define and manage state-based workflows for your collections.',
    addWorkflow: 'Add Workflow',
    searchPlaceholder: 'Search workflows by name or description...',
    itemsLabel: 'workflows',
    emptyValue: '-',
    columns: {
      name: 'Name',
      initialState: 'Initial State',
      states: 'States',
      description: 'Description',
    },
    emptyState: {
      loadError: 'Failed to load workflow definitions — {error}',
      title: 'No workflow definitions found',
      search: 'Try adjusting your search terms.',
      pristine: 'Create a workflow to automate state transitions.',
    },
    deleteModal: {
      title: 'Delete workflow',
      description:
        'Are you sure you want to delete this workflow definition? This action cannot be undone.',
    },
    notifications: {
      loadFailed: 'Failed to load workflow definitions',
      deleted: 'Workflow deleted successfully',
      deleteFailed: 'Failed to delete workflow',
    },
  },
  workflowDetail: {
    breadcrumbRoot: 'Workflow Definitions',
    breadcrumbNew: 'New Workflow',
    titleNew: 'New Workflow Definition',
    createWorkflow: 'Create Workflow',
    detailsHeading: 'Workflow Details',
    fields: {
      name: 'Name',
      namePlaceholder: 'Enter workflow name',
      description: 'Description',
      descriptionPlaceholder: 'Enter workflow description',
    },
    statistics: {
      title: 'Statistics',
      states: 'States',
      commands: 'Commands',
      initialState: 'Initial State',
      notSet: 'Not set',
    },
    statesOverview: {
      title: 'States Overview',
      initialBadge: 'Initial',
      endBadge: 'End',
      commandCount: '{count} cmd',
    },
    diagramTitle: 'State Diagram',
    diagramHint: 'Drag states to reposition • Edit a state from its menu • Click a command to edit it',
    validation: {
      nameRequired: 'Workflow name is required',
      noStates: 'Please add at least one state to the workflow',
      noInitialState: 'Please set an initial state',
    },
    notFound: {
      title: 'Workflow definition not found',
      description: 'It may have been deleted, or you may not have access to it.',
    },
    loadError: 'Failed to load workflow definition — {error}',
    notifications: {
      fetchFailed: 'Failed to fetch workflow definition',
      created: 'Workflow created successfully',
      updated: 'Workflow updated successfully',
      saveFailed: 'Failed to save workflow',
    },
  },
  diagram: {
    initialStateTooltip: 'Initial State',
    endStateTooltip: 'End State',
    editState: 'Edit State',
    deleteState: 'Delete State',
    commandTarget: '→ {state}',
    connectHint: 'Drag from a blue dot to another state',
    endStateNote: 'End state (no outgoing commands)',
    emptyTitle: 'No states defined yet',
    emptyHint: 'Add your first state',
    addStateAriaLabel: 'Add State',
    stateActionsAriaLabel: 'Actions for state {name}',
    deleteCommandAriaLabel: 'Delete command {name}',
  },
  stateModal: {
    titleAdd: 'Add State',
    titleEdit: 'Edit State',
    addState: 'Add State',
    fields: {
      name: 'State Name',
      namePlaceholder: 'e.g., Draft, Pending Approval, Published',
      endState: 'End State',
      endStateDescription: 'End states cannot have outgoing commands',
      initialState: 'Initial State',
      initialStateDescription: 'The state that new items start in',
    },
    validation: {
      nameRequired: 'State name is required',
      duplicateName: 'A state with this name already exists',
      endStateHasCommands:
        'This state has outgoing commands. Delete them before making it an end state.',
    },
  },
  commandModal: {
    titleAdd: 'Add Command',
    titleEdit: 'Edit Command',
    addCommand: 'Add Command',
    tabs: {
      general: 'General',
      actions: 'Actions ({count})',
      policies: 'Policies ({count})',
    },
    general: {
      noTargetStates:
        '⚠️ No target states available. You need at least two states to create a command (transition). Please add another state first.',
      name: 'Command Name',
      namePlaceholder: 'e.g., Submit, Approve, Reject',
      targetState: 'Target State',
      targetStatePlaceholder: 'Select the state this command transitions to',
      targetStatePlaceholderNone: 'No target states available',
      endStateOption: '{name} (End State)',
      route: 'From: <from>{from}</from> → To: <to>{to}</to>',
      routeUnsetTarget: '...',
    },
    actions: {
      promotionTitle: '💡 Version Promotion',
      promotionBody:
        'Use <code>xtr.item.promote</code> as the Event Name to promote a version to main. This action does not require any parameters.',
      heading: 'Actions to execute when this command is triggered',
      addAction: 'Add Action',
      emptyState:
        'No actions configured. Actions are optional but can automate tasks like sending notifications.',
      fallbackName: 'Action {number}',
      name: 'Action Name',
      namePlaceholder: 'e.g., Send Approval Email',
      eventName: 'Event Name (Optional)',
      eventNameDescription: 'The event identifier (e.g., xtr.send.notification, xtr.item.promote)',
      eventNamePlaceholder: 'Leave empty or use: xtr.item.promote, xtr.send.notification',
      parameters: 'Parameters (JSON, Optional)',
      parametersDescription: 'JSON object with event parameters (leave empty for xtr.item.promote)',
      parametersPlaceholder:
        'Leave empty or use: {"subject": "Notification", "message": "Item was approved"}',
      removeAction: 'Remove Action',
    },
    policies: {
      intro:
        'Select which policies can execute this command. Users must have at least one of the selected policies to use this command.',
      label: 'Allowed Policies',
      placeholder: 'Select policies',
      loading: 'Loading policies...',
      loadFailed: 'Failed to load policies',
      selectedHeading: 'Selected Policies:',
      openToAllWarning:
        '⚠️ No policies selected. This command will be available to all users with access to the workflow.',
      moduleAccessKeysNotice:
        'This command can also be run by users who hold one of these module access keys: {keys}',
    },
    validation: {
      nameRequired: 'Command name is required',
      targetStateRequired: 'Target state is required',
      duplicateName: 'A command with this name already exists in this state',
      invalidJson: 'Invalid JSON: {reason}',
    },
  },
  assignmentsManager: {
    title: 'Workflow Assignments',
    subtitle: 'Assign workflows to collections with optional filter rules',
    newAssignment: 'New Assignment',
    searchPlaceholder: 'Search by collection name...',
    itemsLabel: 'assignments',
    columns: {
      collection: 'Collection',
      workflow: 'Workflow',
      filterRule: 'Filter Rule',
      created: 'Created',
    },
    hasFilter: 'Has filter',
    noFilter: 'No filter',
    editAriaLabel: 'Edit assignment for {collection}',
    deleteAriaLabel: 'Delete assignment for {collection}',
    emptyState: {
      loadError: 'Failed to load workflow assignments — {error}',
      search: 'No workflow assignments match your search.',
      pristine:
        'No workflow assignments found. Create your first assignment to link a workflow with a collection.',
    },
    deleteModal: {
      title: 'Delete Workflow Assignment',
      description:
        'Are you sure you want to delete the assignment for collection <strong>{collection}</strong>? This action cannot be undone.',
    },
    notifications: {
      loadFailed: 'Failed to load workflow assignments',
      deleted: 'Workflow assignment deleted successfully',
      deleteFailed: 'Failed to delete workflow assignment',
    },
  },
  assignmentDetail: {
    breadcrumbRoot: 'Workflow Assignments',
    breadcrumbNew: 'New Assignment',
    breadcrumbEdit: 'Edit Assignment',
    titleNew: 'New Workflow Assignment',
    titleEdit: 'Edit Workflow Assignment',
    createAssignment: 'Create Assignment',
    fields: {
      workflow: 'Workflow',
      workflowPlaceholder: 'Select a workflow',
      collection: 'Collection',
      collectionDescription: 'The table/collection name this workflow applies to',
      collectionPlaceholder: 'Select a collection',
      filterRule: 'Filter Rule (JSON)',
      filterRuleDescription: 'Optional filter to conditionally apply workflow based on item properties',
      filterRulePlaceholder: '{"status": {"_eq": "draft"}}',
    },
    validation: {
      required: 'Workflow and Collection are required',
      filterRuleInvalidJson: 'Filter Rule must be valid JSON',
      filterRuleNotObject: 'Filter Rule must be a JSON object',
    },
    notFound: {
      title: 'Workflow assignment not found',
      description: 'It may have been deleted, or you may not have access to it.',
    },
    loadError: 'Failed to load workflow assignment — {error}',
    notifications: {
      fetchFailed: 'Failed to load workflow assignment',
      workflowsLoadFailed: 'Failed to load workflows',
      collectionsLoadFailed: 'Failed to load collections',
      created: 'Workflow assignment created successfully',
      updated: 'Workflow assignment updated successfully',
      createFailed: 'Failed to create workflow assignment',
      updateFailed: 'Failed to update workflow assignment',
    },
  },
  instancesManager: {
    title: 'Workflow Instances',
    subtitle: 'Active workflow instances tracking current state for items',
    searchPlaceholder: 'Search by collection, state, or item ID...',
    itemsLabel: 'instances',
    columns: {
      workflow: 'Workflow',
      collection: 'Collection',
      itemId: 'Item ID',
      currentState: 'Current State',
      version: 'Version',
      status: 'Status',
      created: 'Created',
    },
    viewDetails: 'View Details',
    emptyState: {
      loadError: 'Failed to load workflow instances — {error}',
      search: 'No workflow instances match your search.',
      pristine:
        'No workflow instances found. Instances are created automatically when items enter a workflow.',
    },
    notifications: {
      loadFailed: 'Failed to load workflow instances',
    },
  },
  instanceDetail: {
    breadcrumbRoot: 'Workflow Instances',
    breadcrumbCurrent: 'Instance Details',
    title: 'Workflow Instance Details',
    informationHeading: 'Instance Information',
    fields: {
      workflow: 'Workflow',
      currentState: 'Current State',
      collection: 'Collection',
      itemId: 'Item ID',
      versionKey: 'Version Key',
      created: 'Created',
      lastUpdated: 'Last Updated',
      instanceId: 'Instance ID',
    },
    notFound: {
      title: 'Workflow instance not found',
      description: 'It may have been deleted, or you may not have access to it.',
    },
    loadError: 'Failed to load workflow instance — {error}',
    history: {
      title: 'Transition History',
      emptyState: 'No transitions recorded yet. This instance is in its initial state.',
      loadError: 'Failed to load transition history — {error}',
      accessDenied: 'You do not have permission to view the transition history.',
      columns: {
        date: 'Date',
        command: 'Command',
        fromState: 'From State',
        toState: 'To State',
        transitionedBy: 'Transitioned By',
      },
    },
    notifications: {
      fetchFailed: 'Failed to load workflow instance',
      historyFetchFailed: 'Failed to load transition history',
    },
  },
};

export const workflowsId: WorkflowsTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Kesalahan Validasi',
  saveChanges: 'Simpan Perubahan',
  status: {
    active: 'Aktif',
    terminated: 'Selesai',
  },
  count: {
    workflows: { other: '{count} alur kerja' },
    assignments: { other: '{count} penugasan' },
    instances: { other: '{count} instans' },
    transitions: { other: '{count} transisi' },
  },
  searchInput: {
    clearAriaLabel: 'Bersihkan pencarian',
  },
  rowActions: {
    ariaLabel: 'Aksi baris',
  },
  listFooter: {
    showing: 'Menampilkan {shown} dari {totalCount} {itemsLabel}',
    perPage: '{n} / halaman',
    itemsPerPageAriaLabel: 'Item per halaman',
  },
  accessDenied: {
    title: 'Akses ditolak',
    description: 'Anda tidak memiliki izin untuk melihat ini.',
  },
  workflowsManager: {
    title: 'Definisi Alur Kerja',
    subtitle: 'Tentukan dan kelola alur kerja berbasis status untuk koleksi Anda.',
    addWorkflow: 'Tambah Alur Kerja',
    searchPlaceholder: 'Cari alur kerja berdasarkan nama atau deskripsi...',
    itemsLabel: 'alur kerja',
    emptyValue: '-',
    columns: {
      name: 'Nama',
      initialState: 'Status Awal',
      states: 'Status',
      description: 'Deskripsi',
    },
    emptyState: {
      loadError: 'Gagal memuat definisi alur kerja — {error}',
      title: 'Definisi alur kerja tidak ditemukan',
      search: 'Coba ubah kata kunci pencarian Anda.',
      pristine: 'Buat alur kerja untuk mengotomatiskan transisi status.',
    },
    deleteModal: {
      title: 'Hapus alur kerja',
      description:
        'Yakin ingin menghapus definisi alur kerja ini? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      loadFailed: 'Gagal memuat definisi alur kerja',
      deleted: 'Alur kerja berhasil dihapus',
      deleteFailed: 'Gagal menghapus alur kerja',
    },
  },
  workflowDetail: {
    breadcrumbRoot: 'Definisi Alur Kerja',
    breadcrumbNew: 'Alur Kerja Baru',
    titleNew: 'Definisi Alur Kerja Baru',
    createWorkflow: 'Buat Alur Kerja',
    detailsHeading: 'Detail Alur Kerja',
    fields: {
      name: 'Nama',
      namePlaceholder: 'Masukkan nama alur kerja',
      description: 'Deskripsi',
      descriptionPlaceholder: 'Masukkan deskripsi alur kerja',
    },
    statistics: {
      title: 'Statistik',
      states: 'Status',
      commands: 'Perintah',
      initialState: 'Status Awal',
      notSet: 'Belum diatur',
    },
    statesOverview: {
      title: 'Ringkasan Status',
      initialBadge: 'Awal',
      endBadge: 'Akhir',
      commandCount: '{count} perintah',
    },
    diagramTitle: 'Diagram Status',
    diagramHint:
      'Seret status untuk memindahkannya • Ubah status dari menunya • Klik perintah untuk mengubahnya',
    validation: {
      nameRequired: 'Nama alur kerja wajib diisi',
      noStates: 'Tambahkan setidaknya satu status ke alur kerja',
      noInitialState: 'Tentukan status awal',
    },
    notFound: {
      title: 'Definisi alur kerja tidak ditemukan',
      description: 'Mungkin sudah dihapus, atau Anda tidak memiliki akses ke sana.',
    },
    loadError: 'Gagal memuat definisi alur kerja — {error}',
    notifications: {
      fetchFailed: 'Gagal mengambil definisi alur kerja',
      created: 'Alur kerja berhasil dibuat',
      updated: 'Alur kerja berhasil diperbarui',
      saveFailed: 'Gagal menyimpan alur kerja',
    },
  },
  diagram: {
    initialStateTooltip: 'Status Awal',
    endStateTooltip: 'Status Akhir',
    editState: 'Ubah Status',
    deleteState: 'Hapus Status',
    commandTarget: '→ {state}',
    connectHint: 'Seret dari titik biru ke status lain',
    endStateNote: 'Status akhir (tanpa perintah keluar)',
    emptyTitle: 'Belum ada status yang ditentukan',
    emptyHint: 'Tambahkan status pertama Anda',
    addStateAriaLabel: 'Tambah Status',
    stateActionsAriaLabel: 'Aksi untuk status {name}',
    deleteCommandAriaLabel: 'Hapus perintah {name}',
  },
  stateModal: {
    titleAdd: 'Tambah Status',
    titleEdit: 'Ubah Status',
    addState: 'Tambah Status',
    fields: {
      name: 'Nama Status',
      namePlaceholder: 'mis. Draf, Menunggu Persetujuan, Diterbitkan',
      endState: 'Status Akhir',
      endStateDescription: 'Status akhir tidak dapat memiliki perintah keluar',
      initialState: 'Status Awal',
      initialStateDescription: 'Status tempat item baru dimulai',
    },
    validation: {
      nameRequired: 'Nama status wajib diisi',
      duplicateName: 'Status dengan nama ini sudah ada',
      endStateHasCommands:
        'Status ini memiliki perintah keluar. Hapus perintah tersebut sebelum menjadikannya status akhir.',
    },
  },
  commandModal: {
    titleAdd: 'Tambah Perintah',
    titleEdit: 'Ubah Perintah',
    addCommand: 'Tambah Perintah',
    tabs: {
      general: 'Umum',
      actions: 'Aksi ({count})',
      policies: 'Kebijakan ({count})',
    },
    general: {
      noTargetStates:
        '⚠️ Tidak ada status tujuan yang tersedia. Anda memerlukan setidaknya dua status untuk membuat perintah (transisi). Tambahkan status lain terlebih dahulu.',
      name: 'Nama Perintah',
      namePlaceholder: 'mis. Kirim, Setujui, Tolak',
      targetState: 'Status Tujuan',
      targetStatePlaceholder: 'Pilih status tujuan transisi perintah ini',
      targetStatePlaceholderNone: 'Tidak ada status tujuan yang tersedia',
      endStateOption: '{name} (Status Akhir)',
      route: 'Dari: <from>{from}</from> → Ke: <to>{to}</to>',
      routeUnsetTarget: '...',
    },
    actions: {
      promotionTitle: '💡 Promosi Versi',
      promotionBody:
        'Gunakan <code>xtr.item.promote</code> sebagai Nama Event untuk mempromosikan versi ke utama. Aksi ini tidak memerlukan parameter apa pun.',
      heading: 'Aksi yang dijalankan saat perintah ini dipicu',
      addAction: 'Tambah Aksi',
      emptyState:
        'Belum ada aksi yang dikonfigurasi. Aksi bersifat opsional tetapi dapat mengotomatiskan tugas seperti mengirim notifikasi.',
      fallbackName: 'Aksi {number}',
      name: 'Nama Aksi',
      namePlaceholder: 'mis. Kirim Email Persetujuan',
      eventName: 'Nama Event (Opsional)',
      eventNameDescription: 'Pengenal event (mis. xtr.send.notification, xtr.item.promote)',
      eventNamePlaceholder: 'Kosongkan atau gunakan: xtr.item.promote, xtr.send.notification',
      parameters: 'Parameter (JSON, Opsional)',
      parametersDescription: 'Objek JSON berisi parameter event (kosongkan untuk xtr.item.promote)',
      parametersPlaceholder:
        'Kosongkan atau gunakan: {"subject": "Notifikasi", "message": "Item telah disetujui"}',
      removeAction: 'Hapus Aksi',
    },
    policies: {
      intro:
        'Pilih kebijakan yang dapat menjalankan perintah ini. Pengguna harus memiliki setidaknya satu kebijakan yang dipilih untuk menggunakan perintah ini.',
      label: 'Kebijakan yang Diizinkan',
      placeholder: 'Pilih kebijakan',
      loading: 'Memuat kebijakan...',
      loadFailed: 'Gagal memuat kebijakan',
      selectedHeading: 'Kebijakan Terpilih:',
      openToAllWarning:
        '⚠️ Tidak ada kebijakan yang dipilih. Perintah ini akan tersedia bagi semua pengguna yang memiliki akses ke alur kerja.',
      moduleAccessKeysNotice:
        'Perintah ini juga dapat dijalankan oleh pengguna yang memiliki salah satu kunci akses modul berikut: {keys}',
    },
    validation: {
      nameRequired: 'Nama perintah wajib diisi',
      targetStateRequired: 'Status tujuan wajib diisi',
      duplicateName: 'Perintah dengan nama ini sudah ada di status ini',
      invalidJson: 'JSON tidak valid: {reason}',
    },
  },
  assignmentsManager: {
    title: 'Penugasan Alur Kerja',
    subtitle: 'Tetapkan alur kerja ke koleksi dengan aturan filter opsional',
    newAssignment: 'Penugasan Baru',
    searchPlaceholder: 'Cari berdasarkan nama koleksi...',
    itemsLabel: 'penugasan',
    columns: {
      collection: 'Koleksi',
      workflow: 'Alur Kerja',
      filterRule: 'Aturan Filter',
      created: 'Dibuat',
    },
    hasFilter: 'Ada filter',
    noFilter: 'Tanpa filter',
    editAriaLabel: 'Ubah penugasan untuk {collection}',
    deleteAriaLabel: 'Hapus penugasan untuk {collection}',
    emptyState: {
      loadError: 'Gagal memuat penugasan alur kerja — {error}',
      search: 'Tidak ada penugasan alur kerja yang cocok dengan pencarian Anda.',
      pristine:
        'Penugasan alur kerja tidak ditemukan. Buat penugasan pertama Anda untuk menghubungkan alur kerja dengan koleksi.',
    },
    deleteModal: {
      title: 'Hapus Penugasan Alur Kerja',
      description:
        'Yakin ingin menghapus penugasan untuk koleksi <strong>{collection}</strong>? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      loadFailed: 'Gagal memuat penugasan alur kerja',
      deleted: 'Penugasan alur kerja berhasil dihapus',
      deleteFailed: 'Gagal menghapus penugasan alur kerja',
    },
  },
  assignmentDetail: {
    breadcrumbRoot: 'Penugasan Alur Kerja',
    breadcrumbNew: 'Penugasan Baru',
    breadcrumbEdit: 'Ubah Penugasan',
    titleNew: 'Penugasan Alur Kerja Baru',
    titleEdit: 'Ubah Penugasan Alur Kerja',
    createAssignment: 'Buat Penugasan',
    fields: {
      workflow: 'Alur Kerja',
      workflowPlaceholder: 'Pilih alur kerja',
      collection: 'Koleksi',
      collectionDescription: 'Nama tabel/koleksi tempat alur kerja ini berlaku',
      collectionPlaceholder: 'Pilih koleksi',
      filterRule: 'Aturan Filter (JSON)',
      filterRuleDescription:
        'Filter opsional untuk menerapkan alur kerja secara bersyarat berdasarkan properti item',
      filterRulePlaceholder: '{"status": {"_eq": "draft"}}',
    },
    validation: {
      required: 'Alur Kerja dan Koleksi wajib diisi',
      filterRuleInvalidJson: 'Aturan Filter harus berupa JSON yang valid',
      filterRuleNotObject: 'Aturan Filter harus berupa objek JSON',
    },
    notFound: {
      title: 'Penugasan alur kerja tidak ditemukan',
      description: 'Mungkin sudah dihapus, atau Anda tidak memiliki akses ke sana.',
    },
    loadError: 'Gagal memuat penugasan alur kerja — {error}',
    notifications: {
      fetchFailed: 'Gagal memuat penugasan alur kerja',
      workflowsLoadFailed: 'Gagal memuat alur kerja',
      collectionsLoadFailed: 'Gagal memuat koleksi',
      created: 'Penugasan alur kerja berhasil dibuat',
      updated: 'Penugasan alur kerja berhasil diperbarui',
      createFailed: 'Gagal membuat penugasan alur kerja',
      updateFailed: 'Gagal memperbarui penugasan alur kerja',
    },
  },
  instancesManager: {
    title: 'Instans Alur Kerja',
    subtitle: 'Instans alur kerja aktif yang melacak status item saat ini',
    searchPlaceholder: 'Cari berdasarkan koleksi, status, atau ID item...',
    itemsLabel: 'instans',
    columns: {
      workflow: 'Alur Kerja',
      collection: 'Koleksi',
      itemId: 'ID Item',
      currentState: 'Status Saat Ini',
      version: 'Versi',
      status: 'Status Instans',
      created: 'Dibuat',
    },
    viewDetails: 'Lihat Detail',
    emptyState: {
      loadError: 'Gagal memuat instans alur kerja — {error}',
      search: 'Tidak ada instans alur kerja yang cocok dengan pencarian Anda.',
      pristine:
        'Instans alur kerja tidak ditemukan. Instans dibuat secara otomatis saat item memasuki alur kerja.',
    },
    notifications: {
      loadFailed: 'Gagal memuat instans alur kerja',
    },
  },
  instanceDetail: {
    breadcrumbRoot: 'Instans Alur Kerja',
    breadcrumbCurrent: 'Detail Instans',
    title: 'Detail Instans Alur Kerja',
    informationHeading: 'Informasi Instans',
    fields: {
      workflow: 'Alur Kerja',
      currentState: 'Status Saat Ini',
      collection: 'Koleksi',
      itemId: 'ID Item',
      versionKey: 'Kunci Versi',
      created: 'Dibuat',
      lastUpdated: 'Terakhir Diperbarui',
      instanceId: 'ID Instans',
    },
    notFound: {
      title: 'Instans alur kerja tidak ditemukan',
      description: 'Mungkin sudah dihapus, atau Anda tidak memiliki akses ke sana.',
    },
    loadError: 'Gagal memuat instans alur kerja — {error}',
    history: {
      title: 'Riwayat Transisi',
      emptyState: 'Belum ada transisi yang tercatat. Instans ini berada pada status awalnya.',
      loadError: 'Gagal memuat riwayat transisi — {error}',
      accessDenied: 'Anda tidak memiliki izin untuk melihat riwayat transisi.',
      columns: {
        date: 'Tanggal',
        command: 'Perintah',
        fromState: 'Dari Status',
        toState: 'Ke Status',
        transitionedBy: 'Ditransisikan Oleh',
      },
    },
    notifications: {
      fetchFailed: 'Gagal memuat instans alur kerja',
      historyFetchFailed: 'Gagal memuat riwayat transisi',
    },
  },
};
