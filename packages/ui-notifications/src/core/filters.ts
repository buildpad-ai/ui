import type { Filter } from './types';

/** One inbox tab: a key for the URL, a label, and the server-side clause it adds. */
export interface NotificationTab {
  key: string;
  label?: string;
  /** Clause ANDed with the recipient clause; omit for "everything". */
  clause?: Filter;
}

/** Column names the filters touch. */
export interface FilterFields {
  recipient: string;
  readAt: string;
  createdAt: string;
  id: string;
}

export const DEFAULT_FILTER_FIELDS: FilterFields = { recipient: 'recipient', readAt: 'read_at', createdAt: 'created_at', id: 'id' };

/** Built-ins followed by the app's own tabs; an app tab with a built-in key replaces it. */
export function resolveTabs(extra: NotificationTab[] = [], fields: FilterFields = DEFAULT_FILTER_FIELDS): NotificationTab[] {
  const builtins: NotificationTab[] = [
    { key: 'all' },
    { key: 'unread', clause: { [fields.readAt]: { _null: true } } },
  ];
  const byKey = new Map(extra.map((t) => [t.key, t]));
  const merged = builtins.map((t) => byKey.get(t.key) ?? t);
  return [...merged, ...extra.filter((t) => !builtins.some((b) => b.key === t.key))];
}

export const findTab = (tabs: NotificationTab[], key: string | null | undefined) =>
  tabs.find((t) => t.key === key) ?? tabs[0];

/**
 * ONE DaaS filter: `{_and: [recipient = meId, ...clauses]}`. The recipient clause is always there,
 * whatever the tab, so a row of someone else can never be asked for.
 */
export function buildFilter(meId: string, clauses: Array<Filter | undefined | null> = [], fields: FilterFields = DEFAULT_FILTER_FIELDS): Filter {
  const and: Filter[] = [{ [fields.recipient]: { _eq: meId } }];
  for (const c of clauses) if (c && Object.keys(c).length) and.push(c);
  return { _and: and };
}

/** The built-in tabs, `all` and `unread`. */
export const BUILTIN_TABS: NotificationTab[] = resolveTabs();
