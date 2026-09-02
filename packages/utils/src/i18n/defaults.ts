/**
 * English defaults — the ONLY place user-facing literals are allowed in
 * Buildpad packages. Every component reads its strings from here through
 * `useBuildpadTranslations()`; apps override them via `BuildpadI18nProvider`.
 *
 * Keep keys in sync with `locales/*.ts` (the parity test in
 * `utils/tests/i18n.test.ts` fails when a locale misses a key).
 */
import type { BuildpadTranslations } from './types';

export const defaultTranslations: BuildpadTranslations = {
  common: {
    loading: 'Loading...',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    deleting: 'Deleting...',
    remove: 'Remove',
    close: 'Close',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    search: 'Search',
    searchPlaceholder: 'Search...',
    clear: 'Clear',
    apply: 'Apply',
    reset: 'Reset',
    refresh: 'Refresh',
    retry: 'Retry',
    select: 'Select',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    actions: 'Actions',
    more: 'More',
    none: 'None',
    all: 'All',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Download',
    upload: 'Upload',
    open: 'Open',
    view: 'View',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    required: 'Required',
    optional: 'Optional',
    unknown: 'Unknown',
    somethingWentWrong: 'Something went wrong',
    perPage: 'Items per page:',
    showingRange: 'Showing {start} to {end} of {total}',
    pageOf: 'Page {page} of {pages}',
    itemCount: { one: '{count} item', other: '{count} items' },
    selectedCount: { one: '{count} selected', other: '{count} selected' },
    unsavedChanges: 'Unsaved changes',
    unsavedChangesPrompt: 'You have unsaved changes. Are you sure you want to leave?',
    discardChanges: 'Discard changes',
    keepEditing: 'Keep editing',
    confirmDeleteTitle: 'Confirm delete',
    confirmDeleteMessage: {
      one: 'Are you sure you want to delete this item? This action cannot be undone.',
      other: 'Are you sure you want to delete {count} items? This action cannot be undone.',
    },
    notAllowed: 'Not allowed',
    noPermission: 'You do not have permission to perform this action',
    untitled: 'Untitled',
  },

  form: {
    validation: {
      required: 'This field is required',
      unique: 'This value must be unique',
      email: 'Must be a valid email address',
      url: 'Must be a valid URL',
      number: 'Must be a valid number',
      failed: 'Validation failed',
      generic: 'Validation error: {type}',
    },
    errors: {
      summary: { one: '{count} validation error', other: '{count} validation errors' },
      hidden: '(hidden)',
      hiddenInGroup: '(hidden in group: {group})',
    },
  },

  table: {
    loading: 'Loading...',
    noItems: 'No items',
    selectAll: 'Select all rows',
    selectRow: 'Select row',
    dragToReorder: 'Drag to reorder',
    sortBy: 'Sort by {column}',
    sortAscending: 'Sorted ascending',
    sortDescending: 'Sorted descending',
    resizeColumn: 'Resize column',
    actions: 'Actions',
  },

  interfaces: {
    listM2M: {
      // Header Actions
      create_new: 'Create New',
      add_existing: 'Add Existing',
      batch_edit: 'Edit Selected',
      batch_edit_not_implemented: 'Batch editing is not yet implemented',
      not_allowed: 'Not allowed',
      // States
      no_items: 'No related items',
      relationship_not_setup: 'Relationship not configured',
      relationship_not_setup_detail:
        'The many-to-many relationship is not properly configured for this field.',
      no_singleton_relations:
        'The related collection is a singleton and cannot be used in an M2M relationship.',
      configuration_error: 'Configuration Error',
      storybook_hint:
        'In Storybook, relational interfaces require API proxy routes. This component works fully in a Next.js app with DaaS integration.',
      loading: 'Loading...',
      // Pagination
      per_page: 'Items per page:',
      showing_range: 'Showing {start} to {end} of {total}',
      item_count_one: '1 item',
      item_count_other: '{count} items',
      unsaved_changes: '(unsaved changes)',
      // Actions
      edit: 'Edit',
      remove: 'Remove',
      navigate_to_item: 'Open item',
      search_placeholder: 'Search...',
      select_items: 'Select Items',
      add_selected: 'Add Selected',
      select_all: 'Select All',
      deselect_all: 'Deselect All',
      // Drawer
      create_item: 'Create New Item',
      edit_item: 'Edit Item',
      junction_fields: 'Junction Fields',
      // Batch Edit
      batch_edit_title: 'Editing {count} items',
      batch_edit_apply: 'Apply Changes',
      // Sorting
      move_up: 'Move up',
      move_down: 'Move down',
      drag_to_reorder: 'Drag to reorder',
      order: 'Order',
      actions: 'Actions',
      // Versioning
      version: 'Version',
      viewing_version: 'Viewing version: {name}',
      // Status badges
      badge_new: 'NEW',
      badge_edited: 'EDITED',
      // Validation
      field_required: 'This field is required',
      invalid_value: 'Invalid value',
    },
  },
};

export default defaultTranslations;
