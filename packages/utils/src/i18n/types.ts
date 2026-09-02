/**
 * Buildpad component i18n — dictionary shape.
 *
 * One namespace per package. `defaults.ts` holds the English strings (the only
 * place literals are allowed); `locales/*.ts` hold complete translations of the
 * same shape. Apps pass a (deep-partial) dictionary of this shape to
 * `BuildpadI18nProvider` once, in their root layout; every Buildpad component
 * reads it through `useBuildpadI18n()` / `useBuildpadTranslations()`.
 *
 * Conventions
 * - Placeholders use the `{key}` syntax from `interpolate()`.
 * - Countable strings are `PluralForms` objects resolved with
 *   `Intl.PluralRules` (see `plural.ts`); `{count}` is always available.
 * - Keys are additive: a new release may add keys, never rename or remove them,
 *   so a consumer's dictionary keeps working across `buildpad upgrade`.
 *
 * @module @buildpad/utils/i18n/types
 */

/** CLDR plural categories. `other` is mandatory — it is the universal fallback. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/** Recursive partial — what apps and props may pass as overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends PluralForms
      ? Partial<PluralForms>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

// ─── common ───────────────────────────────────────────────────────

/** Chrome shared by several packages: buttons, states, pagination. */
export interface CommonTranslations {
  loading: string;
  save: string;
  saving: string;
  cancel: string;
  create: string;
  edit: string;
  delete: string;
  deleting: string;
  remove: string;
  close: string;
  confirm: string;
  yes: string;
  no: string;
  ok: string;
  back: string;
  next: string;
  previous: string;
  search: string;
  /** Search input placeholder */
  searchPlaceholder: string;
  clear: string;
  apply: string;
  reset: string;
  refresh: string;
  retry: string;
  select: string;
  selectAll: string;
  deselectAll: string;
  actions: string;
  more: string;
  none: string;
  all: string;
  copy: string;
  copied: string;
  download: string;
  upload: string;
  open: string;
  view: string;
  error: string;
  success: string;
  warning: string;
  required: string;
  optional: string;
  unknown: string;
  /** Generic "something went wrong" body */
  somethingWentWrong: string;
  /** Pagination */
  perPage: string;
  /** "Showing {start} to {end} of {total}" */
  showingRange: string;
  /** "Page {page} of {pages}" */
  pageOf: string;
  /** "{count} items" — plural */
  itemCount: PluralForms;
  /** "{count} selected" — plural */
  selectedCount: PluralForms;
  unsavedChanges: string;
  /** Leave-page guard body */
  unsavedChangesPrompt: string;
  discardChanges: string;
  keepEditing: string;
  /** Delete confirmation */
  confirmDeleteTitle: string;
  /** "Are you sure you want to delete {count} item(s)?" — plural */
  confirmDeleteMessage: PluralForms;
  /** "Not allowed" tooltip for permission-gated actions */
  notAllowed: string;
  noPermission: string;
  /** Word joiner used when composing "Untitled" fallbacks */
  untitled: string;
}

// ─── form (ui-form) ───────────────────────────────────────────────

export interface FormValidationTranslations {
  required: string;
  unique: string;
  email: string;
  url: string;
  number: string;
  failed: string;
  /** "Validation error: {type}" */
  generic: string;
}

export interface FormTranslations {
  validation: FormValidationTranslations;
  errors: {
    /** "{count} validation error(s)" — plural */
    summary: PluralForms;
    /** Appended to an error for a hidden field */
    hidden: string;
    /** "(hidden in group: {group})" */
    hiddenInGroup: string;
  };
}

// ─── table (ui-table) ─────────────────────────────────────────────

export interface TableTranslations {
  loading: string;
  noItems: string;
  selectAll: string;
  selectRow: string;
  /** aria-label for the drag handle */
  dragToReorder: string;
  /** "Sort by {column}" */
  sortBy: string;
  sortAscending: string;
  sortDescending: string;
  /** Column resize handle aria-label */
  resizeColumn: string;
  /** Header for the row-actions column */
  actions: string;
}

// ─── interfaces (ui-interfaces) ───────────────────────────────────

/**
 * ListM2M strings. Keys are snake_case for backward compatibility with the
 * pre-existing `translations` prop of `ListM2M`.
 */
export interface ListM2MTranslations {
  // Header Actions
  create_new: string;
  add_existing: string;
  batch_edit: string;
  batch_edit_not_implemented: string;
  not_allowed: string;
  // States
  no_items: string;
  relationship_not_setup: string;
  relationship_not_setup_detail: string;
  no_singleton_relations: string;
  configuration_error: string;
  storybook_hint: string;
  loading: string;
  // Pagination
  per_page: string;
  showing_range: string;
  item_count_one: string;
  item_count_other: string;
  unsaved_changes: string;
  // Actions
  edit: string;
  remove: string;
  navigate_to_item: string;
  search_placeholder: string;
  select_items: string;
  add_selected: string;
  select_all: string;
  deselect_all: string;
  // Drawer
  create_item: string;
  edit_item: string;
  junction_fields: string;
  // Batch Edit
  batch_edit_title: string;
  batch_edit_apply: string;
  // Sorting
  move_up: string;
  move_down: string;
  drag_to_reorder: string;
  order: string;
  actions: string;
  // Versioning
  version: string;
  viewing_version: string;
  // Status badges
  badge_new: string;
  badge_edited: string;
  // Validation
  field_required: string;
  invalid_value: string;
}

export interface InterfacesTranslations {
  listM2M: ListM2MTranslations;
}

// ─── root ─────────────────────────────────────────────────────────

export interface BuildpadTranslations {
  common: CommonTranslations;
  form: FormTranslations;
  table: TableTranslations;
  interfaces: InterfacesTranslations;
}

/** What apps pass to the provider and what `locales/*.ts` export. */
export type BuildpadTranslationsInput = DeepPartial<BuildpadTranslations>;

/** Text direction of a locale. */
export type TextDirection = 'ltr' | 'rtl';

/** Values substituted into `{key}` placeholders. */
export type InterpolationValues = Record<string, string | number | boolean | null | undefined>;
