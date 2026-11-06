import { itemsAdapter, REPLY_CHUNK, DEFAULT_FIELDS } from '../src/CommentsAdapter';
import { displayName } from '../src/core/people';

type Call = { path: string; init?: RequestInit };

/** A request function that records its calls and answers from a script keyed by method + path prefix. */
function scripted(answers: Array<[string, unknown]>) {
  const calls: Call[] = [];
  const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    calls.push({ path, init });
    const key = `${init?.method ?? 'GET'} ${decodeURIComponent(path)}`;
    const hit = answers.find(([prefix]) => key.startsWith(prefix));
    return (hit ? hit[1] : { data: [] }) as T;
  };
  return { request, calls };
}

const base = { collection: 'ticket_comments', hostField: 'ticket', hostId: 't1', meId: 'ME' };
const person = (id: string, first: string) => ({ id, first_name: first, last_name: 'X', email: `${first}@x.io` });

describe('displayName', () => {
  it('prefers the full name', () => expect(displayName({ first_name: 'Ana', last_name: 'Putri' })).toBe('Ana Putri'));
  it('builds words from the email, dropping digits', () => {
    expect(displayName({ email: 'iswan.syaiful2@x.com' })).toBe('Iswan Syaiful');
  });
  it('never shows the whole address', () => expect(displayName({ email: '123@x.com' })).toBe('Someone'));
  it('falls back for nobody', () => expect(displayName(null, 'Unknown')).toBe('Unknown'));
});

describe('itemsAdapter.list', () => {
  it('reads top-level comments, then replies by root', async () => {
    const { request, calls } = scripted([
      ['GET /api/items/ticket_comments', { data: [] }],
    ]);
    // First call answers the top-level read, the next the reply read.
    let n = 0;
    const seq = async <T,>(path: string, init?: RequestInit): Promise<T> => {
      calls.push({ path, init });
      n++;
      return (n === 1
        ? { data: [{ id: 'c1', parent: null, root: null, body: 'hi', photos: null, created_at: '1', author: person('u1', 'Ana') }] }
        : { data: [{ id: 'c2', parent: 'c1', root: 'c1', body: 'yo', photos: ['f1'], created_at: '2', author: person('u2', 'Budi') }] }) as T;
    };
    void request;
    const list = await itemsAdapter({ ...base, request: seq }).list();
    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[0].path)).toContain('"parent":{"_null":true}');
    expect(decodeURIComponent(calls[1].path)).toContain('"root":{"_in":["c1"]}');
    expect(list.map((c) => [c.id, c.parent, c.root])).toEqual([
      ['c1', null, null],
      ['c2', 'c1', 'c1'],
    ]);
    expect(list[0].author).toEqual({ id: 'u1', name: 'Ana X' });
    expect(list[1].photos).toEqual(['f1']);
  });

  it('reads replies in groups so the URL stays short', async () => {
    const tops = Array.from({ length: REPLY_CHUNK + 1 }, (_, i) => ({ id: `c${i}`, created_at: String(i) }));
    let n = 0;
    const calls: string[] = [];
    const request = async <T,>(path: string): Promise<T> => {
      calls.push(path);
      n++;
      return { data: n === 1 ? tops : [] } as T;
    };
    await itemsAdapter({ ...base, request }).list();
    expect(calls).toHaveLength(3);
  });

  it('skips the reply read when there are no comments', async () => {
    const { request, calls } = scripted([]);
    expect(await itemsAdapter({ ...base, request }).list()).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('turns nested reaction rows into chips, mine flagged (ids compare without case), names resolved', async () => {
    const row = {
      id: 'c1',
      created_at: '1',
      reactions: [
        { id: 'r1', emoji: '👍', reacted_by: person('me', 'Me') },
        { id: 'r2', emoji: '👍', reacted_by: person('u2', 'Budi') },
        { id: 'r3', emoji: '🔥', reacted_by: 'plain-id' },
      ],
    };
    const { request } = scripted([['GET', { data: [row] }]]);
    const [comment] = await itemsAdapter({ ...base, meId: 'ME', reactionsCollection: 'rx', request }).list();
    expect(comment.reactions).toEqual([
      { emoji: '👍', count: 2, mine: true, names: ['Me X', 'Budi X'] },
      { emoji: '🔥', count: 1, mine: false, names: ['Someone'] },
    ]);
  });

  it('marks my own reaction regardless of case', async () => {
    const row = { id: 'c1', created_at: '1', reactions: [{ id: 'r', emoji: '👍', reacted_by: person('me', 'Me') }] };
    const { request } = scripted([['GET', { data: [row] }]]);
    const [comment] = await itemsAdapter({ ...base, meId: 'ME', reactionsCollection: 'rx', request }).list();
    expect(comment.reactions?.[0].mine).toBe(true);
  });

  it('asks for no reaction columns without a reactions collection', async () => {
    const { request, calls } = scripted([]);
    await itemsAdapter({ ...base, request }).list();
    expect(decodeURIComponent(calls[0].path)).not.toContain('reactions.');
  });

  it('honours custom column names', async () => {
    const { request, calls } = scripted([['GET', { data: [{ id: 'a', reply_to: null, text: 'x', made: '1' }] }]]);
    const list = await itemsAdapter({
      ...base,
      fields: { parent: 'reply_to', body: 'text', createdAt: 'made' },
      request,
    }).list();
    expect(decodeURIComponent(calls[0].path)).toContain('"reply_to":{"_null":true}');
    expect(list[0]).toMatchObject({ id: 'a', body: 'x', createdAt: '1' });
  });

  it('reads the resolve column when the collection has one', async () => {
    const { request } = scripted([['GET', { data: [{ id: 'a', created_at: '1', resolved: 1 }] }]]);
    const [c] = await itemsAdapter({ ...base, fields: { resolved: 'resolved' }, request }).list();
    expect(c.resolved).toBe(true);
  });
});

describe('itemsAdapter.add', () => {
  it('sends only what the browser may send', async () => {
    const { request, calls } = scripted([['POST', { data: { id: 'n1', created_at: '1', body: 'hello' } }]]);
    const made = await itemsAdapter({ ...base, request }).add({ body: 'hello', parent: 'c1', photos: ['f1'] });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ ticket: 't1', parent: 'c1', body: 'hello', photos: ['f1'] });
    expect(made.id).toBe('n1');
  });
  it('sends a null parent and no photos for a top-level comment', async () => {
    const { request, calls } = scripted([['POST', { data: { id: 'n1' } }]]);
    await itemsAdapter({ ...base, request }).add({ body: 'hi' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ ticket: 't1', parent: null, body: 'hi', photos: null });
  });
});

describe('optional capabilities', () => {
  it('are absent by default: comments are immutable', () => {
    const adapter = itemsAdapter({ ...base, request: scripted([]).request });
    expect(adapter.edit).toBeUndefined();
    expect(adapter.remove).toBeUndefined();
    expect(adapter.resolve).toBeUndefined();
    expect(adapter.react).toBeUndefined();
    expect(adapter.linkFor).toBeUndefined();
  });
  it('edit, remove and resolve call the item routes', async () => {
    const { request, calls } = scripted([]);
    const adapter = itemsAdapter({ ...base, allowEdit: true, allowDelete: true, fields: { resolved: 'resolved' }, request });
    await adapter.edit!('c1', 'new');
    await adapter.remove!('c1');
    await adapter.resolve!('c1', true);
    expect(calls.map((c) => [c.init?.method, c.path])).toEqual([
      ['PATCH', '/api/items/ticket_comments/c1'],
      ['DELETE', '/api/items/ticket_comments/c1'],
      ['PATCH', '/api/items/ticket_comments/c1'],
    ]);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ body: 'new' });
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ resolved: true });
  });
  it('linkFor passes through', () => {
    const adapter = itemsAdapter({ ...base, linkFor: (id) => `/t/1?comment=${id}`, request: scripted([]).request });
    expect(adapter.linkFor!('c1')).toBe('/t/1?comment=c1');
  });
});

describe('itemsAdapter.react', () => {
  const withReactions = (request: ReturnType<typeof scripted>['request']) =>
    itemsAdapter({ ...base, reactionsCollection: 'rx', request });

  it('adds a reaction with only the emoji and the target', async () => {
    const { request, calls } = scripted([]);
    await withReactions(request).react!('c1', '👍', true);
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ emoji: '👍', target_comment: 'c1' });
  });

  it('takes back only my rows, matching the heart with or without its selector', async () => {
    const { request, calls } = scripted([
      ['GET /api/items/rx', { data: [{ id: 'r1', emoji: '❤' }, { id: 'r2', emoji: '🔥' }] }],
    ]);
    await withReactions(request).react!('c1', '❤️', false);
    const lookup = decodeURIComponent(calls[0].path);
    expect(lookup).toContain('"target_comment":{"_eq":"c1"}');
    expect(lookup).toContain('"reacted_by":{"_eq":"ME"}');
    expect(calls.slice(1).map((c) => [c.init?.method, c.path])).toEqual([['DELETE', '/api/items/rx/r1']]);
  });

  it('does nothing when there is nothing of mine to take back', async () => {
    const { request, calls } = scripted([]);
    await withReactions(request).react!('c1', '👍', false);
    expect(calls).toHaveLength(1);
  });
});

describe('DEFAULT_FIELDS', () => {
  it('follow the add-comments skill', () => {
    expect(DEFAULT_FIELDS).toMatchObject({ parent: 'parent', root: 'root', author: 'author', photos: 'photos', createdAt: 'created_at' });
    expect(DEFAULT_FIELDS.reaction).toEqual({ emoji: 'emoji', reactedBy: 'reacted_by', target: 'target_comment' });
  });
});
