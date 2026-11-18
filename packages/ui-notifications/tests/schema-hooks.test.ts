import { describe, expect, it } from 'vitest';
import { fakeDaaS, type Row, type Store } from './daas-harness';

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const ANA = id(1);
const BUDI = id(2);
const CITRA = id(3);
const tok = (name: string, uid: string) => `@[${name}](user:${uid})`;
const user = (uid: string, first: string): Row => ({ id: uid, first_name: first, last_name: 'X', email: `${first.toLowerCase()}@acme.io`, status: 'active' });
const comment = (cid: string, body: string, extra: Partial<Row> = {}): Row => ({ id: cid, ticket: 'T1', parent: null, author: ANA, body, ...extra });
const world = (comments: Row[] = [], extra: Partial<Store> = {}): Store => ({
  daas_users: [user(ANA, 'Ana'), user(BUDI, 'Budi'), user(CITRA, 'Citra')],
  tickets: [{ id: 'T1', title: 'Export bug', assignee: null }, { id: 'T2', title: 'Login bug' }],
  ticket_comments: comments,
  notifications: [],
  ...extra,
});

describe('notify-on-comment-mention', () => {
  const file = 'hooks/notify-on-comment-mention.hook.js';

  it('notifies each mentioned person once, not the author, with a deep link and the host as source', async () => {
    const d = fakeDaaS(world([comment('C1', `hi ${tok('Budi X', BUDI)} ${tok('Budi X', BUDI)} ${tok('Ana X', ANA)} ${tok('Citra X', CITRA)}`)]));
    await d.runHook(file, { key: 'C1', payload: {} });
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([BUDI, CITRA]);
    expect(d.store.notifications[0]).toMatchObject({
      type: 'mention', title: 'Ana X mentioned you on Export bug', message: 'hi @Budi X @Budi X @Ana X @Citra X',
      link: '/tickets/T1?comment=C1', actor: ANA, actor_name: 'Ana X', source_collection: 'tickets', source_id: 'T1',
      dedupe_key: `mention:C1:${BUDI}`,
    });
  });

  it('is idempotent when the hook runs twice, and handles meta.keys', async () => {
    const d = fakeDaaS(world([comment('C1', tok('Budi X', BUDI)), comment('C2', tok('Citra X', CITRA))]));
    await d.runHook(file, { keys: ['C1', 'C2'] });
    await d.runHook(file, { keys: ['C1', 'C2'] });
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([BUDI, CITRA]);
  });

  it('never throws: missing comment, missing service, broken reads', async () => {
    const d = fakeDaaS(world());
    await expect(d.runHook(file, { key: 'nope' })).resolves.toBeUndefined();
    d.breakReads = true;
    await expect(d.runHook(file, { key: 'C1' })).resolves.toBeUndefined();
    d.service = () => {
      throw new Error('no service');
    };
    await expect(d.runHook(file, { key: 'C1' })).resolves.toBeUndefined();
    expect(d.logger.errors.length).toBeGreaterThan(0);
  });
});

describe('notify-on-comment-reply', () => {
  const file = 'hooks/notify-on-comment-reply.hook.js';

  it('notifies the parent author and merges further replies into "N new replies on …"', async () => {
    const d = fakeDaaS(world([
      comment('C1', 'root', { author: BUDI }),
      comment('C2', 'first', { parent: 'C1' }),
      comment('C3', 'second', { parent: 'C1', author: CITRA }),
    ]));
    await d.runHook(file, { key: 'C2' });
    expect(d.store.notifications).toHaveLength(1);
    expect(d.store.notifications[0]).toMatchObject({ recipient: BUDI, type: 'reply', title: 'Ana X replied on Export bug', link: '/tickets/T1?comment=C2' });
    await d.runHook(file, { key: 'C3' });
    expect(d.store.notifications).toHaveLength(1);
    expect(d.store.notifications[0]).toMatchObject({ title: '2 new replies on Export bug', actor: CITRA, link: '/tickets/T1?comment=C3' });
  });

  it('skips top-level comments, self-replies and parents the reply already mentions', async () => {
    const d = fakeDaaS(world([
      comment('C1', 'root', { author: BUDI }),
      comment('C2', 'mine', { parent: 'C1', author: BUDI }),
      comment('C3', `cc ${tok('Budi X', BUDI)}`, { parent: 'C1' }),
    ]));
    await d.runHook(file, { keys: ['C1', 'C2', 'C3'] });
    expect(d.store.notifications).toHaveLength(0);
  });

  it('still notifies a parent author mentioned past the mention cap (the mention hook drops them)', async () => {
    const others = Array.from({ length: 10 }, (_, i) => tok(`P${i}`, id(100 + i))).join(' ');
    const d = fakeDaaS(world([
      comment('C1', 'root', { author: BUDI }),
      comment('C2', `${others} ${tok('Budi X', BUDI)}`, { parent: 'C1' }),
    ]));
    await d.runHook(file, { key: 'C2' });
    expect(d.store.notifications.map((r) => [r.recipient, r.type])).toEqual([[BUDI, 'reply']]);
  });
});

describe('notify-on-assign', () => {
  const file = 'hooks/notify-on-assign.hook.js';

  it('notifies the new assignee of each updated record', async () => {
    const d = fakeDaaS(world());
    await d.runHook(file, { keys: ['T1', 'T2'], payload: { assignee: BUDI } }, { user: ANA });
    expect(d.store.notifications.map((r) => [r.recipient, r.source_id, r.title, r.link])).toEqual([
      [BUDI, 'T1', 'Ana X assigned you Export bug', '/tickets/T1'],
      [BUDI, 'T2', 'Ana X assigned you Login bug', '/tickets/T2'],
    ]);
  });

  it('accepts an object value, and ignores other updates, unassigning and self-assignment', async () => {
    const d = fakeDaaS(world());
    await d.runHook(file, { keys: ['T1'], payload: { title: 'x' } }, { user: ANA });
    await d.runHook(file, { keys: ['T1'], payload: { assignee: null } }, { user: ANA });
    await d.runHook(file, { keys: ['T1'], payload: { assignee: ANA } }, { user: ANA });
    expect(d.store.notifications).toHaveLength(0);
    await d.runHook(file, { key: 'T1', payload: { assignee: { id: CITRA } } }, { user: ANA });
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([CITRA]);
  });

  it('re-saving the same assignee sends nothing; reassigning away and back notifies again', async () => {
    const d = fakeDaaS(world());
    let t = 0;
    const age = () => d.store.notifications.forEach((r) => (r.created_at = `2026-01-0${++t}T00:00:00.000Z`));
    const save = (assignee: string) => d.runHook(file, { key: 'T1', payload: { assignee, title: 'edited' } }, { user: ANA });
    await save(BUDI);
    age();
    await save(BUDI); // a form that sends every field on each save
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([BUDI]);
    await save(CITRA);
    age();
    await save(BUDI);
    expect(d.store.notifications.map((r) => r.recipient)).toEqual([BUDI, CITRA, BUDI]);
  });

  it('never throws', async () => {
    const d = fakeDaaS(world());
    d.breakCreate = true;
    await expect(d.runHook(file, { key: 'T1', payload: { assignee: BUDI } }, { user: ANA })).resolves.toBeUndefined();
    await expect(d.runHook(file, null as unknown as Record<string, unknown>)).resolves.toBeUndefined();
  });
});

