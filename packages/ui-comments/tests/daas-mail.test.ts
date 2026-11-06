import { describe, expect, it } from 'vitest';
import { asShipped, fakeDaaS, runSandboxed, type FakeDaaS, type Row, type Store } from './daas-harness';

const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const ANA = id(1); // writes the comments
const BUDI = id(2);
const CITRA = id(3);
const DEWI = id(4);

const tok = (name: string, uid: string) => `@[${name}](user:${uid})`;
const user = (uid: string, first: string, email: string, extra: Partial<Row> = {}): Row => ({
  id: uid, first_name: first, last_name: 'X', email, status: 'active', last_access: '2026-11-01T00:00:00Z', ...extra,
});

function world(extra: Partial<Store> = {}): Store {
  return {
    daas_users: [
      user(ANA, 'Ana', 'ana@acme.io'),
      user(BUDI, 'Budi', 'budi@acme.io'),
      user(CITRA, 'Citra', 'citra@acme.io', { last_access: null }),
      user(DEWI, 'Dewi', 'dewi@acme.io'),
    ],
    tickets: [{ id: 'T1', title: 'Export drops the last row' }],
    ticket_comments: [],
    ...extra,
  };
}

const comment = (cid: string, body: string, extra: Partial<Row> = {}): Row => ({
  id: cid, ticket: 'T1', parent: null, author: ANA, body, photos: null, ...extra,
});

const run = async (store: Store, fn: (d: FakeDaaS) => Promise<void>) => {
  const daas = fakeDaaS(store);
  await fn(daas);
  return daas;
};

describe('notifyMentions', () => {
  it('emails each person mentioned, once, from the author, with a link to the comment', async () => {
    const store = world({ ticket_comments: [comment('C1', `Hi ${tok('Budi X', BUDI)} and ${tok('Citra X', CITRA)}, and ${tok('Budi X', BUDI)} again`)] });
    const d = await run(store, async (d) => {
      const out = await d.service().notifyMentions('C1');
      expect(out.sent).toEqual([BUDI, CITRA]);
    });
    expect(d.sent.map((m) => m.to)).toEqual(['budi@acme.io', 'citra@acme.io']);
    const [first] = d.sent;
    expect(first.subject).toBe('Ana X mentioned you in “Export drops the last row”');
    expect(first.replyTo).toBe('ana@acme.io');
    expect(first.html).toContain('href="https://app.example.com/tickets/T1?comment=C1"');
    expect(first.text).toContain('Open the comment: https://app.example.com/tickets/T1?comment=C1');
  });

  // The service runs under a 20 s limit. Sent one after another, a slow mail server would run out the
  // clock partway down the list and the rest would get nothing, silently.
  it('sends every mention at once, not one after another', async () => {
    const store = world({
      ticket_comments: [comment('C1', `${tok('Budi X', BUDI)} ${tok('Citra X', CITRA)} ${tok('Dewi X', DEWI)}`)],
    });
    const d = fakeDaaS(store);
    d.mailLatencyMs = 20;
    const out = await d.service().notifyMentions('C1');
    expect(d.maxMailsInFlight).toBe(3);
    // Order still follows the comment, whatever order the sends finish in.
    expect(out.sent).toEqual([BUDI, CITRA, DEWI]);
  });

  it('shows the first-time hint only to someone who has never signed in', async () => {
    const store = world({ ticket_comments: [comment('C1', `${tok('Budi X', BUDI)} ${tok('Citra X', CITRA)}`)] });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    const budi = d.sent.find((m) => m.to === 'budi@acme.io')!;
    const citra = d.sent.find((m) => m.to === 'citra@acme.io')!;
    expect(budi.text).not.toContain('first time');
    expect(citra.text).toContain('first time here');
    expect(citra.html).toContain('first time here');
  });

  it('does not email yourself, inactive people, addresses that cannot receive mail, or unknown ids', async () => {
    const store = world({
      daas_users: [
        user(ANA, 'Ana', 'ana@acme.io'),
        user(BUDI, 'Budi', 'budi@acme.io', { status: 'suspended' }),
        user(CITRA, 'Citra', 'citra@example.com'),
        user(DEWI, 'Dewi', null as unknown as string),
        user(id(5), 'Eka', 'eka@qa.test'),
        user(id(6), 'Fajar', 'svc@daas.internal'),
        user(id(7), 'Gita', 'servicerole@acme.io'),
        user(id(8), 'Hana', 'hana@localhost'),
      ],
      ticket_comments: [
        comment('C1', [ANA, BUDI, CITRA, DEWI, id(5), id(6), id(7), id(8), id(9)].map((u) => tok('N', u)).join(' ')),
      ],
    });
    const d = await run(store, async (d) => {
      const out = await d.service().notifyMentions('C1');
      expect(out.sent).toEqual([]);
      expect(out.skipped).toHaveLength(9);
    });
    expect(d.sent).toEqual([]);
  });

  it('emails at most ten people for one comment', async () => {
    const people = Array.from({ length: 12 }, (_, i) => user(id(100 + i), `P${i}`, `p${i}@acme.io`));
    const store = world({
      daas_users: [user(ANA, 'Ana', 'ana@acme.io'), ...people],
      ticket_comments: [comment('C1', people.map((p) => tok('P', p.id)).join(' '))],
    });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    expect(d.sent).toHaveLength(10);
  });

  it('reads everything with the service’s own rights, never the caller’s', async () => {
    const store = world({ ticket_comments: [comment('C1', tok('Budi X', BUDI))] });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    expect(d.access.length).toBeGreaterThan(0);
    expect(d.access.every((a) => a.elevated)).toBe(true);
    expect(new Set(d.access.map((a) => a.collection))).toEqual(new Set(['ticket_comments', 'tickets', 'daas_users']));
  });

  it('never puts comment text into the HTML as markup', async () => {
    const store = world({
      daas_users: [user(ANA, 'A"<b>na', 'ana@acme.io'), user(BUDI, 'Budi', 'budi@acme.io')],
      tickets: [{ id: 'T1', title: '<script>alert(1)</script>' }],
      ticket_comments: [comment('C1', `<img src=x onerror=alert(1)> ${tok('Budi X', BUDI)} & "quoted"`)],
    });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    const [mail] = d.sent;
    expect(mail.html).not.toMatch(/<script|<img|<b>na/);
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toContain('&amp; &quot;quoted&quot;');
    // The text part is plain text, so it keeps the raw characters.
    expect(mail.text).toContain('<img src=x onerror=alert(1)>');
  });

  it('writes mentions with the person’s current name and drops the formatting marks', async () => {
    const store = world({ ticket_comments: [comment('C1', `**Look** ${tok('Old Name', BUDI)} at ++this++ *now*`)] });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    expect(d.sent[0].text).toContain('Look @Budi X at this now');
    expect(d.sent[0].text).not.toContain('user:');
  });

  it('says whom a mention in a reply is replying to, and quotes it', async () => {
    const store = world({
      ticket_comments: [
        comment('C1', 'Can someone check the export?', { author: BUDI }),
        comment('C2', `${tok('Citra X', CITRA)} can you?`, { parent: 'C1', author: ANA }),
      ],
    });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C2')));
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].text).toContain('Replying to Budi X:');
    expect(d.sent[0].text).toContain('> Can someone check the export?');
  });

  it('sends nothing for a comment with no mention, and does not even read the people', async () => {
    const store = world({ ticket_comments: [comment('C1', 'no one here')] });
    const d = await run(store, async (d) => void (await d.service().notifyMentions('C1')));
    expect(d.sent).toEqual([]);
    expect(d.access.some((a) => a.collection === 'daas_users')).toBe(false);
  });

  it('uses the APP_URL runtime env var over the fallback, without a trailing slash', async () => {
    const store = world({ ticket_comments: [comment('C1', tok('Budi X', BUDI))] });
    const d = fakeDaaS(store);
    d.env = { APP_URL: 'https://tickets.acme.io//' };
    await d.service().notifyMentions('C1');
    expect(d.sent[0].html).toContain('href="https://tickets.acme.io/tickets/T1?comment=C1"');
  });

  describe('when something goes wrong, the comment is never affected', () => {
    const base = () => world({ ticket_comments: [comment('C1', tok('Budi X', BUDI))] });

    it('a mail that reports failure is skipped and logged', async () => {
      const d = fakeDaaS(base());
      d.mailBehaviour = 'result-failure';
      const out = await d.service().notifyMentions('C1');
      expect(out).toEqual({ sent: [], skipped: [BUDI] });
      expect(d.logger.errors.join('\n')).toContain('mailbox full');
    });

    it('a mailer that throws is caught', async () => {
      const d = fakeDaaS(base());
      d.mailBehaviour = 'throw';
      await expect(d.service().notifyMentions('C1')).resolves.toEqual({ sent: [], skipped: [BUDI] });
      expect(d.logger.errors.join('\n')).toContain('smtp is down');
    });

    it('a database error is caught', async () => {
      const d = fakeDaaS(base());
      d.breakReads = true;
      await expect(d.service().notifyMentions('C1')).resolves.toEqual({ sent: [], skipped: [] });
    });

    it('a comment that is already gone, or one whose record is gone, sends nothing', async () => {
      const a = fakeDaaS(base());
      await expect(a.service().notifyMentions('NOPE')).resolves.toEqual({ sent: [], skipped: [] });
      const b = fakeDaaS({ ...base(), tickets: [] });
      await expect(b.service().notifyMentions('C1')).resolves.toEqual({ sent: [], skipped: [] });
      expect(a.sent.concat(b.sent)).toEqual([]);
    });

    it('one refused address does not stop the next person', async () => {
      const store = world({ ticket_comments: [comment('C1', `${tok('B', BUDI)} ${tok('C', CITRA)}`)] });
      const d = fakeDaaS(store);
      d.failTo = ['budi@acme.io'];
      const out = await d.service().notifyMentions('C1');
      expect(out).toEqual({ sent: [CITRA], skipped: [BUDI] });
      expect(d.sent.map((m) => m.to)).toEqual(['citra@acme.io']);
    });
  });
});

describe('notifyReply', () => {
  const thread = (): Store =>
    world({
      ticket_comments: [
        comment('C1', 'Top comment by Budi', { author: BUDI }),
        comment('C2', 'Reply by Citra', { parent: 'C1', author: CITRA }),
      ],
    });

  it('emails the author of the answered comment, and says "post" for the top comment', async () => {
    const d = await run(thread(), async (d) => {
      const out = await d.service().notifyReply('C2');
      expect(out).toEqual({ sent: [BUDI], skipped: [] });
    });
    const [mail] = d.sent;
    expect(mail.to).toBe('budi@acme.io');
    expect(mail.subject).toBe('Citra X replied to your post in “Export drops the last row”');
    expect(mail.replyTo).toBe('citra@acme.io');
    expect(mail.text).toContain('Your post:');
    expect(mail.text).toContain('> Top comment by Budi');
    expect(mail.text).toContain('Reply by Citra');
    expect(mail.html).toContain('href="https://app.example.com/tickets/T1?comment=C2"');
  });

  it('says "comment" when the answered comment is itself a reply', async () => {
    const store = thread();
    store.ticket_comments.push(comment('C3', 'Answer by Dewi', { parent: 'C2', author: DEWI }));
    const d = await run(store, async (d) => void (await d.service().notifyReply('C3')));
    expect(d.sent[0].to).toBe('citra@acme.io');
    expect(d.sent[0].subject).toBe('Dewi X replied to your comment in “Export drops the last row”');
  });

  it('does not email someone about their own reply', async () => {
    const store = thread();
    store.ticket_comments.push(comment('C3', 'Me again', { parent: 'C1', author: BUDI }));
    const d = await run(store, async (d) => void (await d.service().notifyReply('C3')));
    expect(d.sent).toEqual([]);
  });

  it('does not email someone this reply already mentions: they get the mention email only', async () => {
    const store = thread();
    store.ticket_comments.push(comment('C3', `${tok('Budi X', BUDI)} see this`, { parent: 'C1', author: CITRA }));
    const d = fakeDaaS(store);
    await d.service().notifyMentions('C3');
    await d.service().notifyReply('C3');
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].subject).toContain('mentioned you');
  });

  it('sends nothing for a top-level comment', async () => {
    const d = await run(thread(), async (d) => void (await d.service().notifyReply('C1')));
    expect(d.sent).toEqual([]);
  });

  it('sends nothing when the answered comment is gone, has no author, or its author cannot get mail', async () => {
    const gone = world({ ticket_comments: [comment('C2', 'orphan', { parent: 'MISSING' })] });
    const noAuthor = world({ ticket_comments: [comment('C1', 'x', { author: null }), comment('C2', 'y', { parent: 'C1', author: CITRA })] });
    const inactive = world({
      daas_users: [user(BUDI, 'Budi', 'budi@acme.io', { status: 'suspended' }), user(CITRA, 'Citra', 'citra@acme.io')],
      ticket_comments: [comment('C1', 'x', { author: BUDI }), comment('C2', 'y', { parent: 'C1', author: CITRA })],
    });
    const testAddress = world({
      daas_users: [user(BUDI, 'Budi', 'budi@qa.test'), user(CITRA, 'Citra', 'citra@acme.io')],
      ticket_comments: [comment('C1', 'x', { author: BUDI }), comment('C2', 'y', { parent: 'C1', author: CITRA })],
    });
    for (const store of [gone, noAuthor, inactive, testAddress]) {
      const d = await run(store, async (d) => void (await d.service().notifyReply('C2')));
      expect(d.sent).toEqual([]);
    }
  });

  it('never throws when mail or the database fails', async () => {
    const a = fakeDaaS(thread());
    a.mailBehaviour = 'throw';
    await expect(a.service().notifyReply('C2')).resolves.toEqual({ sent: [], skipped: [BUDI] });
    const b = fakeDaaS(thread());
    b.mailBehaviour = 'result-failure';
    await expect(b.service().notifyReply('C2')).resolves.toEqual({ sent: [], skipped: [BUDI] });
    const c = fakeDaaS(thread());
    c.breakReads = true;
    await expect(c.service().notifyReply('C2')).resolves.toEqual({ sent: [], skipped: [] });
  });

  it('describes a picture-only reply', async () => {
    const store = thread();
    store.ticket_comments.push(comment('C3', '', { parent: 'C1', author: CITRA, photos: ['f1'] }));
    const d = await run(store, async (d) => void (await d.service().notifyReply('C3')));
    expect(d.sent[0].text).toContain('(sent a picture)');
    expect(d.sent[0].html).toContain('(sent a picture)');
  });

  it('gives the first-time hint to a recipient who has never signed in', async () => {
    const store = world({
      daas_users: [user(BUDI, 'Budi', 'budi@acme.io', { last_access: null }), user(CITRA, 'Citra', 'citra@acme.io')],
      ticket_comments: [comment('C1', 'x', { author: BUDI }), comment('C2', 'y', { parent: 'C1', author: CITRA })],
    });
    const d = await run(store, async (d) => void (await d.service().notifyReply('C2')));
    expect(d.sent[0].text).toContain('first time here');
  });
});

describe('who may be emailed (fails closed)', () => {
  const mentions = () => world({ ticket_comments: [comment('C1', `${tok('Budi X', BUDI)} ${tok('Citra X', CITRA)}`)] });
  const reply = () =>
    world({
      ticket_comments: [
        comment('C1', 'Top comment by Budi', { author: BUDI }),
        comment('C2', 'Reply by Citra', { parent: 'C1', author: CITRA }),
      ],
    });
  /** An integrator's access rule, written into CONFIG the way the README says to. */
  const rule = (body: string) => (code: string) => {
    const from = 'canRead: null,';
    if (!code.includes(from)) throw new Error(`comment_mail CONFIG no longer contains "${from}"`);
    return code.replace(from, `canRead(host, userId) { ${body} },`);
  };

  // As shipped, the service has no way to know who may read the record. Sending anyway would let
  // anyone who may comment mail the record's title and text to any active user, by typing a token.
  it('sends no mention email until an access rule is configured, and logs why', async () => {
    const d = fakeDaaS(mentions(), { configure: asShipped });
    const out = await d.service().notifyMentions('C1');
    expect(out).toEqual({ sent: [], skipped: [BUDI, CITRA] });
    expect(d.sent).toEqual([]);
    expect(d.logger.errors.join('\n')).toContain('no access rule is configured');
  });

  it('sends no reply email until an access rule is configured, and logs why', async () => {
    const d = fakeDaaS(reply(), { configure: asShipped });
    const out = await d.service().notifyReply('C2');
    expect(out).toEqual({ sent: [], skipped: [BUDI] });
    expect(d.sent).toEqual([]);
    expect(d.logger.errors.join('\n')).toContain('no access rule is configured');
  });

  it('logs nothing for a comment that mentions nobody', async () => {
    const d = fakeDaaS(world({ ticket_comments: [comment('C1', 'no mentions here')] }), { configure: asShipped });
    await d.service().notifyMentions('C1');
    expect(d.logger.errors).toEqual([]);
  });

  it('lets a canRead rule decide per person, without the create-hook flag', async () => {
    const d = fakeDaaS(mentions(), { configure: rule(`return userId !== '${BUDI}';`) });
    const out = await d.service().notifyMentions('C1');
    expect(out).toEqual({ sent: [CITRA], skipped: [BUDI] });
    expect(d.sent.map((m) => m.to)).toEqual(['citra@acme.io']);
  });

  it('applies canRead to replies too', async () => {
    const d = fakeDaaS(reply(), { configure: rule('return false;') });
    expect(await d.service().notifyReply('C2')).toEqual({ sent: [], skipped: [BUDI] });
  });

  it('treats a canRead that returns nothing as a refusal', async () => {
    const d = fakeDaaS(mentions(), { configure: rule('/* forgot to return */') });
    expect(await d.service().notifyMentions('C1')).toEqual({ sent: [], skipped: [BUDI, CITRA] });
  });

  it('hands canRead the record it is asked about', async () => {
    const d = fakeDaaS(mentions(), {
      configure: rule(`return host.id === 'T1' && host.title === 'Export drops the last row';`),
    });
    expect((await d.service().notifyMentions('C1')).sent).toEqual([BUDI, CITRA]);
  });
});

describe('the hooks', () => {
  it('the mention hook calls notifyMentions with the new comment’s key', async () => {
    const store = world({ ticket_comments: [comment('C1', tok('Budi X', BUDI))] });
    const d = fakeDaaS(store);
    await d.runHook('hooks/notify-on-mention.hook.js', { collection: 'ticket_comments', key: 'C1', payload: { body: 'x' } });
    expect(d.sent.map((m) => m.to)).toEqual(['budi@acme.io']);
  });

  it('the reply hook calls notifyReply', async () => {
    const store = world({ ticket_comments: [comment('C1', 'x', { author: BUDI }), comment('C2', 'y', { parent: 'C1', author: CITRA })] });
    const d = fakeDaaS(store);
    await d.runHook('hooks/notify-on-reply.hook.js', { collection: 'ticket_comments', key: 'C2' });
    expect(d.sent.map((m) => m.to)).toEqual(['budi@acme.io']);
  });

  it('both hooks accept several keys and ignore a missing one', async () => {
    const store = world({ ticket_comments: [comment('C1', tok('Budi X', BUDI)), comment('C2', tok('Citra X', CITRA))] });
    const d = fakeDaaS(store);
    await d.runHook('hooks/notify-on-mention.hook.js', { keys: ['C1', 'C2'] });
    expect(d.sent).toHaveLength(2);
    const e = fakeDaaS(store);
    await e.runHook('hooks/notify-on-mention.hook.js', {});
    await e.runHook('hooks/notify-on-reply.hook.js', { keys: [] });
    expect(e.sent).toEqual([]);
  });

  it.each(['hooks/notify-on-mention.hook.js', 'hooks/notify-on-reply.hook.js'])(
    '%s swallows a service that is down and logs it: a comment is never affected',
    async (file) => {
      const d = fakeDaaS(world());
      d.service = () => {
        throw new Error('service is down');
      };
      await expect(d.runHook(file, { key: 'C1' })).resolves.toBeUndefined();
      expect(d.logger.errors.join('\n')).toContain('service is down');
    }
  );

});

describe('the sandbox these tests run in', () => {
  // The shipped code is only trustworthy if the harness really is as strict as the DaaS.
  it('blocks process, require, timers and fetch', () => {
    expect(runSandboxed('return [typeof process, typeof require, typeof setTimeout, typeof fetch, typeof globalThis].join()')).toBe(
      'undefined,undefined,undefined,undefined,undefined'
    );
  });

  it('freezes the builtins, so code cannot change them', () => {
    expect(() => runSandboxed('Array.prototype.evil = 1;')).toThrow();
    expect(() => runSandboxed('String.prototype.trim = () => "x";')).toThrow();
  });

  it('runs code in strict mode, as a function body with only the given parameters', () => {
    expect(() => runSandboxed('undeclared = 1;')).toThrow();
    expect(runSandboxed('return typeof services', ['context'], [{}])).toBe('undefined');
  });
});
