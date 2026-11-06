import { blocks, inline, toggleMark, toggleBullets, continueBullet } from '../src/core/richtext';

describe('blocks', () => {
  it('splits paragraphs and groups consecutive bullets', () => {
    expect(blocks('Hello\n- a\n- b\nBye')).toEqual([
      { type: 'p', text: 'Hello' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'p', text: 'Bye' },
    ]);
  });
  it('drops leading blank lines and normalises CRLF', () => {
    expect(blocks('\r\n\r\nHi\r\nthere')).toEqual([
      { type: 'p', text: 'Hi' },
      { type: 'p', text: 'there' },
    ]);
  });
  it('accepts the bullet character', () => {
    expect(blocks('• one')).toEqual([{ type: 'ul', items: ['one'] }]);
  });
});

describe('inline', () => {
  it('reads bold, italic and underline', () => {
    expect(inline('a **b** *c* ++d++ e')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'underline', text: 'd' },
      { kind: 'text', text: ' e' },
    ]);
  });
  it('keeps an unmatched mark as typed', () => {
    expect(inline('a **b')).toEqual([{ kind: 'text', text: 'a **b' }]);
    expect(inline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }]);
  });
  it('never turns markup into anything but text', () => {
    expect(inline('<b>x</b>')).toEqual([{ kind: 'text', text: '<b>x</b>' }]);
  });
  it('leaves empty marks alone', () => {
    expect(inline('****')).toEqual([{ kind: 'text', text: '****' }]);
  });
});

describe('toggleMark', () => {
  it('wraps the selection and moves it inside the marks', () => {
    expect(toggleMark('say hi now', 4, 6, '**')).toEqual({ text: 'say **hi** now', from: 6, to: 8 });
  });
  it('takes the mark off when the selection sits inside it', () => {
    expect(toggleMark('say **hi** now', 6, 8, '**')).toEqual({ text: 'say hi now', from: 4, to: 6 });
  });
  it('takes the mark off when the selection includes it', () => {
    expect(toggleMark('say **hi** now', 4, 10, '**')).toEqual({ text: 'say hi now', from: 4, to: 6 });
  });
  it('does not unwrap a single star from around the selection', () => {
    expect(toggleMark('*hi*', 1, 3, '*').text).toBe('**hi**');
  });
});

describe('toggleBullets', () => {
  it('turns lines into bullets and back', () => {
    const on = toggleBullets('a\nb', 0, 3);
    expect(on.text).toBe('- a\n- b');
    expect(toggleBullets(on.text, on.from, on.to).text).toBe('a\nb');
  });
  it('bullets only the unbulleted lines of a mixed selection', () => {
    expect(toggleBullets('- a\nb', 0, 5).text).toBe('- a\n- b');
  });
  it('works on the line the caret is on', () => {
    expect(toggleBullets('x\ny\nz', 2, 2).text).toBe('x\n- y\nz');
  });
});

describe('continueBullet', () => {
  it('starts another bullet', () => {
    expect(continueBullet('- a', 3)).toEqual({ text: '- a\n- ', caret: 6 });
  });
  it('ends the list on an empty bullet', () => {
    expect(continueBullet('x\n- ', 4)).toEqual({ text: 'x\n', caret: 2 });
  });
  it('returns null outside a bullet', () => {
    expect(continueBullet('plain', 5)).toBeNull();
  });
});
