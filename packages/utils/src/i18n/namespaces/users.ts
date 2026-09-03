/**
 * `users` namespace — ui-users (UsersManager, UserDetail, RolesManager, RoleDetail,
 * PoliciesManager, PolicyDetail, ModuleAccessKeysManager, …).
 *
 * Keep the defaults and the Indonesian catalog in step — the parity test
 * enforces it. Every `PluralForms` entry has `{count}` available; the
 * Indonesian catalog only needs `other` (one plural category).
 *
 * Generic chrome (Cancel, Save, Delete, Error, Success, "Search...", "{count}
 * selected", the unsaved-changes prompt) comes from the shared `common`
 * namespace and is not repeated here.
 *
 * Rich text: a few strings carry `<tag>…</tag>` markers (`<link>`, `<strong>`,
 * `<remove>`) that the component maps to inline elements via
 * `splitTaggedText()` — keep the tags, translate the text between them.
 */
import type { PluralForms } from '../primitives';

export interface UsersTranslations {
  /** Marker shown in place of a missing value ("—") */
  emptyValue: string;
  /** Notification title for a client-side validation failure */
  validationErrorTitle: string;
  /** Heading / first tab of the detail forms */
  basicInformation: string;
  /** Dirty-state badge next to the detail titles */
  unsavedChanges: string;
  /** Info-panel row labels */
  created: string;
  updated: string;
  /** Shown for a user who has never signed in */
  never: string;
  /** Display labels for the `UserStatus` enum (Select options, bulk "Set status" menu) */
  status: {
    active: string;
    suspended: string;
    invited: string;
    draft: string;
    terminated: string;
  };
  /**
   * Lowercase status text as rendered by `UserStatusBadge` (Mantine uppercases
   * badge text via CSS) and inside sentences ("Status set to \"active\"").
   */
  statusBadge: {
    active: string;
    suspended: string;
    invited: string;
    draft: string;
    terminated: string;
  };
  /** Policy access-flag badges */
  policyAccess: {
    admin: string;
    app: string;
    delegate: string;
  };
  /** Column headers shared by the tables */
  columns: {
    name: string;
    description: string;
    access: string;
    email: string;
    status: string;
    users: string;
    roles: string;
  };
  /** Form labels shared by the detail forms */
  fields: {
    name: string;
    description: string;
    icon: string;
  };
  /** "{count} user(s)" style counts — toolbar badges and info-panel values */
  count: {
    users: PluralForms;
    roles: PluralForms;
    policies: PluralForms;
  };
  tokenInput: {
    label: string;
  };
  searchInput: {
    clearAriaLabel: string;
  };
  infoPanel: {
    title: string;
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
  deleteConfirm: {
    title: string;
    description: string;
  };
  policyPicker: {
    title: string;
    searchPlaceholder: string;
    loading: string;
    emptySearch: string;
    emptyAllAttached: string;
    /** Shown in the Description column when a policy has none */
    emptyDescription: string;
    /** "Select {name}" */
    selectAriaLabel: string;
    add: string;
    /** "Add ({count})" */
    addWithCount: string;
  };
  policyAttachment: {
    title: string;
    addButton: string;
    emptyState: string;
    /** Shown in the Description column when a policy has none */
    emptyDescription: string;
    openTooltip: string;
    /** "Open {name}" */
    openAriaLabel: string;
    removeTooltip: string;
    /** "Remove {name}" */
    removeAriaLabel: string;
    detachModal: {
      title: string;
      description: string;
      confirm: string;
    };
    notifications: {
      fetchFailed: string;
      attached: string;
      attachFailed: string;
      removed: string;
      removeFailed: string;
    };
  };
  rolePolicies: {
    emptyState: string;
  };
  userPolicies: {
    emptyState: string;
  };
  moduleAccessPanel: {
    loadError: string;
    adminNotice: string;
    /** "… <link>Create keys</link> …" — the tagged text becomes the registry link */
    empty: string;
  };
  moduleAccessKeys: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    addFolder: string;
    addKey: string;
    loadError: string;
    emptyState: {
      title: string;
      hint: string;
    };
    expand: string;
    collapse: string;
    drawer: {
      editFolder: string;
      editKey: string;
      newFolder: string;
      newKey: string;
    };
    form: {
      displayName: string;
      key: string;
      keyDescription: string;
      keyPlaceholder: string;
      parentFolder: string;
      parentFolderPlaceholder: string;
      sort: string;
    };
    validation: {
      displayNameRequired: string;
      keyRequired: string;
      keyFormat: string;
      /** "The \"{namespace}\" namespace is reserved …" */
      keyReserved: string;
    };
    notifications: {
      savedTitle: string;
      keyCreated: string;
      keyUpdated: string;
      saveFailedTitle: string;
      saveFailed: string;
      deletedTitle: string;
      keyRemoved: string;
      deleteFailedTitle: string;
      deleteFailed: string;
    };
    deleteModal: {
      title: string;
      /** "Delete the folder \"{name}\"? …" */
      folderDescription: string;
      /** "Delete the key \"{key}\"? …" */
      keyDescription: string;
    };
  };
  roleUsers: {
    title: string;
    addUser: string;
    emptyState: string;
    /** Fallback for the `roleName` prop in confirmation copy */
    defaultRoleName: string;
    moveTooltip: string;
    /** "Move {name} to another role" */
    moveAriaLabel: string;
    removeTooltip: string;
    /** "Remove {name} from this role" */
    removeAriaLabel: string;
    openTooltip: string;
    /** "Open {name}" */
    openAriaLabel: string;
    removeAll: string;
    moveAll: string;
    moveModal: {
      /** "Move {count} User(s) to Another Role" — plural */
      title: PluralForms;
      /** Rich text: `<strong>removed from “{roleName}”</strong>` … `<remove>Remove</remove>` */
      description: string;
      targetRoleLabel: string;
      targetRolePlaceholder: string;
      confirm: string;
    };
    notifications: {
      fetchFailed: string;
      /** "{count} user(s) removed from \"{roleName}\"" — plural */
      removed: PluralForms;
      removeFailed: string;
      /** "{count} user(s) moved to the selected role" — plural */
      moved: PluralForms;
      moveFailed: string;
    };
  };
  usersManager: {
    title: string;
    subtitle: string;
    addUser: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    columns: {
      user: string;
      email: string;
      role: string;
      status: string;
      lastAccess: string;
    };
    filters: {
      role: string;
      status: string;
    };
    bulk: {
      updateRoles: string;
      setStatus: string;
    };
    bulkRoles: {
      title: string;
      /** "Add and/or remove roles for {count} selected user(s). …" — plural */
      description: PluralForms;
      addLabel: string;
      addPlaceholder: string;
      removeLabel: string;
      removePlaceholder: string;
    };
    emptyState: {
      /** "Failed to load users — {error}" */
      loadError: string;
      filtered: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    bulkDeleteModal: {
      title: string;
      /** "Are you sure you want to delete {count} user(s)? …" — plural */
      description: PluralForms;
    };
    notifications: {
      loadFailed: string;
      deleteFailed: string;
      rolesUpdatedTitle: string;
      /** "Roles updated for {count} user(s)" — plural */
      rolesUpdated: PluralForms;
      rolesUpdateFailed: string;
      completedWithErrors: string;
      statusUpdatedTitle: string;
      /** "Status set to \"{status}\" for {count} user(s)" — plural; `{status}` is `statusBadge.*` */
      statusUpdated: PluralForms;
      /** "Status updated for {succeeded} of {total} users ({failed} failed)" */
      statusPartial: string;
      usersDeletedTitle: string;
      /** "Deleted {count} user(s)" — plural */
      deleted: PluralForms;
      /** "Deleted {succeeded} of {total} users ({failed} failed)" */
      deletePartial: string;
    };
  };
  rolesManager: {
    title: string;
    subtitle: string;
    addRole: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    emptyState: {
      /** "Failed to load roles — {error}" */
      loadError: string;
      search: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      loadFailed: string;
      deleteFailed: string;
    };
  };
  policiesManager: {
    title: string;
    subtitle: string;
    addPolicy: string;
    searchPlaceholder: string;
    /** Plural noun for the footer's "Showing N of M {itemsLabel}" */
    itemsLabel: string;
    emptyState: {
      /** "Failed to load policies — {error}" */
      loadError: string;
      search: string;
      pristine: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      loadFailed: string;
      deleteFailed: string;
    };
  };
  userDetail: {
    titleNew: string;
    titleEdit: string;
    noChangesTooltip: string;
    tabs: {
      policies: string;
    };
    theme: {
      auto: string;
      light: string;
      dark: string;
    };
    fields: {
      firstName: string;
      firstNamePlaceholder: string;
      lastName: string;
      lastNamePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      password: string;
      passwordPlaceholderNew: string;
      passwordPlaceholderEdit: string;
      roles: string;
      rolesPlaceholder: string;
      status: string;
      title: string;
      titlePlaceholder: string;
      descriptionPlaceholder: string;
      location: string;
      locationPlaceholder: string;
      tags: string;
      tagsPlaceholder: string;
      language: string;
      /** Sample locale code shown as the Language placeholder */
      languagePlaceholder: string;
      theme: string;
      themePlaceholder: string;
      token: string;
      tokenDescription: string;
    };
    validation: {
      emailRequired: string;
      passwordRequired: string;
      passwordMinLength: string;
      fixHighlighted: string;
    };
    info: {
      userId: string;
      lastAccess: string;
      policies: string;
      description: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      fetchFailed: string;
      created: string;
      updated: string;
      saveFailed: string;
      deleted: string;
      deleteFailed: string;
    };
  };
  roleDetail: {
    titleNew: string;
    titleEdit: string;
    childRoles: string;
    saveMenu: {
      stay: string;
      quit: string;
      addNew: string;
      discard: string;
    };
    tabs: {
      /** "Users ({count})" */
      users: string;
      /** "Policies ({count})" */
      policies: string;
    };
    fields: {
      namePlaceholder: string;
      descriptionPlaceholder: string;
      parentRole: string;
      parentRolePlaceholder: string;
    };
    scope: {
      label: string;
      description: string;
      patternsTitle: string;
      patternsHint: string;
      /** Sample regex shown in each pattern input */
      patternPlaceholder: string;
      invalidRegex: string;
      /** "Remove pattern {index}" */
      removePatternAriaLabel: string;
      addPattern: string;
      validationMessage: {
        label: string;
        description: string;
        placeholder: string;
      };
    };
    validation: {
      nameRequired: string;
      invalidScopePatterns: string;
    };
    info: {
      roleId: string;
      parentRole: string;
      users: string;
      policies: string;
      description: string;
    };
    unsavedModal: {
      title: string;
      keepEditing: string;
      discard: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      fetchFailed: string;
      created: string;
      updated: string;
      saveFailed: string;
      deleted: string;
      deleteFailed: string;
    };
  };
  policyDetail: {
    titleNew: string;
    titleEdit: string;
    accessControl: string;
    moduleLevelIntro: string;
    fields: {
      namePlaceholder: string;
      descriptionPlaceholder: string;
    };
    appAccess: {
      label: string;
      description: string;
    };
    adminAccess: {
      label: string;
      description: string;
    };
    delegateAccess: {
      label: string;
      description: string;
    };
    tabs: {
      recordLevel: string;
      moduleLevel: string;
    };
    permissions: {
      label: string;
      description: string;
    };
    validation: {
      nameRequired: string;
    };
    info: {
      policyId: string;
      users: string;
      roles: string;
      description: string;
    };
    deleteModal: {
      title: string;
      description: string;
    };
    notifications: {
      fetchFailed: string;
      created: string;
      updated: string;
      saveFailed: string;
      deleted: string;
      deleteFailed: string;
    };
  };
}

export const usersDefaults: UsersTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Validation Error',
  basicInformation: 'Basic Information',
  unsavedChanges: 'Unsaved Changes',
  created: 'Created',
  updated: 'Updated',
  never: 'Never',
  status: {
    active: 'Active',
    suspended: 'Suspended',
    invited: 'Invited',
    draft: 'Draft',
    terminated: 'Terminated',
  },
  statusBadge: {
    active: 'active',
    suspended: 'suspended',
    invited: 'invited',
    draft: 'draft',
    terminated: 'terminated',
  },
  policyAccess: {
    admin: 'Admin',
    app: 'App',
    delegate: 'Delegate',
  },
  columns: {
    name: 'Name',
    description: 'Description',
    access: 'Access',
    email: 'Email',
    status: 'Status',
    users: 'Users',
    roles: 'Roles',
  },
  fields: {
    name: 'Name',
    description: 'Description',
    icon: 'Icon',
  },
  count: {
    users: { one: '{count} user', other: '{count} users' },
    roles: { one: '{count} role', other: '{count} roles' },
    policies: { one: '{count} policy', other: '{count} policies' },
  },
  tokenInput: {
    label: 'Token',
  },
  searchInput: {
    clearAriaLabel: 'Clear search',
  },
  infoPanel: {
    title: 'Information',
  },
  rowActions: {
    ariaLabel: 'Row actions',
  },
  listFooter: {
    showing: 'Showing {shown} of {totalCount} {itemsLabel}',
    perPage: '{n} / page',
    itemsPerPageAriaLabel: 'Items per page',
  },
  deleteConfirm: {
    title: 'Confirm deletion',
    description: 'Are you sure you want to delete this item? This action cannot be undone.',
  },
  policyPicker: {
    title: 'Add Policies',
    searchPlaceholder: 'Search policies...',
    loading: 'Loading policies…',
    emptySearch: 'No policies found matching your search',
    emptyAllAttached: 'All policies are already attached',
    emptyDescription: '-',
    selectAriaLabel: 'Select {name}',
    add: 'Add',
    addWithCount: 'Add ({count})',
  },
  policyAttachment: {
    title: 'Policies',
    addButton: 'Add Policies',
    emptyState: 'No policies attached',
    emptyDescription: '-',
    openTooltip: 'Open policy',
    openAriaLabel: 'Open {name}',
    removeTooltip: 'Remove policy',
    removeAriaLabel: 'Remove {name}',
    detachModal: {
      title: 'Remove policy',
      description:
        'Are you sure you want to remove this policy? The user or role will lose the permissions it grants.',
      confirm: 'Remove',
    },
    notifications: {
      fetchFailed: 'Failed to fetch policies',
      attached: 'Policies attached successfully',
      attachFailed: 'Failed to attach policies',
      removed: 'Policy removed successfully',
      removeFailed: 'Failed to remove policy',
    },
  },
  rolePolicies: {
    emptyState: 'No policies attached to this role',
  },
  userPolicies: {
    emptyState: 'No policies attached directly to this user',
  },
  moduleAccessPanel: {
    loadError: 'Failed to load module access keys',
    adminNotice:
      'This policy grants Admin Access — the user already has all module-level capabilities. Toggles below are recorded but have no practical effect while Admin Access is on.',
    empty:
      'No module access keys defined. <link>Create keys</link> to start assigning module-level capabilities to this policy.',
  },
  moduleAccessKeys: {
    title: 'Module Access Keys',
    subtitle:
      'Application capability flags that policies can grant, independent of collection permissions.',
    searchPlaceholder: 'Search keys…',
    addFolder: 'Add Folder',
    addKey: 'Add Key',
    loadError: 'Failed to load module access keys',
    emptyState: {
      title: 'No module access keys',
      hint: 'Register a key to gate a feature that is not tied to a collection.',
    },
    expand: 'Expand',
    collapse: 'Collapse',
    drawer: {
      editFolder: 'Edit folder',
      editKey: 'Edit key',
      newFolder: 'New folder',
      newKey: 'New key',
    },
    form: {
      displayName: 'Display name',
      key: 'Key',
      keyDescription: 'Convention: <domain>:<capability>, e.g. reports:export',
      keyPlaceholder: 'reports:export',
      parentFolder: 'Parent folder',
      parentFolderPlaceholder: 'Top level',
      sort: 'Sort',
    },
    validation: {
      displayNameRequired: 'Display name is required',
      keyRequired: 'Key is required for a capability (leave the type as Folder to group instead)',
      keyFormat: 'Lowercase letters, digits and : _ . / - only, starting with a letter',
      keyReserved: 'The "{namespace}" namespace is reserved by the platform — use your own prefix',
    },
    notifications: {
      savedTitle: 'Saved',
      keyCreated: 'Key created',
      keyUpdated: 'Key updated',
      saveFailedTitle: 'Save failed',
      saveFailed: 'Could not save the key',
      deletedTitle: 'Deleted',
      keyRemoved: 'Key removed',
      deleteFailedTitle: 'Delete failed',
      deleteFailed: 'Could not delete the key',
    },
    deleteModal: {
      title: 'Delete module access key',
      folderDescription:
        'Delete the folder "{name}"? Its child keys are NOT deleted — they move to the top level.',
      keyDescription:
        'Delete the key "{key}"? Policies that currently grant it keep the entry, which will no longer match any registered key.',
    },
  },
  roleUsers: {
    title: 'Users',
    addUser: 'Add User',
    emptyState: 'No users assigned to this role',
    defaultRoleName: 'this role',
    moveTooltip: 'Move to another role',
    moveAriaLabel: 'Move {name} to another role',
    removeTooltip: 'Remove from this role',
    removeAriaLabel: 'Remove {name} from this role',
    openTooltip: 'Open user',
    openAriaLabel: 'Open {name}',
    removeAll: 'Remove All from Role',
    moveAll: 'Move All to Another Role',
    moveModal: {
      title: { other: 'Move {count} User(s) to Another Role' },
      description:
        'The selected user(s) will be <strong>removed from “{roleName}”</strong> and added to the role you choose below. Users can hold multiple roles — if you only want to remove them, close this dialog and use the <remove>Remove</remove> button instead.',
      targetRoleLabel: 'Target Role',
      targetRolePlaceholder: 'Select a role',
      confirm: 'Move',
    },
    notifications: {
      fetchFailed: 'Failed to fetch users',
      removed: { other: '{count} user(s) removed from "{roleName}"' },
      removeFailed: 'Failed to remove users from role',
      moved: { other: '{count} user(s) moved to the selected role' },
      moveFailed: 'Failed to move users',
    },
  },
  usersManager: {
    title: 'Users',
    subtitle: 'Manage user accounts, roles, and access permissions',
    addUser: 'Add User',
    searchPlaceholder: 'Search users...',
    itemsLabel: 'users',
    columns: {
      user: 'User',
      email: 'Email',
      role: 'Role',
      status: 'Status',
      lastAccess: 'Last Access',
    },
    filters: {
      role: 'Role',
      status: 'Status',
    },
    bulk: {
      updateRoles: 'Update roles…',
      setStatus: 'Set status',
    },
    bulkRoles: {
      title: 'Update roles',
      description: {
        one: 'Add and/or remove roles for {count} selected user. Users can hold multiple roles.',
        other: 'Add and/or remove roles for {count} selected users. Users can hold multiple roles.',
      },
      addLabel: 'Add roles',
      addPlaceholder: 'Select roles to add',
      removeLabel: 'Remove roles',
      removePlaceholder: 'Select roles to remove',
    },
    emptyState: {
      loadError: 'Failed to load users — {error}',
      filtered: 'No users found — try adjusting your filters',
      pristine: 'No users found — get started by adding your first user',
    },
    deleteModal: {
      title: 'Delete user',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
    },
    bulkDeleteModal: {
      title: 'Delete users',
      description: {
        one: 'Are you sure you want to delete {count} user? This action cannot be undone.',
        other: 'Are you sure you want to delete {count} users? This action cannot be undone.',
      },
    },
    notifications: {
      loadFailed: 'Failed to load users',
      deleteFailed: 'Failed to delete user',
      rolesUpdatedTitle: 'Roles updated',
      rolesUpdated: { one: 'Roles updated for {count} user', other: 'Roles updated for {count} users' },
      rolesUpdateFailed: 'Failed to update roles',
      completedWithErrors: 'Completed with errors',
      statusUpdatedTitle: 'Status updated',
      statusUpdated: {
        one: 'Status set to "{status}" for {count} user',
        other: 'Status set to "{status}" for {count} users',
      },
      statusPartial: 'Status updated for {succeeded} of {total} users ({failed} failed)',
      usersDeletedTitle: 'Users deleted',
      deleted: { one: 'Deleted {count} user', other: 'Deleted {count} users' },
      deletePartial: 'Deleted {succeeded} of {total} users ({failed} failed)',
    },
  },
  rolesManager: {
    title: 'Roles',
    subtitle: 'Define roles to group users and assign permissions',
    addRole: 'Add Role',
    searchPlaceholder: 'Search roles...',
    itemsLabel: 'roles',
    emptyState: {
      loadError: 'Failed to load roles — {error}',
      search: 'No roles found — try a different search term',
      pristine: 'No roles found — create your first role to get started',
    },
    deleteModal: {
      title: 'Delete role',
      description:
        'Are you sure you want to delete this role? Users in this role will need to be reassigned.',
    },
    notifications: {
      loadFailed: 'Failed to load roles',
      deleteFailed: 'Failed to delete role',
    },
  },
  policiesManager: {
    title: 'Policies',
    subtitle: 'Define policies that grant access and permissions to users and roles',
    addPolicy: 'Add Policy',
    searchPlaceholder: 'Search policies...',
    itemsLabel: 'policies',
    emptyState: {
      loadError: 'Failed to load policies — {error}',
      search: 'No policies found — try a different search term',
      pristine: 'No policies found — create your first policy to get started',
    },
    deleteModal: {
      title: 'Delete policy',
      description: 'Are you sure you want to delete this policy? This action cannot be undone.',
    },
    notifications: {
      loadFailed: 'Failed to load policies',
      deleteFailed: 'Failed to delete policy',
    },
  },
  userDetail: {
    titleNew: 'New User',
    titleEdit: 'Edit User',
    noChangesTooltip: 'No changes to save',
    tabs: {
      policies: 'Policies',
    },
    theme: {
      auto: 'Auto',
      light: 'Light',
      dark: 'Dark',
    },
    fields: {
      firstName: 'First Name',
      firstNamePlaceholder: 'Jane',
      lastName: 'Last Name',
      lastNamePlaceholder: 'Doe',
      email: 'Email',
      emailPlaceholder: 'jane@example.com',
      password: 'Password',
      passwordPlaceholderNew: 'Minimum 6 characters',
      passwordPlaceholderEdit: 'Leave blank to keep current password',
      roles: 'Roles',
      rolesPlaceholder: 'Assign roles',
      status: 'Status',
      title: 'Title',
      titlePlaceholder: 'Job title',
      descriptionPlaceholder: 'Notes about this user',
      location: 'Location',
      locationPlaceholder: 'City, Country',
      tags: 'Tags',
      tagsPlaceholder: 'Add tag',
      language: 'Language',
      languagePlaceholder: 'en-US',
      theme: 'Theme',
      themePlaceholder: 'Auto',
      token: 'Static API Token',
      tokenDescription:
        'Token for API access without a session. Generate a new value to rotate it; clear it to revoke.',
    },
    validation: {
      emailRequired: 'Email is required',
      passwordRequired: 'Password is required for new users',
      passwordMinLength: 'Password must be at least 6 characters',
      fixHighlighted: 'Please fix the highlighted fields',
    },
    info: {
      userId: 'User ID',
      lastAccess: 'Last Access',
      policies: 'Policies',
      description: 'User information and activity details',
    },
    deleteModal: {
      title: 'Delete user',
      description: 'Are you sure you want to delete this user? This action cannot be undone.',
    },
    notifications: {
      fetchFailed: 'Failed to fetch user',
      created: 'User created successfully',
      updated: 'User updated successfully',
      saveFailed: 'Failed to save user',
      deleted: 'User deleted successfully',
      deleteFailed: 'Failed to delete user',
    },
  },
  roleDetail: {
    titleNew: 'New Role',
    titleEdit: 'Edit Role',
    childRoles: 'Child Roles',
    saveMenu: {
      stay: 'Save & Stay',
      quit: 'Save & Quit',
      addNew: 'Save & Add New',
      discard: 'Discard Changes',
    },
    tabs: {
      users: 'Users ({count})',
      policies: 'Policies ({count})',
    },
    fields: {
      namePlaceholder: 'Administrator',
      descriptionPlaceholder: 'Role description',
      parentRole: 'Parent Role',
      parentRolePlaceholder: 'Select a parent role (optional)',
    },
    scope: {
      label: 'Scope Assignment Rules',
      description: 'Restrict which scopes users with this role can be assigned to',
      patternsTitle: 'Allowed Scope Patterns',
      patternsHint:
        'Regex patterns that scope URIs must match. Leave empty to block all scope assignments.',
      patternPlaceholder: '^/tenant:.*$',
      invalidRegex: 'Invalid regex',
      removePatternAriaLabel: 'Remove pattern {index}',
      addPattern: 'Add Pattern',
      validationMessage: {
        label: 'Validation Message',
        description: 'Custom error message shown when scope assignment is rejected',
        placeholder: 'This role can only be assigned to specific scopes',
      },
    },
    validation: {
      nameRequired: 'Name is required',
      invalidScopePatterns: 'Fix the invalid scope patterns before saving',
    },
    info: {
      roleId: 'Role ID',
      parentRole: 'Parent Role',
      users: 'Users',
      policies: 'Policies',
      description: 'Role information and assignments',
    },
    unsavedModal: {
      title: 'Unsaved Changes',
      keepEditing: 'Keep Editing',
      discard: 'Discard Changes',
    },
    deleteModal: {
      title: 'Delete role',
      description:
        'Are you sure you want to delete this role? Users in this role will need to be reassigned.',
    },
    notifications: {
      fetchFailed: 'Failed to fetch role',
      created: 'Role created successfully',
      updated: 'Role updated successfully',
      saveFailed: 'Failed to save role',
      deleted: 'Role deleted successfully',
      deleteFailed: 'Failed to delete role',
    },
  },
  policyDetail: {
    titleNew: 'New Policy',
    titleEdit: 'Edit Policy',
    accessControl: 'Access Control',
    moduleLevelIntro:
      'Application capabilities granted by this policy, independent of collection permissions.',
    fields: {
      namePlaceholder: 'Admin Policy',
      descriptionPlaceholder: 'Policy description',
    },
    appAccess: {
      label: 'App Access',
      description: 'Allow access to the app (requires minimal permissions)',
    },
    adminAccess: {
      label: 'Admin Access',
      description: 'Grant full administrative privileges',
    },
    delegateAccess: {
      label: 'Delegate Access',
      description:
        'Allow using X-On-Behalf-Of header to delegate audit identity in server-to-server requests',
    },
    tabs: {
      recordLevel: 'Record-Level Access',
      moduleLevel: 'Module-Level Access',
    },
    permissions: {
      label: 'Permissions',
      description: 'Per-collection permissions granted by this policy',
    },
    validation: {
      nameRequired: 'Name is required',
    },
    info: {
      policyId: 'Policy ID',
      users: 'Users',
      roles: 'Roles',
      description: 'Policy information and assignments',
    },
    deleteModal: {
      title: 'Delete policy',
      description: 'Are you sure you want to delete this policy? This action cannot be undone.',
    },
    notifications: {
      fetchFailed: 'Failed to fetch policy',
      created: 'Policy created successfully',
      updated: 'Policy updated successfully',
      saveFailed: 'Failed to save policy',
      deleted: 'Policy deleted successfully',
      deleteFailed: 'Failed to delete policy',
    },
  },
};

export const usersId: UsersTranslations = {
  emptyValue: '—',
  validationErrorTitle: 'Kesalahan Validasi',
  basicInformation: 'Informasi Dasar',
  unsavedChanges: 'Perubahan Belum Disimpan',
  created: 'Dibuat',
  updated: 'Diperbarui',
  never: 'Tidak pernah',
  status: {
    active: 'Aktif',
    suspended: 'Ditangguhkan',
    invited: 'Diundang',
    draft: 'Draf',
    terminated: 'Dihentikan',
  },
  statusBadge: {
    active: 'aktif',
    suspended: 'ditangguhkan',
    invited: 'diundang',
    draft: 'draf',
    terminated: 'dihentikan',
  },
  policyAccess: {
    admin: 'Admin',
    app: 'Aplikasi',
    delegate: 'Delegasi',
  },
  columns: {
    name: 'Nama',
    description: 'Deskripsi',
    access: 'Akses',
    email: 'Email',
    status: 'Status',
    users: 'Pengguna',
    roles: 'Peran',
  },
  fields: {
    name: 'Nama',
    description: 'Deskripsi',
    icon: 'Ikon',
  },
  count: {
    users: { other: '{count} pengguna' },
    roles: { other: '{count} peran' },
    policies: { other: '{count} kebijakan' },
  },
  tokenInput: {
    label: 'Token',
  },
  searchInput: {
    clearAriaLabel: 'Bersihkan pencarian',
  },
  infoPanel: {
    title: 'Informasi',
  },
  rowActions: {
    ariaLabel: 'Aksi baris',
  },
  listFooter: {
    showing: 'Menampilkan {shown} dari {totalCount} {itemsLabel}',
    perPage: '{n} / halaman',
    itemsPerPageAriaLabel: 'Item per halaman',
  },
  deleteConfirm: {
    title: 'Konfirmasi penghapusan',
    description: 'Yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.',
  },
  policyPicker: {
    title: 'Tambah Kebijakan',
    searchPlaceholder: 'Cari kebijakan...',
    loading: 'Memuat kebijakan…',
    emptySearch: 'Tidak ada kebijakan yang cocok dengan pencarian Anda',
    emptyAllAttached: 'Semua kebijakan sudah terpasang',
    emptyDescription: '-',
    selectAriaLabel: 'Pilih {name}',
    add: 'Tambah',
    addWithCount: 'Tambah ({count})',
  },
  policyAttachment: {
    title: 'Kebijakan',
    addButton: 'Tambah Kebijakan',
    emptyState: 'Tidak ada kebijakan terpasang',
    emptyDescription: '-',
    openTooltip: 'Buka kebijakan',
    openAriaLabel: 'Buka {name}',
    removeTooltip: 'Lepas kebijakan',
    removeAriaLabel: 'Lepas {name}',
    detachModal: {
      title: 'Lepas kebijakan',
      description:
        'Yakin ingin melepas kebijakan ini? Pengguna atau peran akan kehilangan izin yang diberikannya.',
      confirm: 'Lepas',
    },
    notifications: {
      fetchFailed: 'Gagal mengambil kebijakan',
      attached: 'Kebijakan berhasil dipasang',
      attachFailed: 'Gagal memasang kebijakan',
      removed: 'Kebijakan berhasil dilepas',
      removeFailed: 'Gagal melepas kebijakan',
    },
  },
  rolePolicies: {
    emptyState: 'Tidak ada kebijakan yang terpasang pada peran ini',
  },
  userPolicies: {
    emptyState: 'Tidak ada kebijakan yang terpasang langsung pada pengguna ini',
  },
  moduleAccessPanel: {
    loadError: 'Gagal memuat kunci akses modul',
    adminNotice:
      'Kebijakan ini memberikan Akses Admin — pengguna sudah memiliki semua kemampuan tingkat modul. Sakelar di bawah ini tetap dicatat tetapi tidak berpengaruh selama Akses Admin aktif.',
    empty:
      'Belum ada kunci akses modul. <link>Buat kunci</link> untuk mulai memberikan kemampuan tingkat modul pada kebijakan ini.',
  },
  moduleAccessKeys: {
    title: 'Kunci Akses Modul',
    subtitle:
      'Penanda kemampuan aplikasi yang dapat diberikan oleh kebijakan, terlepas dari izin koleksi.',
    searchPlaceholder: 'Cari kunci…',
    addFolder: 'Tambah Folder',
    addKey: 'Tambah Kunci',
    loadError: 'Gagal memuat kunci akses modul',
    emptyState: {
      title: 'Tidak ada kunci akses modul',
      hint: 'Daftarkan kunci untuk membatasi fitur yang tidak terkait dengan koleksi.',
    },
    expand: 'Perluas',
    collapse: 'Ciutkan',
    drawer: {
      editFolder: 'Ubah folder',
      editKey: 'Ubah kunci',
      newFolder: 'Folder baru',
      newKey: 'Kunci baru',
    },
    form: {
      displayName: 'Nama tampilan',
      key: 'Kunci',
      keyDescription: 'Konvensi: <domain>:<kemampuan>, mis. reports:export',
      keyPlaceholder: 'reports:export',
      parentFolder: 'Folder induk',
      parentFolderPlaceholder: 'Tingkat atas',
      sort: 'Urutan',
    },
    validation: {
      displayNameRequired: 'Nama tampilan wajib diisi',
      keyRequired:
        'Kunci wajib diisi untuk sebuah kemampuan (biarkan tipenya Folder jika hanya untuk mengelompokkan)',
      keyFormat: 'Hanya huruf kecil, angka, dan : _ . / - yang diizinkan, diawali dengan huruf',
      keyReserved: 'Namespace "{namespace}" dicadangkan oleh platform — gunakan prefiks Anda sendiri',
    },
    notifications: {
      savedTitle: 'Tersimpan',
      keyCreated: 'Kunci dibuat',
      keyUpdated: 'Kunci diperbarui',
      saveFailedTitle: 'Gagal menyimpan',
      saveFailed: 'Tidak dapat menyimpan kunci',
      deletedTitle: 'Terhapus',
      keyRemoved: 'Kunci dihapus',
      deleteFailedTitle: 'Gagal menghapus',
      deleteFailed: 'Tidak dapat menghapus kunci',
    },
    deleteModal: {
      title: 'Hapus kunci akses modul',
      folderDescription:
        'Hapus folder "{name}"? Kunci di dalamnya TIDAK ikut terhapus — kunci tersebut dipindahkan ke tingkat atas.',
      keyDescription:
        'Hapus kunci "{key}"? Kebijakan yang saat ini memberikannya tetap menyimpan entri tersebut, yang tidak akan lagi cocok dengan kunci terdaftar mana pun.',
    },
  },
  roleUsers: {
    title: 'Pengguna',
    addUser: 'Tambah Pengguna',
    emptyState: 'Tidak ada pengguna dengan peran ini',
    defaultRoleName: 'peran ini',
    moveTooltip: 'Pindahkan ke peran lain',
    moveAriaLabel: 'Pindahkan {name} ke peran lain',
    removeTooltip: 'Hapus dari peran ini',
    removeAriaLabel: 'Hapus {name} dari peran ini',
    openTooltip: 'Buka pengguna',
    openAriaLabel: 'Buka {name}',
    removeAll: 'Hapus Semua dari Peran',
    moveAll: 'Pindahkan Semua ke Peran Lain',
    moveModal: {
      title: { other: 'Pindahkan {count} Pengguna ke Peran Lain' },
      description:
        'Pengguna yang dipilih akan <strong>dihapus dari “{roleName}”</strong> dan ditambahkan ke peran yang Anda pilih di bawah ini. Pengguna dapat memiliki beberapa peran — jika Anda hanya ingin menghapusnya, tutup dialog ini dan gunakan tombol <remove>Hapus</remove>.',
      targetRoleLabel: 'Peran Tujuan',
      targetRolePlaceholder: 'Pilih peran',
      confirm: 'Pindahkan',
    },
    notifications: {
      fetchFailed: 'Gagal mengambil pengguna',
      removed: { other: '{count} pengguna dihapus dari "{roleName}"' },
      removeFailed: 'Gagal menghapus pengguna dari peran',
      moved: { other: '{count} pengguna dipindahkan ke peran yang dipilih' },
      moveFailed: 'Gagal memindahkan pengguna',
    },
  },
  usersManager: {
    title: 'Pengguna',
    subtitle: 'Kelola akun pengguna, peran, dan izin akses',
    addUser: 'Tambah Pengguna',
    searchPlaceholder: 'Cari pengguna...',
    itemsLabel: 'pengguna',
    columns: {
      user: 'Pengguna',
      email: 'Email',
      role: 'Peran',
      status: 'Status',
      lastAccess: 'Akses Terakhir',
    },
    filters: {
      role: 'Peran',
      status: 'Status',
    },
    bulk: {
      updateRoles: 'Perbarui peran…',
      setStatus: 'Atur status',
    },
    bulkRoles: {
      title: 'Perbarui peran',
      description: {
        other:
          'Tambah dan/atau hapus peran untuk {count} pengguna yang dipilih. Pengguna dapat memiliki beberapa peran.',
      },
      addLabel: 'Tambah peran',
      addPlaceholder: 'Pilih peran yang akan ditambahkan',
      removeLabel: 'Hapus peran',
      removePlaceholder: 'Pilih peran yang akan dihapus',
    },
    emptyState: {
      loadError: 'Gagal memuat pengguna — {error}',
      filtered: 'Tidak ada pengguna ditemukan — coba sesuaikan filter Anda',
      pristine: 'Tidak ada pengguna ditemukan — mulai dengan menambahkan pengguna pertama Anda',
    },
    deleteModal: {
      title: 'Hapus pengguna',
      description: 'Yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.',
    },
    bulkDeleteModal: {
      title: 'Hapus pengguna',
      description: {
        other: 'Yakin ingin menghapus {count} pengguna? Tindakan ini tidak dapat dibatalkan.',
      },
    },
    notifications: {
      loadFailed: 'Gagal memuat pengguna',
      deleteFailed: 'Gagal menghapus pengguna',
      rolesUpdatedTitle: 'Peran diperbarui',
      rolesUpdated: { other: 'Peran diperbarui untuk {count} pengguna' },
      rolesUpdateFailed: 'Gagal memperbarui peran',
      completedWithErrors: 'Selesai dengan kesalahan',
      statusUpdatedTitle: 'Status diperbarui',
      statusUpdated: { other: 'Status diatur ke "{status}" untuk {count} pengguna' },
      statusPartial: 'Status diperbarui untuk {succeeded} dari {total} pengguna ({failed} gagal)',
      usersDeletedTitle: 'Pengguna dihapus',
      deleted: { other: '{count} pengguna dihapus' },
      deletePartial: '{succeeded} dari {total} pengguna dihapus ({failed} gagal)',
    },
  },
  rolesManager: {
    title: 'Peran',
    subtitle: 'Tentukan peran untuk mengelompokkan pengguna dan memberikan izin',
    addRole: 'Tambah Peran',
    searchPlaceholder: 'Cari peran...',
    itemsLabel: 'peran',
    emptyState: {
      loadError: 'Gagal memuat peran — {error}',
      search: 'Tidak ada peran ditemukan — coba kata kunci pencarian lain',
      pristine: 'Tidak ada peran ditemukan — buat peran pertama Anda untuk memulai',
    },
    deleteModal: {
      title: 'Hapus peran',
      description: 'Yakin ingin menghapus peran ini? Pengguna dengan peran ini perlu ditetapkan ulang.',
    },
    notifications: {
      loadFailed: 'Gagal memuat peran',
      deleteFailed: 'Gagal menghapus peran',
    },
  },
  policiesManager: {
    title: 'Kebijakan',
    subtitle: 'Tentukan kebijakan yang memberikan akses dan izin kepada pengguna dan peran',
    addPolicy: 'Tambah Kebijakan',
    searchPlaceholder: 'Cari kebijakan...',
    itemsLabel: 'kebijakan',
    emptyState: {
      loadError: 'Gagal memuat kebijakan — {error}',
      search: 'Tidak ada kebijakan ditemukan — coba kata kunci pencarian lain',
      pristine: 'Tidak ada kebijakan ditemukan — buat kebijakan pertama Anda untuk memulai',
    },
    deleteModal: {
      title: 'Hapus kebijakan',
      description: 'Yakin ingin menghapus kebijakan ini? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      loadFailed: 'Gagal memuat kebijakan',
      deleteFailed: 'Gagal menghapus kebijakan',
    },
  },
  userDetail: {
    titleNew: 'Pengguna Baru',
    titleEdit: 'Ubah Pengguna',
    noChangesTooltip: 'Tidak ada perubahan untuk disimpan',
    tabs: {
      policies: 'Kebijakan',
    },
    theme: {
      auto: 'Otomatis',
      light: 'Terang',
      dark: 'Gelap',
    },
    fields: {
      firstName: 'Nama Depan',
      firstNamePlaceholder: 'Jane',
      lastName: 'Nama Belakang',
      lastNamePlaceholder: 'Doe',
      email: 'Email',
      emailPlaceholder: 'jane@example.com',
      password: 'Kata Sandi',
      passwordPlaceholderNew: 'Minimal 6 karakter',
      passwordPlaceholderEdit: 'Kosongkan untuk mempertahankan kata sandi saat ini',
      roles: 'Peran',
      rolesPlaceholder: 'Tetapkan peran',
      status: 'Status',
      title: 'Jabatan',
      titlePlaceholder: 'Jabatan pekerjaan',
      descriptionPlaceholder: 'Catatan tentang pengguna ini',
      location: 'Lokasi',
      locationPlaceholder: 'Kota, Negara',
      tags: 'Tag',
      tagsPlaceholder: 'Tambah tag',
      language: 'Bahasa',
      languagePlaceholder: 'id-ID',
      theme: 'Tema',
      themePlaceholder: 'Otomatis',
      token: 'Token API Statis',
      tokenDescription:
        'Token untuk akses API tanpa sesi. Buat nilai baru untuk merotasinya; bersihkan untuk mencabutnya.',
    },
    validation: {
      emailRequired: 'Email wajib diisi',
      passwordRequired: 'Kata sandi wajib diisi untuk pengguna baru',
      passwordMinLength: 'Kata sandi minimal 6 karakter',
      fixHighlighted: 'Harap perbaiki kolom yang ditandai',
    },
    info: {
      userId: 'ID Pengguna',
      lastAccess: 'Akses Terakhir',
      policies: 'Kebijakan',
      description: 'Informasi pengguna dan detail aktivitas',
    },
    deleteModal: {
      title: 'Hapus pengguna',
      description: 'Yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      fetchFailed: 'Gagal mengambil pengguna',
      created: 'Pengguna berhasil dibuat',
      updated: 'Pengguna berhasil diperbarui',
      saveFailed: 'Gagal menyimpan pengguna',
      deleted: 'Pengguna berhasil dihapus',
      deleteFailed: 'Gagal menghapus pengguna',
    },
  },
  roleDetail: {
    titleNew: 'Peran Baru',
    titleEdit: 'Ubah Peran',
    childRoles: 'Peran Turunan',
    saveMenu: {
      stay: 'Simpan & Tetap di Sini',
      quit: 'Simpan & Keluar',
      addNew: 'Simpan & Tambah Baru',
      discard: 'Buang Perubahan',
    },
    tabs: {
      users: 'Pengguna ({count})',
      policies: 'Kebijakan ({count})',
    },
    fields: {
      namePlaceholder: 'Administrator',
      descriptionPlaceholder: 'Deskripsi peran',
      parentRole: 'Peran Induk',
      parentRolePlaceholder: 'Pilih peran induk (opsional)',
    },
    scope: {
      label: 'Aturan Penetapan Lingkup',
      description: 'Batasi lingkup mana yang dapat ditetapkan untuk pengguna dengan peran ini',
      patternsTitle: 'Pola Lingkup yang Diizinkan',
      patternsHint:
        'Pola regex yang harus cocok dengan URI lingkup. Kosongkan untuk memblokir semua penetapan lingkup.',
      patternPlaceholder: '^/tenant:.*$',
      invalidRegex: 'Regex tidak valid',
      removePatternAriaLabel: 'Hapus pola {index}',
      addPattern: 'Tambah Pola',
      validationMessage: {
        label: 'Pesan Validasi',
        description: 'Pesan kesalahan khusus yang ditampilkan saat penetapan lingkup ditolak',
        placeholder: 'Peran ini hanya dapat ditetapkan untuk lingkup tertentu',
      },
    },
    validation: {
      nameRequired: 'Nama wajib diisi',
      invalidScopePatterns: 'Perbaiki pola lingkup yang tidak valid sebelum menyimpan',
    },
    info: {
      roleId: 'ID Peran',
      parentRole: 'Peran Induk',
      users: 'Pengguna',
      policies: 'Kebijakan',
      description: 'Informasi peran dan penetapannya',
    },
    unsavedModal: {
      title: 'Perubahan Belum Disimpan',
      keepEditing: 'Lanjutkan Mengedit',
      discard: 'Buang Perubahan',
    },
    deleteModal: {
      title: 'Hapus peran',
      description: 'Yakin ingin menghapus peran ini? Pengguna dengan peran ini perlu ditetapkan ulang.',
    },
    notifications: {
      fetchFailed: 'Gagal mengambil peran',
      created: 'Peran berhasil dibuat',
      updated: 'Peran berhasil diperbarui',
      saveFailed: 'Gagal menyimpan peran',
      deleted: 'Peran berhasil dihapus',
      deleteFailed: 'Gagal menghapus peran',
    },
  },
  policyDetail: {
    titleNew: 'Kebijakan Baru',
    titleEdit: 'Ubah Kebijakan',
    accessControl: 'Kontrol Akses',
    moduleLevelIntro:
      'Kemampuan aplikasi yang diberikan oleh kebijakan ini, terlepas dari izin koleksi.',
    fields: {
      namePlaceholder: 'Kebijakan Admin',
      descriptionPlaceholder: 'Deskripsi kebijakan',
    },
    appAccess: {
      label: 'Akses Aplikasi',
      description: 'Izinkan akses ke aplikasi (memerlukan izin minimal)',
    },
    adminAccess: {
      label: 'Akses Admin',
      description: 'Berikan hak administratif penuh',
    },
    delegateAccess: {
      label: 'Akses Delegasi',
      description:
        'Izinkan penggunaan header X-On-Behalf-Of untuk mendelegasikan identitas audit pada permintaan server-ke-server',
    },
    tabs: {
      recordLevel: 'Akses Tingkat Rekaman',
      moduleLevel: 'Akses Tingkat Modul',
    },
    permissions: {
      label: 'Izin',
      description: 'Izin per koleksi yang diberikan oleh kebijakan ini',
    },
    validation: {
      nameRequired: 'Nama wajib diisi',
    },
    info: {
      policyId: 'ID Kebijakan',
      users: 'Pengguna',
      roles: 'Peran',
      description: 'Informasi kebijakan dan penetapannya',
    },
    deleteModal: {
      title: 'Hapus kebijakan',
      description: 'Yakin ingin menghapus kebijakan ini? Tindakan ini tidak dapat dibatalkan.',
    },
    notifications: {
      fetchFailed: 'Gagal mengambil kebijakan',
      created: 'Kebijakan berhasil dibuat',
      updated: 'Kebijakan berhasil diperbarui',
      saveFailed: 'Gagal menyimpan kebijakan',
      deleted: 'Kebijakan berhasil dihapus',
      deleteFailed: 'Gagal menghapus kebijakan',
    },
  },
};
