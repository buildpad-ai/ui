/** One notification as the UI works with it, whatever the collection's column names are. */
export interface Notification {
  id: string;
  recipient: string;
  recipient_email?: string | null;
  type: string;
  title: string;
  /** May contain `@[Name](type:id)` mention tokens; shown as plain `@Name`. */
  message?: string | null;
  link?: string | null;
  actor?: string | null;
  actor_name?: string | null;
  source_collection?: string | null;
  source_id?: string | null;
  dedupe_key?: string | null;
  /** ISO timestamp; null while unread. */
  read_at?: string | null;
  emailed_at?: string | null;
  created_at: string;
}

/** A DaaS filter object (`{ field: { _op: value } }`, `_and`, `_or`). */
export type Filter = Record<string, unknown>;

export const isUnread = (n: Pick<Notification, 'read_at'>) => !n.read_at;
