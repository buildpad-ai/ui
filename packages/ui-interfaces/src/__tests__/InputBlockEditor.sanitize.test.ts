/**
 * sanitizeBlocks: stored EditorJS data is untrusted, and EditorJS assigns block
 * strings to innerHTML on render without sanitizing them.
 */
import type { OutputData } from '@editorjs/editorjs';
import { sanitizeBlocks } from '../input-block-editor/InputBlockEditor';

type Blocks = OutputData['blocks'];

describe('sanitizeBlocks', () => {
  it('strips script-bearing markup from paragraph text', () => {
    const [block] = sanitizeBlocks([
      { type: 'paragraph', data: { text: 'hi <img src=x onerror="alert(1)"><script>alert(2)</script>' } },
    ]);
    expect(block.data.text).toBe('hi ');
  });

  it('keeps the inline markup the editor tools produce', () => {
    const text =
      '<b>b</b> <i>i</i> <u class="cdx-underline">u</u> <code class="inline-code">c</code> <a href="https://example.com">l</a><br>';
    const [block] = sanitizeBlocks([{ type: 'paragraph', data: { text } }]);
    expect(block.data.text).toBe(text);
  });

  it('removes event handlers and javascript: links', () => {
    const [block] = sanitizeBlocks([
      { type: 'header', data: { text: '<a href="javascript:alert(1)" onclick="x()">t</a>', level: 2 } },
    ]);
    expect(block.data.text).toBe('<a>t</a>');
    expect(block.data.level).toBe(2);
  });

  it('sanitizes nested list items, checklist items, table cells and quote captions', () => {
    const evil = '<img src=x onerror=alert(1)>ok';
    const blocks: Blocks = [
      {
        type: 'nestedlist',
        data: { style: 'unordered', items: [{ content: evil, items: [{ content: evil, items: [] }] }] },
      },
      { type: 'checklist', data: { items: [{ text: evil, checked: true }] } },
      { type: 'table', data: { withHeadings: false, content: [[evil, 'plain']] } },
      { type: 'quote', data: { text: evil, caption: evil, alignment: 'left' } },
    ];
    const [list, checklist, table, quote] = sanitizeBlocks(blocks);

    expect(list.data.items[0].content).toBe('ok');
    expect(list.data.items[0].items[0].content).toBe('ok');
    expect(list.data.style).toBe('unordered');
    expect(checklist.data.items[0]).toEqual({ text: 'ok', checked: true });
    expect(table.data).toEqual({ withHeadings: false, content: [['ok', 'plain']] });
    expect(quote.data).toEqual({ text: 'ok', caption: 'ok', alignment: 'left' });
  });

  it('leaves code blocks untouched: they render as plain text, and markup is their content', () => {
    const code = '<div onclick="x()">not html here</div>';
    const [block] = sanitizeBlocks([{ type: 'code', data: { code } }]);
    expect(block.data.code).toBe(code);
  });

  it('keeps block ids and types', () => {
    const [block] = sanitizeBlocks([{ id: 'abc', type: 'paragraph', data: { text: 'x' } }]);
    expect(block).toEqual({ id: 'abc', type: 'paragraph', data: { text: 'x' } });
  });
});
