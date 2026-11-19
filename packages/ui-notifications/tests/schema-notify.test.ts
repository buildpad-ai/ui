import { describe, expect, it } from 'vitest';
import { edit, fakeDaaS, type Row, type Store } from './daas-harness';

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const ANA = id(1);
const BUDI = id(2);
const CITRA = id(3);
const user = (uid: string, email: string, extra: Partial<Row> = {}): Row => ({ id: uid, email, first_name: 'X', status: 'active', ...extra });
const world = (extra: Partial<Store> = {}): Store => ({
  daas_users: [user(ANA, 'ana@acme.io'), user(BUDI, 'budi@acme.io'), user(CITRA, 'citra@acme.io')],
  notifications: [],
  ...extra,
});
const base = { type: 'mention', title: 'Ana mentioned you', source_collection: 'tickets', source_id: 'T1', actor: ANA };

describe('notify', () => {
  it('creates a row per recipient, without the actor, once per person', async () => {
    const d = fakeDaaS(world());
    const out = await d.service().notify([
      { ...base, recipient: BUDI },
      { ...base, recipient: BUDI.toUpperCase() },
      { ...base, recipient: ANA },
      { ...base, recipient: CITRA },
    ]);
    expect(out).toMatchObject({ created: 2, merged: 0, skipped: 2 });
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([BUDI, CITRA]);
    expect(d.store.notifications[0]).toMatchObject({ type: 'mention', actor: ANA, source_id: 'T1', read_at: null, emailed_at: null });
  });

  it('turns an address with an account into the user, and keeps an address without one (lower-case)', async () => {
    const d = fakeDaaS(world());
    await d.service().notify([
      { ...base, recipient_email: 'BUDI@acme.io' },
      { ...base, recipient_email: 'Guest@Partner.co' },
    ]);
    expect(d.store.notifications.map((r) => [r.recipient, r.recipient_email])).toEqual([
      [BUDI, null],
      [null, 'guest@partner.co'],
    ]);
  });

  it('skips inactive and unknown users, undeliverable addresses, and rows without a type', async () => {
    const d = fakeDaaS(world({ daas_users: [user(ANA, 'ana@acme.io'), user(BUDI, 'budi@acme.io', { status: 'suspended' })] }));
    const out = await d.service().notify([
      { ...base, recipient: BUDI },
      { ...base, recipient: id(9) },
      { ...base, recipient_email: 'x@example.com' },
      { ...base, recipient_email: 'y@qa.test' },
      { title: 'no type', recipient: ANA },
    ]);
    expect(out).toMatchObject({ created: 0, skipped: 5 });
    expect(d.store.notifications).toHaveLength(0);
  });

  it('caps the recipients at maxRecipients', async () => {
    const d = fakeDaaS(world());
    d.configure = edit('maxRecipients: 50,', 'maxRecipients: 1,');
    const out = await d.service().notify([{ ...base, recipient: BUDI }, { ...base, recipient: CITRA }]);
    expect(out).toMatchObject({ created: 1, skipped: 1 });
  });

  it('keeps one row per dedupe_key, across calls', async () => {
    const d = fakeDaaS(world());
    const row = { ...base, recipient: BUDI, dedupe_key: 'mention:C1:b' };
    expect((await d.service().notify([row])).created).toBe(1);
    expect(await d.service().notify([row])).toMatchObject({ created: 0, skipped: 1 });
    expect(d.store.notifications).toHaveLength(1);
  });

  it('checks dedupe_key before merging: a retried merging row is a no-op, not a second bump', async () => {
    const d = fakeDaaS(world());
    const reply = { type: 'reply', recipient: BUDI, title: 'Ana replied', source_collection: 'tickets', source_id: 'T1', merge: 'replies', subject: 'X', actor: ANA };
    await d.service().notify([{ ...reply, dedupe_key: 'reply:C1' }]);
    // the retried hook for C1 sends the same key again: it used to merge into its own row ("2 new replies")
    expect(await d.service().notify([{ ...reply, dedupe_key: 'reply:C1' }])).toMatchObject({ merged: 0, skipped: 1 });
    expect(d.store.notifications[0].title).toBe('Ana replied');
    expect(d.store.notifications).toHaveLength(1);
  });

  it('stores only app-relative links; javascript:, https://, //host and /\\host become null', async () => {
    const d = fakeDaaS(world());
    const links = ['/tickets/T1?comment=C1', 'javascript:alert(1)', 'https://evil.example', '//evil.example', '/\\evil.example', '/a\\b'];
    await d.service().notify(links.map((link, i) => ({ ...base, source_id: `T${i}`, recipient: BUDI, link })));
    expect(d.store.notifications.map((r) => r.link)).toEqual(['/tickets/T1?comment=C1', null, null, null, null, null]);
  });

  it('emailed: true stores emailed_at (so the digest skips it) and merges only into emailed rows', async () => {
    const d = fakeDaaS(world());
    const reply = { type: 'reply', recipient: BUDI, title: 'Ana replied', source_collection: 'tickets', source_id: 'T1', merge: 'replies', subject: 'X', actor: ANA };
    await d.service().notify([reply]); // not emailed
    await d.service().notify([{ ...reply, emailed: true }]);
    expect(d.store.notifications).toHaveLength(2);
    expect(d.store.notifications[0].emailed_at).toBeNull();
    expect(d.store.notifications[1].emailed_at).toBeTruthy();
    await d.service().notify([{ ...reply, emailed: true }]);
    expect(d.store.notifications[1].title).toBe('2 new replies on X');
    expect(d.store.notifications[0].title).toBe('Ana replied');
  });

  it('tolerates the unique violation (23505) of a concurrent insert', async () => {
    const d = fakeDaaS(world());
    d.beforeCreate = (collection, data) => {
      d.store[collection].push({ id: 'OTHER', dedupe_key: data.dedupe_key } as Row);
      d.beforeCreate = undefined;
    };
    const out = await d.service().notify([{ ...base, recipient: BUDI, dedupe_key: 'k1' }]);
    expect(out).toMatchObject({ created: 0, skipped: 1 });
    expect(d.logger.errors).toEqual([]);
  });

  it('merges into the unread, un-emailed row with a counted title and bumps created_at', async () => {
    const d = fakeDaaS(world());
    const reply = { type: 'reply', recipient: BUDI, title: 'Ana replied', source_collection: 'tickets', source_id: 'T1', merge: 'replies', subject: 'Export bug' };
    await d.service().notify([{ ...reply, actor: ANA }]);
    const first = d.store.notifications[0];
    first.created_at = '2000-01-01T00:00:00.000Z';
    expect(await d.service().notify([{ ...reply, actor: CITRA }])).toMatchObject({ merged: 1, created: 0 });
    expect(first.title).toBe('2 new replies on Export bug');
    expect(first.actor).toBe(CITRA);
    expect(String(first.created_at) > '2000').toBe(true);
    await d.service().notify([{ ...reply, actor: CITRA }]);
    expect(first.title).toBe('3 new replies on Export bug');
    expect(d.store.notifications).toHaveLength(1);
  });

  it('starts a new row once the merged one was read or emailed, or for another source', async () => {
    const d = fakeDaaS(world());
    const reply = { type: 'reply', recipient: BUDI, title: 'Ana replied', source_collection: 'tickets', source_id: 'T1', actor: ANA };
    await d.service().notify([reply]); // reply merges by default (CONFIG.mergeTypes)
    d.store.notifications[0].read_at = '2026-11-01T00:00:00Z';
    await d.service().notify([reply]);
    d.store.notifications[1].emailed_at = '2026-11-01T00:00:00Z';
    await d.service().notify([reply]);
    await d.service().notify([{ ...reply, source_id: 'T2' }]);
    expect(d.store.notifications).toHaveLength(4);
  });

  it('never throws: a failed insert is logged with ids only and counted as skipped', async () => {
    const d = fakeDaaS(world());
    d.breakCreate = true;
    const out = await d.service().notify([{ ...base, recipient: BUDI, title: 'SECRET title' }]);
    expect(out).toMatchObject({ created: 0, skipped: 1 });
    expect(d.logger.errors.join('\n')).toContain(BUDI);
    expect(d.logger.errors.join('\n')).not.toContain('SECRET');
  });

  it('never throws when the user lookup fails, or on junk input', async () => {
    const d = fakeDaaS(world());
    d.breakReads = true;
    expect(await d.service().notify([{ ...base, recipient: BUDI }])).toMatchObject({ created: 0 });
    expect(await d.service().notify(null)).toMatchObject({ created: 0, skipped: 0 });
    expect(await d.service().notify('x')).toMatchObject({ created: 0 });
  });

  it('writes with elevated access', async () => {
    const d = fakeDaaS(world());
    await d.service().notify([{ ...base, recipient: BUDI }]);
    expect(d.access.every((a) => a.elevated)).toBe(true);
  });
});

describe('immediate email', () => {
  const immediate = edit('immediateTypes: [],', "immediateTypes: ['mention'],");

  it('emails immediate types at once (escaped) and marks the row emailed', async () => {
    const d = fakeDaaS(world());
    d.configure = immediate;
    await d.service().notify([{ ...base, recipient: BUDI, title: '<b>Ana</b> mentioned you', message: 'x <script>', link: '/tickets/T1' }]);
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].to).toBe('budi@acme.io');
    expect(d.sent[0].html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(d.sent[0].html).not.toContain('<script>');
    expect(d.sent[0].html).toContain('href="https://app.example.com/tickets/T1"');
    expect(d.store.notifications[0].emailed_at).toBeTruthy();
  });

  it('sends no immediate email for a row the caller already emailed (emailed: true)', async () => {
    const d = fakeDaaS(world());
    d.configure = immediate;
    await d.service().notify([{ ...base, recipient: BUDI, emailed: true }]);
    expect(d.sent).toHaveLength(0);
    expect(d.store.notifications[0].emailed_at).toBeTruthy();
  });

  it('does not email other types, people with email_mode off or digest, or when mail fails', async () => {
    const d = fakeDaaS(world({ notification_prefs: [{ id: 'p1', user: CITRA, email_mode: 'off' }, { id: 'p2', user: ANA, email_mode: 'digest' }] }));
    d.configure = immediate;
    d.mailBehaviour = 'result-failure';
    await d.service().notify([
      { ...base, recipient: BUDI },
      { ...base, recipient: CITRA },
      { ...base, actor: BUDI, recipient: ANA },
      { ...base, type: 'reply', recipient: BUDI },
    ]);
    expect(d.store.notifications).toHaveLength(4);
    expect(d.store.notifications.every((r) => r.emailed_at === null)).toBe(true);
  });
});

describe('audience and markEmailed', () => {
  it('audience is unique, lower-case, without the actor or blanks', () => {
    const d = fakeDaaS(world());
    expect(d.service().audience([BUDI, BUDI.toUpperCase(), ANA, null, '', { id: CITRA }], ANA)).toEqual([BUDI, CITRA]);
  });

  it('markEmailed sets emailed_at and never throws', async () => {
    const d = fakeDaaS(world({ notifications: [{ id: 'n1', emailed_at: null } as Row] }));
    expect(await d.service().markEmailed(['n1'])).toBe(1);
    expect(d.store.notifications[0].emailed_at).toBeTruthy();
    expect(await d.service().markEmailed([])).toBe(0);
  });
});
