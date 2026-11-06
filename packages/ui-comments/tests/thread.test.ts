import { buildThreads, countThread, indentFor, MAX_DEPTH } from '../src/core/thread';
import type { Comment } from '../src/core/types';

const c = (id: string, parent: string | null, createdAt: string): Comment => ({
  id,
  parent,
  root: null,
  author: null,
  body: id,
  photos: null,
  createdAt,
});

describe('buildThreads', () => {
  it('nests replies under their parent, oldest first', () => {
    const t = buildThreads([c('r2', 'a', '3'), c('a', null, '1'), c('r1', 'a', '2'), c('rr', 'r1', '4')]);
    expect(t).toHaveLength(1);
    expect(t[0].children.map((n) => n.comment.id)).toEqual(['r1', 'r2']);
    expect(t[0].children[0].children[0].comment.id).toBe('rr');
    expect(t[0].children[0].children[0].depth).toBe(2);
    expect(countThread(t[0])).toBe(4);
  });
  it('orders top-level comments oldest first', () => {
    expect(buildThreads([c('b', null, '2'), c('a', null, '1')]).map((n) => n.comment.id)).toEqual(['a', 'b']);
  });
  it('keeps a reply whose parent is not loaded at the top, marked orphan', () => {
    expect(buildThreads([c('x', 'gone', '1')])[0].orphan).toBe(true);
    expect(buildThreads([c('x', null, '1')])[0].orphan).toBe(false);
  });
  it('survives a cycle without looping and still shows both comments', () => {
    const t = buildThreads([c('a', 'b', '1'), c('b', 'a', '2')]);
    expect(t.reduce((sum, node) => sum + countThread(node), 0)).toBe(2);
  });
  it('treats a comment that answers itself as top-level', () => {
    expect(buildThreads([c('a', 'a', '1')])).toHaveLength(1);
  });
  it('stops drawing past the depth guard', () => {
    const list = [c('0', null, '000')];
    for (let i = 1; i <= MAX_DEPTH + 5; i++) list.push(c(String(i), String(i - 1), String(i).padStart(3, '0')));
    const t = buildThreads(list);
    // Replies below the guard are not drawn, but they are not lost either: they come out at the top.
    expect(countThread(t[0])).toBe(MAX_DEPTH + 1);
    expect(t.reduce((sum, node) => sum + countThread(node), 0)).toBe(MAX_DEPTH + 6);
  });
});

describe('indentFor', () => {
  it('shrinks per level', () => {
    expect([0, 1, 2, 5].map(indentFor)).toEqual([0, 41, 22, 22]);
  });
});
