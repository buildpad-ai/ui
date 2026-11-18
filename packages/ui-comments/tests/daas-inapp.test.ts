import { describe, expect, it } from 'vitest';
import { fakeDaaS, withInApp, type Row, type Store } from './daas-harness';

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const ANA = id(1);
const BUDI = id(2);
const CITRA = id(3);
const tok = (name: string, uid: string) => `@[${name}](user:${uid})`;
const user = (uid: string, first: string, email: string, extra: Partial<Row> = {}): Row => ({
  id: uid, first_name: first, last_name: 'X', email, status: 'active', last_access: '2026-11-01T00:00:00Z', ...extra,
});
const comment = (cid: string, body: string, extra: Partial<Row> = {}): Row => ({
  id: cid, ticket: 'T1', parent: null, author: ANA, body, photos: null, ...extra,
});
const world = (comments: Row[]): Store => ({
  daas_users: [user(ANA, 'Ana', 'ana@acme.io'), user(BUDI, 'Budi', 'budi@acme.io'), user(CITRA, 'Citra', 'citra@example.com')],
  tickets: [{ id: 'T1', title: 'Export bug' }],
  ticket_comments: comments,
});

describe('comment_mail in-app notifications (CONFIG.inAppNotifications)', () => {
  it('is off as shipped: the notifications service is never called', async () => {
    const d = fakeDaaS(world([comment('C1', tok('Budi X', BUDI)), comment('C2', 'yes', { parent: 'C0' })]));
    await d.service().notifyMentions('C1');
    expect(d.sent).toHaveLength(1);
    expect(d.inApp).toEqual([]);
  });

  it('when on, notifies mentioned people in the app (even without a deliverable address), not the author', async () => {
    const d = fakeDaaS(world([comment('C1', `${tok('Budi X', BUDI)} ${tok('Citra X', CITRA)} ${tok('Ana X', ANA)}`)]), { configure: withInApp });
    await d.service().notifyMentions('C1');
    expect(d.sent.map((m) => m.to)).toEqual(['budi@acme.io']);
    expect(d.inApp).toHaveLength(1);
    expect(d.inApp[0]).toEqual([
      expect.objectContaining({ recipient: BUDI, type: 'mention', link: '/tickets/T1?comment=C1', actor: ANA, source_collection: 'tickets', source_id: 'T1', dedupe_key: `mention:C1:${BUDI}` }),
      expect.objectContaining({ recipient: CITRA, type: 'mention' }),
    ]);
  });

  it('when on, notifies the replied-to author with a merging reply row', async () => {
    const d = fakeDaaS(world([comment('C1', 'root', { author: BUDI }), comment('C2', 'thanks', { parent: 'C1' })]), { configure: withInApp });
    await d.service().notifyReply('C2');
    expect(d.sent).toHaveLength(1);
    expect(d.inApp[0]).toEqual([expect.objectContaining({ recipient: BUDI, type: 'reply', merge: 'replies', subject: 'Export bug', message: 'thanks' })]);
  });

  it('marks rows for people emailed here as emailed (no digest / immediate repeat), not the others', async () => {
    const d = fakeDaaS(world([comment('C1', `${tok('Budi X', BUDI)} ${tok('Citra X', CITRA)}`)]), { configure: withInApp });
    await d.service().notifyMentions('C1');
    const rows = d.inApp[0] as Array<Record<string, unknown>>;
    expect(rows.find((r) => r.recipient === BUDI)).toMatchObject({ emailed: true });
    expect(rows.find((r) => r.recipient === CITRA)).not.toHaveProperty('emailed');
  });

  it('marks the reply row emailed when the reply email goes out, and not when it cannot', async () => {
    const d = fakeDaaS(world([comment('C1', 'root', { author: BUDI }), comment('C2', 'thanks', { parent: 'C1' }), comment('C3', 'root', { author: CITRA }), comment('C4', 'ok', { parent: 'C3' })]), { configure: withInApp });
    await d.service().notifyReply('C2');
    await d.service().notifyReply('C4');
    expect(d.inApp[0]).toEqual([expect.objectContaining({ recipient: BUDI, emailed: true })]);
    expect(d.inApp[1]).toEqual([expect.not.objectContaining({ emailed: true })]);
  });

  it('sends the emails while the in-app notify is still running (not after it)', async () => {
    for (const run of ['mention', 'reply'] as const) {
      const d = fakeDaaS(world([comment('C1', tok('Budi X', BUDI)), comment('C0', 'root', { author: BUDI }), comment('C2', 'thanks', { parent: 'C0' })]), { configure: withInApp });
      let release!: () => void;
      d.inAppGate = new Promise<void>((r) => (release = r));
      const done = run === 'mention' ? d.service().notifyMentions('C1') : d.service().notifyReply('C2');
      for (let i = 0; i < 50 && d.sent.length === 0; i++) await Promise.resolve();
      expect(d.sent, run).toHaveLength(1);
      release();
      expect((await done).sent, run).toHaveLength(1);
    }
  });

  it('still sends the reply to a parent author mentioned past the maxMentions cap', async () => {
    const others = Array.from({ length: 10 }, (_, i) => tok(`P${i}`, id(100 + i))).join(' ');
    const d = fakeDaaS(world([comment('C1', 'root', { author: BUDI }), comment('C2', `${others} ${tok('Budi X', BUDI)}`, { parent: 'C1' })]), { configure: withInApp });
    const out = await d.service().notifyReply('C2');
    expect(out.sent).toEqual([BUDI]);
  });

  it('a failing notifications service does not stop the emails', async () => {
    const d = fakeDaaS(world([comment('C1', tok('Budi X', BUDI))]), { configure: withInApp });
    d.breakInApp = true;
    const out = await d.service().notifyMentions('C1');
    expect(out.sent).toEqual([BUDI]);
    expect(d.logger.errors.join()).toContain('in-app');
  });
});
