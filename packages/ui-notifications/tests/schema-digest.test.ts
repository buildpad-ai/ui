import { describe, expect, it } from 'vitest';
import { edit, fakeDaaS, readSchemaFile, type Row, type Store } from './daas-harness';

const file = 'cron/notification-digest.js';
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const BUDI = 'u-budi';
const CITRA = 'u-citra';
let seq = 0;
const note = (extra: Partial<Row>): Row => ({
  id: `n${++seq}`, recipient: BUDI, recipient_email: null, type: 'mention', title: 'Ana mentioned you', message: null,
  link: '/tickets/T1', read_at: null, emailed_at: null, created_at: ago(1), ...extra,
});
const world = (notifications: Row[], extra: Partial<Store> = {}): Store => ({
  daas_users: [
    { id: BUDI, email: 'budi@acme.io', status: 'active', first_name: 'Budi' },
    { id: CITRA, email: 'citra@acme.io', status: 'active', first_name: 'Citra' },
  ],
  notifications,
  ...extra,
});

describe('notification-digest', () => {
  it('sends one email per person, with sections by type, and marks the rows emailed', async () => {
    const d = fakeDaaS(world([
      note({ title: 'Ana mentioned you' }),
      note({ type: 'reply', title: '2 new replies on <Export>' }),
      note({ recipient: CITRA }),
      note({ recipient: null, recipient_email: 'guest@partner.co', type: 'assigned', title: 'Assigned' }),
    ]));
    const stats = await d.runCron(file);
    expect(stats).toMatchObject({ sent: 3, failed: 0 });
    expect(d.sent.map((m) => m.to).sort()).toEqual(['budi@acme.io', 'citra@acme.io', 'guest@partner.co']);
    const budi = d.sent.find((m) => m.to === 'budi@acme.io')!;
    expect(budi.subject).toBe('2 new notifications in Acme');
    expect(budi.html).toContain('Mentions');
    expect(budi.html).toContain('Replies');
    expect(budi.html).toContain('2 new replies on &lt;Export&gt;');
    expect(budi.html).not.toContain('<Export>');
    expect(budi.text).toContain('- 2 new replies on <Export> (https://app.example.com/tickets/T1)');
    expect(d.store.notifications.every((r) => r.emailed_at)).toBe(true);
  });

  it('a second run sends nothing', async () => {
    const d = fakeDaaS(world([note({})]));
    await d.runCron(file);
    await d.runCron(file);
    expect(d.sent).toHaveLength(1);
  });

  it('releases the claim when the mail fails, so the next run retries', async () => {
    const d = fakeDaaS(world([note({}), note({})]));
    d.mailBehaviour = 'throw';
    expect(await d.runCron(file)).toMatchObject({ sent: 0, failed: 1 });
    expect(d.store.notifications.every((r) => r.emailed_at === null)).toBe(true);
    d.mailBehaviour = 'result-failure';
    await d.runCron(file);
    expect(d.store.notifications.every((r) => r.emailed_at === null)).toBe(true);
    d.mailBehaviour = 'ok';
    await d.runCron(file);
    expect(d.sent).toHaveLength(1);
    expect(d.store.notifications.every((r) => r.emailed_at)).toBe(true);
  });

  it('skips read rows and rows older than 7 days', async () => {
    const d = fakeDaaS(world([note({ read_at: ago(0) }), note({ created_at: ago(8) })]));
    await d.runCron(file);
    expect(d.sent).toHaveLength(0);
  });

  it('leaves immediate types out, unless the person chose the digest', async () => {
    const immediate = edit('immediateTypes: [],', "immediateTypes: ['mention'],");
    const d = fakeDaaS(world(
      [note({}), note({ recipient: CITRA }), note({ recipient: CITRA, type: 'reply' })],
      { notification_prefs: [{ id: 'p', user: CITRA, email_mode: 'digest' }] },
    ));
    await d.runCron(file, immediate);
    expect(d.sent.map((m) => m.to)).toEqual(['citra@acme.io']);
    expect(d.store.notifications[0].emailed_at).toBeNull();
  });

  it('email_mode off: no email, rows marked handled', async () => {
    const d = fakeDaaS(world([note({})], { notification_prefs: [{ id: 'p', user: BUDI, email_mode: 'off' }] }));
    expect(await d.runCron(file)).toMatchObject({ sent: 0, silent: 1 });
    expect(d.sent).toHaveLength(0);
    expect(d.store.notifications[0].emailed_at).toBeTruthy();
  });

  it('inactive people and undeliverable addresses get no email', async () => {
    const d = fakeDaaS(world([note({ recipient: 'u-gone' }), note({ recipient: null, recipient_email: 'x@qa.test' })]));
    await d.runCron(file);
    expect(d.sent).toHaveLength(0);
  });

  it('shows at most 40 items and "and N more"', async () => {
    const d = fakeDaaS(world(Array.from({ length: 45 }, (_, i) => note({ title: `item ${i}` }))));
    await d.runCron(file);
    expect(d.sent).toHaveLength(1);
    expect((d.sent[0].html.match(/<li/g) || []).length).toBe(40);
    expect(d.sent[0].text).toContain('and 5 more');
    expect(d.sent[0].subject).toBe('45 new notifications in Acme');
  });

  it('dry run: only ONLY_RECIPIENTS are processed, the rest untouched', async () => {
    const d = fakeDaaS(world([note({}), note({ recipient: CITRA })]));
    await d.runCron(file, edit('const ONLY_RECIPIENTS = [];', "const ONLY_RECIPIENTS = ['citra@acme.io'];"));
    expect(d.sent.map((m) => m.to)).toEqual(['citra@acme.io']);
    expect(d.store.notifications[0].emailed_at).toBeNull();
  });

  describe('CONFIG.checkAccess (with the notifications-visible hook)', () => {
    const access = (filters: string) => (c: string) =>
      edit('  checkAccess: false,', '  checkAccess: true,')(c).replace(/accessFilters: \{[\s\S]*?\n {2}\},/, `accessFilters: ${filters},`);
    const tickets = [{ id: 'T1', assignee: BUDI }, { id: 'T2', assignee: CITRA }];

    it('as shipped, mails rows about records the person cannot read (it runs as the system)', async () => {
      const d = fakeDaaS(world([note({ source_collection: 'tickets', source_id: 'T2' })], { tickets }));
      await d.runCron(file);
      expect(d.sent).toHaveLength(1);
    });

    it('when on, drops (marks handled) rows whose source the person may not read, keeps the rest', async () => {
      const d = fakeDaaS(world([
        note({ title: 'mine', source_collection: 'tickets', source_id: 'T1' }),
        note({ title: 'SECRET', source_collection: 'tickets', source_id: 'T2' }),
        note({ title: 'no source', source_collection: null, source_id: null }),
      ], { tickets }));
      const stats = await d.runCron(file, access("{ tickets: { assignee: { _eq: '$CURRENT_USER' } } }"));
      expect(stats).toMatchObject({ sent: 1, hidden: 1 });
      expect(d.sent[0].text).toContain('mine');
      expect(d.sent[0].text).toContain('no source');
      expect(d.sent[0].text).not.toContain('SECRET');
      expect(d.store.notifications.every((r) => r.emailed_at)).toBe(true);
    });

    it('fails closed: a source collection without a rule, or a failing check, drops its rows', async () => {
      const d = fakeDaaS(world([note({ source_collection: 'deals', source_id: 'D1' })], { deals: [{ id: 'D1' }] }));
      expect(await d.runCron(file, access('{}'))).toMatchObject({ sent: 0, hidden: 1 });
      expect(d.logger.errors.join()).toContain('deals');
    });

    it('the shared visibleRows is the same text in the hook and the digest', () => {
      const block = (f: string) => {
        const src = readSchemaFile(f);
        const from = src.indexOf('// ── shared: visibleRows');
        const to = src.indexOf('// ── end shared ──');
        expect(from, f).toBeGreaterThan(-1);
        return src.slice(from, to);
      };
      expect(block('cron/notification-digest.js')).toBe(block('hooks/notifications-visible.hook.js'));
    });
  });
});
