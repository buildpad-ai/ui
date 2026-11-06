import {
  MAX_MENTIONS,
  capMentions,
  cleanName,
  findTrigger,
  makeToken,
  mentionIds,
  parseTokens,
  segments,
  stripTokens,
  toDisplay,
  toStored,
} from '../src/core/mentions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('makeToken / cleanName', () => {
  it('builds the skill token with a lower-case id', () => {
    expect(makeToken('Ana Putri', A.toUpperCase())).toBe(`@[Ana Putri](user:${A})`);
  });
  it('removes brackets, parentheses and line breaks from a name', () => {
    expect(cleanName('A[n]a (X)\nY')).toBe('A n a X Y');
  });
  it('caps a long name and falls back for an empty one', () => {
    expect(cleanName('x'.repeat(300))).toHaveLength(100);
    expect(makeToken('[]', A)).toBe(`@[Someone](user:${A})`);
  });
});

describe('parseTokens / mentionIds', () => {
  const body = `hi @[Ana](user:${A}) and @[Budi](user:${B}) and @[Ana](user:${A}) again`;
  it('finds tokens with their positions', () => {
    const t = parseTokens(body);
    expect(t.map((x) => [x.name, x.id])).toEqual([['Ana', A], ['Budi', B], ['Ana', A]]);
    expect(body.slice(t[0].start, t[0].end)).toBe(`@[Ana](user:${A})`);
  });
  it('lists people once each, in order', () => expect(mentionIds(body)).toEqual([A, B]));
  it('ignores things that only look like tokens', () => {
    expect(parseTokens('@[Ana](user:not-a-uuid) @[Ana](email:a@b.c) @Ana [x](user:' + A + ')')).toEqual([]);
  });
  it('is safe to call twice (no shared regex state)', () => {
    expect(parseTokens(body)).toHaveLength(3);
    expect(parseTokens(body)).toHaveLength(3);
  });
  it('reads upper-case ids as lower-case', () => {
    expect(mentionIds(`@[A](user:${A.toUpperCase()})`)).toEqual([A]);
  });
});

describe('stripTokens', () => {
  const body = `@[Ana](user:${A}) @[Budi](user:${B})`;
  it('turns every token into plain @Name', () => expect(stripTokens(body)).toBe('@Ana @Budi'));
  it('keeps the people it accepts', () => {
    expect(stripTokens(body, (id) => id === A)).toBe(`@[Ana](user:${A}) @Budi`);
  });
});

describe('capMentions', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`);
  const body = ids.map((id, i) => `@[P${i}](user:${id})`).join(' ');
  it('keeps the first ten people as mentions and flattens the rest', () => {
    const capped = capMentions(body);
    expect(mentionIds(capped)).toEqual(ids.slice(0, MAX_MENTIONS));
    expect(capped.endsWith('@P10 @P11')).toBe(true);
  });
  it('keeps every mention of a person that made the cut', () => {
    expect(mentionIds(capMentions(`@[A](user:${A}) @[A](user:${A})`, 1))).toEqual([A]);
    expect(parseTokens(capMentions(`@[A](user:${A}) @[A](user:${A})`, 1))).toHaveLength(2);
  });
});

describe('segments', () => {
  it('cuts a body into text and mentions', () => {
    expect(segments(`a @[Ana](user:${A}) b`)).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'mention', name: 'Ana', id: A },
      { type: 'text', text: ' b' },
    ]);
  });
  it('returns one text segment when there is no mention, and none for an empty body', () => {
    expect(segments('plain')).toEqual([{ type: 'text', text: 'plain' }]);
    expect(segments('')).toEqual([]);
  });
});

describe('toDisplay / toStored', () => {
  it('round-trips', () => {
    const stored = `hello @[Ana Putri](user:${A}), meet @[Ana](user:${B})`;
    const { text, picked } = toDisplay(stored);
    expect(text).toBe('hello @Ana Putri, meet @Ana');
    expect(toStored(text, picked)).toBe(stored);
  });
  it('replaces the longest name first, so @Ana Putri is not read as @Ana', () => {
    const stored = toStored('@Ana Putri and @Ana', { Ana: B, 'Ana Putri': A });
    expect(stored).toBe(`@[Ana Putri](user:${A}) and @[Ana](user:${B})`);
  });
  it('only matches a whole word', () => {
    expect(toStored('@Anabel', { Ana: A })).toBe('@Anabel');
  });
  it('only matches at the start or after whitespace', () => {
    expect(toStored('mail@Ana', { Ana: A })).toBe('mail@Ana');
  });
  it('handles names with regex characters', () => {
    expect(toStored('hi @A.B (x)', { 'A.B (x)': A })).toBe(`hi @[A.B x](user:${A})`);
  });
  it('leaves text alone when nobody was picked', () => expect(toStored('@Ana', {})).toBe('@Ana'));
});

describe('findTrigger', () => {
  it('finds a word right after @', () => {
    expect(findTrigger('hi @an', 6)).toEqual({ start: 3, query: 'an' });
    expect(findTrigger('@', 1)).toEqual({ start: 0, query: '' });
  });
  it('needs the @ at the start or after whitespace', () => {
    expect(findTrigger('mail@an', 7)).toBeNull();
  });
  it('stops at a space', () => expect(findTrigger('hi @an ', 7)).toBeNull());
  it('looks only before the caret', () => expect(findTrigger('hi @an|x', 6)).toEqual({ start: 3, query: 'an' }));
  it('gives up on a long word', () => expect(findTrigger('@' + 'x'.repeat(31), 32)).toBeNull());
});
