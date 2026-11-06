import { REACTIONS, canonicalReaction, summarize, toggleLocal, reactorNames } from '../src/core/reactions';

describe('canonicalReaction', () => {
  it('accepts the list and returns its form', () => {
    expect(canonicalReaction('👍')).toBe('👍');
    expect(canonicalReaction(' 🔥 ')).toBe('🔥');
  });
  it('treats the heart with and without the variation selector as one reaction', () => {
    expect(canonicalReaction('❤')).toBe('❤️');
    expect(canonicalReaction('❤️')).toBe('❤️');
  });
  it('refuses anything else', () => {
    expect(canonicalReaction('🦄')).toBeNull();
    expect(canonicalReaction(7)).toBeNull();
    expect(canonicalReaction(undefined)).toBeNull();
  });
  it('has twelve reactions', () => expect(REACTIONS).toHaveLength(12));
});

describe('summarize', () => {
  const people: Record<string, string> = { a: 'Ana', b: 'Budi' };
  const name = (id: string) => people[id] ?? 'Someone';
  it('groups by emoji in list order and flags mine', () => {
    const chips = summarize(
      [
        { emoji: '🔥', reacted_by: 'a' },
        { emoji: '👍', reacted_by: 'b' },
        { emoji: '👍', reacted_by: 'A' },
      ],
      'a',
      name
    );
    expect(chips).toEqual([
      { emoji: '👍', count: 2, mine: true, names: ['Budi', 'Ana'] },
      { emoji: '🔥', count: 1, mine: true, names: ['Ana'] },
    ]);
  });
  it('counts a person once per emoji', () => {
    const chips = summarize([{ emoji: '👍', reacted_by: 'a' }, { emoji: '👍', reacted_by: 'a' }], null, name);
    expect(chips).toEqual([{ emoji: '👍', count: 1, mine: false, names: ['Ana'] }]);
  });
  it('merges the two hearts and keeps unknown emoji last', () => {
    const chips = summarize(
      [
        { emoji: '🦄', reacted_by: 'a' },
        { emoji: '❤', reacted_by: 'a' },
        { emoji: '❤️', reacted_by: 'b' },
      ],
      null,
      name
    );
    expect(chips.map((c) => [c.emoji, c.count])).toEqual([
      ['❤️', 2],
      ['🦄', 1],
    ]);
  });
});

describe('toggleLocal', () => {
  it('adds a first reaction', () => {
    expect(toggleLocal(undefined, '👍', true, 'Me')).toEqual([{ emoji: '👍', count: 1, mine: true, names: ['Me'] }]);
  });
  it('joins an existing chip once', () => {
    const base = [{ emoji: '👍', count: 1, mine: false, names: ['Ana'] }];
    const on = toggleLocal(base, '👍', true, 'Me');
    expect(on[0]).toEqual({ emoji: '👍', count: 2, mine: true, names: ['Ana', 'Me'] });
    expect(toggleLocal(on, '👍', true, 'Me')[0].count).toBe(2);
  });
  it('takes mine back and drops an empty chip', () => {
    const base = [{ emoji: '👍', count: 2, mine: true, names: ['Ana', 'Me'] }];
    expect(toggleLocal(base, '👍', false, 'Me')).toEqual([{ emoji: '👍', count: 1, mine: false, names: ['Ana'] }]);
    expect(toggleLocal([{ emoji: '👍', count: 1, mine: true, names: ['Me'] }], '👍', false, 'Me')).toEqual([]);
  });
  it('ignores removing a reaction that is not mine', () => {
    const base = [{ emoji: '👍', count: 1, mine: false, names: ['Ana'] }];
    expect(toggleLocal(base, '👍', false, 'Me')).toEqual(base);
    expect(toggleLocal(base, '🔥', false, 'Me')).toEqual(base);
  });
  it('keeps the list order', () => {
    const base = [{ emoji: '🔥', count: 1, mine: false, names: ['Ana'] }];
    expect(toggleLocal(base, '👍', true, 'Me').map((c) => c.emoji)).toEqual(['👍', '🔥']);
  });
});

describe('reactorNames', () => {
  const more = (n: number) => `and ${n} more`;
  it('lists up to three', () => expect(reactorNames(['A', 'B', 'C'], more)).toBe('A, B, C'));
  it('cuts after three', () => expect(reactorNames(['A', 'B', 'C', 'D', 'E'], more)).toBe('A, B, C and 2 more'));
});
