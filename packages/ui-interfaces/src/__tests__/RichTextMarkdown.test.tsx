import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// Mock the lowlight import to avoid ESM/highlight.js issues in jsdom
jest.mock('lowlight', () => ({
  createLowlight: () => ({
    register: jest.fn(),
  }),
}));

// The component imports CodeBlockLowlight as a default export, so the mock
// must expose a default with a `configure` that returns a valid extension.
jest.mock('@tiptap/extension-code-block-lowlight', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(() => ({})),
  },
}));

// Import after mocking
import { RichTextMarkdown, unwrapCodeBlockPaste } from '../rich-text-markdown/RichTextMarkdown';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('RichTextMarkdown', () => {
  it('renders with default props', () => {
    renderWithProvider(<RichTextMarkdown />);

    // Check if the rich text editor container is present
    expect(document.querySelector('.mantine-RichTextEditor-root')).toBeDefined();
  });

  it('renders with label when provided', () => {
    renderWithProvider(
      <RichTextMarkdown label="Markdown Editor" />
    );

    expect(screen.getByText('Markdown Editor')).toBeDefined();
  });

  it('shows required indicator when required', () => {
    renderWithProvider(
      <RichTextMarkdown label="Markdown Editor" required />
    );

    expect(screen.getByText('Markdown Editor')).toBeDefined();
    expect(screen.getByText('*')).toBeDefined();
  });

  it('applies error state correctly', () => {
    renderWithProvider(
      <RichTextMarkdown error="This field has an error" />
    );

    expect(screen.getByText('This field has an error')).toBeDefined();
  });

  it('handles disabled state', () => {
    renderWithProvider(
      <RichTextMarkdown disabled />
    );

    // Editor should be present but in disabled state
    const editor = document.querySelector('.mantine-RichTextEditor-root');
    expect(editor).toBeDefined();
  });

  it('shows edit and source toggle buttons', async () => {
    renderWithProvider(<RichTextMarkdown />);

    expect(await screen.findByText('Edit')).toBeDefined();
    expect(screen.getByText('Source')).toBeDefined();
  });

  it('shows the raw Markdown in source mode', async () => {
    const md = '## MarkdownSource\n\n> todo: React component source markdown text.';
    renderWithProvider(<RichTextMarkdown value={md} label="Markdown" />);

    // Wait for the Tiptap editor to initialize, then switch to source.
    const sourceButton = await screen.findByText('Source');
    fireEvent.click(sourceButton);

    const textarea = await screen.findByLabelText<HTMLTextAreaElement>('Markdown (Markdown source)');
    // Raw Markdown syntax, verbatim — NOT rendered elements.
    expect(textarea.value).toContain('## MarkdownSource');
    expect(textarea.value).toContain('> todo:');
  });

  it('propagates source-mode edits through onChange', async () => {
    const onChange = jest.fn();
    renderWithProvider(<RichTextMarkdown value="Hello" onChange={onChange} />);

    fireEvent.click(await screen.findByText('Source'));
    const textarea = await screen.findByLabelText<HTMLTextAreaElement>('Markdown source');
    fireEvent.change(textarea, { target: { value: '## Edited in source' } });

    expect(onChange).toHaveBeenCalledWith('## Edited in source');
  });

  it('re-parses source edits into the WYSIWYG doc when switching back', async () => {
    renderWithProvider(<RichTextMarkdown value="Hello" />);

    fireEvent.click(await screen.findByText('Source'));
    const textarea = await screen.findByLabelText<HTMLTextAreaElement>('Markdown source');
    fireEvent.change(textarea, { target: { value: '## FromSource' } });
    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      const heading = document.querySelector('.mantine-RichTextEditor-content h2');
      expect(heading).not.toBeNull();
      expect(heading?.textContent).toContain('FromSource');
    });
  });
});

describe('unwrapCodeBlockPaste', () => {
  const md = '# Title\n\n| # | Problem |\n| --- | --- |\n| 1 | tax |\n';
  const codeFenceHtml = `<pre><code class="language-markdown">${md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</code></pre>`;

  it('reinterprets a code-fence paste of Markdown as rendered HTML', () => {
    const out = unwrapCodeBlockPaste(codeFenceHtml);
    expect(out).toContain('<h1');
    expect(out).toContain('<table');
    expect(out).not.toContain('| #');
  });

  it('leaves a genuine code snippet as a code block', () => {
    const codeHtml = '<pre><code class="language-js">function add(a, b) { return a + b; }</code></pre>';
    expect(unwrapCodeBlockPaste(codeHtml)).toBe(codeHtml);
  });

  it('passes through non-code-block HTML unchanged', () => {
    const rich = '<p>Some <strong>bold</strong> text</p>';
    expect(unwrapCodeBlockPaste(rich)).toBe(rich);
  });
});
