import { describe, expect, it } from 'vitest';
import { readSchemaFile } from './daas-harness';
import { READABLE_NOTIFICATION_FIELDS } from '../src/NotificationsAdapter';

const schema = JSON.parse(readSchemaFile('notifications.schema.json'));
const collection = (name: string) => schema.collections.find((c: { collection: string }) => c.collection === name);
const field = (c: string, f: string) => collection(c).fields.find((x: { field: string }) => x.field === f);

describe('notifications.schema.json', () => {
  it('has every standard field with its type', () => {
    const want: Record<string, string> = {
      id: 'uuid', recipient: 'uuid', recipient_email: 'string', type: 'string', title: 'string', message: 'text',
      link: 'string', actor: 'uuid', actor_name: 'string', source_collection: 'string', source_id: 'string',
      dedupe_key: 'string', read_at: 'timestamp', emailed_at: 'timestamp', created_at: 'timestamp',
    };
    for (const [name, type] of Object.entries(want)) expect(field('notifications', name)?.type, name).toBe(type);
    expect(field('notifications', 'id').primaryKey).toBe(true);
    expect(field('notifications', 'recipient').required).toBe(false);
  });

  it('dedupe_key is unique, hidden, nullable, at most 200 characters', () => {
    expect(field('notifications', 'dedupe_key')).toMatchObject({ unique: true, hidden: true, required: false, maxLength: 200 });
  });

  it('links recipient and actor to users and indexes the bell query', () => {
    const rel = collection('notifications').relations.map((r: { field: string; related_collection: string }) => [r.field, r.related_collection]);
    expect(rel).toEqual(expect.arrayContaining([['recipient', 'daas_users'], ['actor', 'daas_users']]));
    expect(collection('notifications').indexes[0].fields).toEqual(['recipient', 'read_at', 'created_at']);
  });

  it('people read and update only their own rows, update only read_at, and never create or delete', () => {
    const p = schema.permissions.notifications;
    expect(p.read.filter).toEqual({ recipient: { _eq: '$CURRENT_USER' } });
    expect(p.read.fields).not.toContain('dedupe_key');
    // The adapter asks for exactly what the read permission grants, so the two cannot drift.
    expect([...p.read.fields].sort()).toEqual([...READABLE_NOTIFICATION_FIELDS].sort());
    expect(p.update.filter).toEqual({ recipient: { _eq: '$CURRENT_USER' } });
    expect(p.update.fields).toEqual(['read_at']);
    expect(p.create).toBeNull();
    expect(p.delete).toBeNull();
  });

  it('notification_prefs offers immediate, digest and off', () => {
    expect(field('notification_prefs', 'email_mode').choices).toEqual(['immediate', 'digest', 'off']);
    expect(schema.permissions.notification_prefs.update.fields).toEqual(['email_mode']);
  });
});
