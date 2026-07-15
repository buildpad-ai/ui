import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RichTextEditor, Link } from '@mantine/tiptap';
import '@mantine/tiptap/styles.css';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Superscript from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { marked } from 'marked';
import { createLowlight } from 'lowlight';

// tiptap-markdown adds `editor.storage.markdown` at runtime but does not
// augment Tiptap's Storage type, so declare it here.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import { ActionIcon, Group, Button, Text, Textarea } from '@mantine/core';
import { IconCode, IconEdit, IconPhoto, IconTable, IconHeading } from '@tabler/icons-react';
import './RichTextMarkdown.css';

// Create lowlight instance for code highlighting
const lowlight = createLowlight();
lowlight.register({ javascript, typescript, css, html, json });

// Detect Markdown block syntax so we only reinterpret code-block pastes that
// are actually Markdown source (leaving genuine code snippets as code blocks).
function looksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|\|.*\|)/.test(text) ||
    /(^|\n)\s*(```|~~~)/.test(text)
  );
}

// When content is copied from a *rendered* Markdown code fence (chat apps, code
// viewers, GitHub), the clipboard's text/html is a lone <pre><code> block.
// Tiptap prefers text/html, so it would trap the whole document in a code block.
// For a Markdown field we instead treat that source as Markdown and render it.
// Exported for unit testing.
export function unwrapCodeBlockPaste(html: string): string {
  if (typeof window === 'undefined' || !html) {
    return html;
  }
  const body = new window.DOMParser().parseFromString(html, 'text/html').body;
  const elements = Array.from(body.children);
  if (elements.length === 1 && elements[0].tagName === 'PRE') {
    const source = elements[0].textContent ?? '';
    if (looksLikeMarkdown(source)) {
      return marked.parse(source, { async: false, gfm: true }) as string;
    }
  }
  return html;
}

export interface RichTextMarkdownProps {
  /** Current value of the editor */
  value?: string;
  /** Called when value changes */
  onChange?: (value: string) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Toolbar configuration - array of toolbar items to show */
  toolbar?: string[];
  /** Custom folder for file uploads */
  folder?: string;
  /** Soft character length limit */
  softLength?: number;
  /** Font family for editor */
  editorFont?: 'sans-serif' | 'serif' | 'monospace';
  /**
   * @deprecated The rendered "Preview" mode was replaced by an editable raw
   * "Source" mode (always monospace) — the WYSIWYG editor IS the preview.
   * Kept so existing call sites keep type-checking; has no effect.
   */
  previewFont?: 'sans-serif' | 'serif' | 'monospace';
  /** Custom syntax extensions */
  customSyntax?: Array<{
    name: string;
    icon: string;
    prefix?: string;
    suffix?: string;
    box?: 'inline' | 'block';
  }>;
}

// 'editor' is the WYSIWYG view (Markdown renders as you type — it doubles as
// the preview); 'source' is an editable raw-Markdown textarea for users who
// want to see or edit the underlying syntax.
type ViewMode = 'editor' | 'source';

const defaultToolbar = [
  'heading',
  'bold',
  'italic',
  'strikethrough',
  'bullist',
  'numlist',
  'blockquote',
  'code',
  'link',
  'table',
  'image',
];

export function RichTextMarkdown({
  value = '',
  onChange,
  label,
  placeholder = 'Start typing...',
  disabled = false,
  required = false,
  error,
  toolbar = defaultToolbar,
  softLength,
  editorFont = 'sans-serif',
  customSyntax = [],
}: RichTextMarkdownProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  // Raw Markdown shown/edited in source mode. Seeded from the editor when
  // entering source mode; written back into the editor when leaving it.
  const [sourceText, setSourceText] = useState('');
  const [tableDialog, setTableDialog] = useState({ open: false, rows: 3, columns: 3 });
  const [imageDialog, setImageDialog] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We'll use CodeBlockLowlight instead if available
        link: false, // We'll use Mantine's Link instead
      }),
      Underline,
      Link,
      Highlight,
      Superscript,
      SubScript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Color,
      TextStyle,
      // Include CodeBlockLowlight for syntax highlighting
      CodeBlockLowlight.configure({
        lowlight,
      }),
      // GFM tables so Markdown tables round-trip instead of being flattened
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder,
      }),
      // Parse the `value` string as Markdown on load and serialize the
      // document back to Markdown via editor.storage.markdown.getMarkdown()
      Markdown.configure({
        html: true,
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Persist Markdown (not HTML) so the field round-trips as Markdown
      const markdown = editor.storage.markdown.getMarkdown();
      onChange?.(markdown);
    },
    editable: !disabled && viewMode === 'editor',
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      // Reinterpret Markdown source pasted from a rendered code fence instead
      // of dropping the whole document into a single code block.
      transformPastedHTML: unwrapCodeBlockPaste,
    },
  });

  // Update editor content when the value prop changes. Compare against the
  // serialized Markdown (not HTML) so an unchanged value doesn't reset the doc.
  // In source mode the textarea is the live view: sync EXTERNAL value changes
  // into it instead of the hidden editor (an echo of our own onChange
  // satisfies value === sourceText, so typing never loses the cursor).
  //
  // Deliberately keyed to [editor, value] only — mode transitions carry
  // content across imperatively in switchViewMode; re-running this effect on
  // viewMode/sourceText changes would clobber source edits with a stale
  // `value` when the component is used uncontrolled. Refs supply the current
  // values without retriggering.
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const sourceTextRef = useRef(sourceText);
  sourceTextRef.current = sourceText;
  useEffect(() => {
    if (!editor) return;
    if (viewModeRef.current === 'source') {
      if (value !== sourceTextRef.current) {
        setSourceText(value || '');
      }
      return;
    }
    if (value !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  // Switch views, carrying content across: editor → source serializes the doc;
  // source → editor re-parses whatever the user typed as Markdown.
  const switchViewMode = useCallback((mode: ViewMode) => {
    if (!editor || mode === viewMode) return;
    if (mode === 'source') {
      setSourceText(editor.storage.markdown.getMarkdown());
    } else if (sourceText !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(sourceText);
    }
    setViewMode(mode);
  }, [editor, viewMode, sourceText]);

  // Character count functionality
  const characterCount = editor?.getText()?.length || 0;
  const remaining = softLength ? softLength - characterCount : null;
  const percRemaining = softLength && remaining !== null ? (remaining / softLength) * 100 : 100;

  // Edit functions for toolbar actions
  const edit = useCallback((action: string, options?: any) => {
    if (!editor) {
      return;
    }

    switch (action) {
      case 'heading':
        editor.chain().focus().toggleHeading({ level: options.level }).run();
        break;
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'strikethrough':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'listBulleted':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'listNumbered':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'link': {
        // eslint-disable-next-line no-alert
        const url = window.prompt('Enter URL');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      }
      case 'table':
        if (options?.rows && options?.columns) {
          // Insert a real table node so it round-trips through Markdown
          editor
            .chain()
            .focus()
            .insertTable({ rows: options.rows, cols: options.columns, withHeaderRow: true })
            .run();
        }
        break;
      case 'custom':
        if (options?.prefix && options?.suffix) {
          const { selection } = editor.state;
          const text = editor.state.doc.textBetween(selection.from, selection.to);
          const replacement = `${options.prefix}${text}${options.suffix}`;
          editor.chain().focus().insertContent(replacement).run();
        }
        break;
    }
  }, [editor]);

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    // This would typically upload to your file storage
    // For now, we'll just create a placeholder
    const imageUrl = URL.createObjectURL(file);
    editor?.chain().focus().insertContent(`![Image](${imageUrl})`).run();
    setImageDialog(false);
  }, [editor]);

  // Don't render until editor is ready
  if (!editor) {
    return (
      <div className="rich-text-markdown-wrapper">
        {label && (
          <div className={`rich-text-markdown-label ${error ? 'rich-text-markdown-label--error' : ''}`}>
            {label}
            {required && <Text component="span" data-required="true"> *</Text>}
          </div>
        )}
        <div className="rich-text-markdown-loading">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="rich-text-markdown-wrapper">
      {label && (
        <div className={`rich-text-markdown-label ${error ? 'rich-text-markdown-label--error' : ''}`}>
          {label}
          {required && <Text component="span" data-required="true"> *</Text>}
        </div>
      )}
      
      <RichTextEditor 
        editor={editor}
        style={{
          border: error ? '1px solid var(--mantine-color-error)' : undefined,
          fontFamily: `var(--mantine-font-family-${editorFont})`,
        }}
      >
        {/* Custom Toolbar */}
        <RichTextEditor.Toolbar>
          {viewMode === 'editor' && (
            <>
              {/* Heading Dropdown */}
              {toolbar.includes('heading') && (
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => edit('heading', { level: 1 })}
                    title="Heading 1"
                    disabled={disabled}
                  >
                    <IconHeading size={16} />
                    <Text size="xs" data-position="absolute-bottom-right">1</Text>
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => edit('heading', { level: 2 })}
                    title="Heading 2"
                    disabled={disabled}
                  >
                    <IconHeading size={16} />
                    <Text size="xs" data-position="absolute-bottom-right">2</Text>
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => edit('heading', { level: 3 })}
                    title="Heading 3"
                    disabled={disabled}
                  >
                    <IconHeading size={16} />
                    <Text size="xs" style={{ position: 'absolute', bottom: 2, right: 2 }}>3</Text>
                  </ActionIcon>
                </Group>
              )}

              {/* Basic formatting */}
              <RichTextEditor.ControlsGroup>
                {toolbar.includes('bold') && <RichTextEditor.Bold />}
                {toolbar.includes('italic') && <RichTextEditor.Italic />}
                {toolbar.includes('strikethrough') && <RichTextEditor.Strikethrough />}
              </RichTextEditor.ControlsGroup>

              {/* Lists */}
              {(toolbar.includes('bullist') || toolbar.includes('numlist')) && (
                <RichTextEditor.ControlsGroup>
                  {toolbar.includes('bullist') && <RichTextEditor.BulletList />}
                  {toolbar.includes('numlist') && <RichTextEditor.OrderedList />}
                </RichTextEditor.ControlsGroup>
              )}

              {/* Quote and Code */}
              {(toolbar.includes('blockquote') || toolbar.includes('code')) && (
                <RichTextEditor.ControlsGroup>
                  {toolbar.includes('blockquote') && <RichTextEditor.Blockquote />}
                  {toolbar.includes('code') && <RichTextEditor.CodeBlock />}
                </RichTextEditor.ControlsGroup>
              )}

              {/* Link */}
              {toolbar.includes('link') && (
                <RichTextEditor.ControlsGroup>
                  <RichTextEditor.Link />
                  <RichTextEditor.Unlink />
                </RichTextEditor.ControlsGroup>
              )}

              {/* Table */}
              {toolbar.includes('table') && (
                <RichTextEditor.ControlsGroup>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setTableDialog({ open: true, rows: 3, columns: 3 })}
                    title="Insert Table"
                    disabled={disabled}
                  >
                    <IconTable size={16} />
                  </ActionIcon>
                </RichTextEditor.ControlsGroup>
              )}

              {/* Image */}
              {toolbar.includes('image') && (
                <RichTextEditor.ControlsGroup>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setImageDialog(true)}
                    title="Insert Image"
                    disabled={disabled}
                  >
                    <IconPhoto size={16} />
                  </ActionIcon>
                </RichTextEditor.ControlsGroup>
              )}

              {/* Custom Syntax */}
              {customSyntax.length > 0 && (
                <RichTextEditor.ControlsGroup>
                  {customSyntax.map((syntax) => (
                    <ActionIcon
                      key={syntax.name}
                      variant="subtle"
                      onClick={() => edit('custom', syntax)}
                      title={syntax.name}
                      disabled={disabled}
                    >
                      <Text size="sm">{syntax.icon}</Text>
                    </ActionIcon>
                  ))}
                </RichTextEditor.ControlsGroup>
              )}
            </>
          )}

          {/* Spacer */}
          <div className="rich-text-markdown-spacer" />

          {/* View Mode Toggle — the WYSIWYG editor renders Markdown as you
              type (it IS the preview); Source exposes the raw Markdown. */}
          <Group gap={0}>
            <Button
              variant={viewMode === 'editor' ? 'filled' : 'subtle'}
              size="xs"
              onClick={() => switchViewMode('editor')}
              leftSection={<IconEdit size={14} />}
              style={{ borderRadius: 'var(--mantine-radius-sm) 0 0 var(--mantine-radius-sm)' }}
            >
              Edit
            </Button>
            <Button
              variant={viewMode === 'source' ? 'filled' : 'subtle'}
              size="xs"
              onClick={() => switchViewMode('source')}
              leftSection={<IconCode size={14} />}
              style={{ borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0' }}
            >
              Source
            </Button>
          </Group>
        </RichTextEditor.Toolbar>

        {/* Editor Content */}
        <div className="rich-text-markdown-content-wrapper">
          <RichTextEditor.Content 
            style={{ 
              display: viewMode === 'editor' ? 'block' : 'none',
              fontFamily: `var(--mantine-font-family-${editorFont})`,
            }} 
          />
          
          {/* Source — the raw Markdown behind the document, editable. Changes
              flow up through onChange immediately and re-parse into the
              WYSIWYG doc when switching back to Edit. */}
          {viewMode === 'source' && (
            <Textarea
              value={sourceText}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setSourceText(text);
                onChange?.(text);
              }}
              disabled={disabled}
              autosize
              minRows={8}
              aria-label={label ? `${label} (Markdown source)` : 'Markdown source'}
              placeholder={placeholder}
              variant="unstyled"
              // No minHeight here: react-textarea-autosize (behind `autosize`)
              // rejects style.minHeight — minRows provides the floor instead.
              styles={{
                input: {
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 'var(--mantine-font-size-sm)',
                  padding: 'var(--mantine-spacing-md)',
                },
              }}
            />
          )}
        </div>

        {/* Character Count */}
        {softLength && remaining !== null && (
          <div
            className={`rich-text-markdown-char-count ${
              percRemaining < 5 ? 'rich-text-markdown-char-count--danger' : 
              percRemaining < 10 ? 'rich-text-markdown-char-count--warning' : 
              'rich-text-markdown-char-count--normal'
            }`}
          >
            {remaining}
          </div>
        )}
      </RichTextEditor>
      
      {error && (
        <div className="rich-text-markdown-error-message">
          {error}
        </div>
      )}

      {/* Table Dialog - Simple implementation */}
      {tableDialog.open && (
        <div className="rich-text-markdown-dialog">
          <Text size="sm" mb="md">Create Table</Text>
          <Group mb="md">
            <div>
              <Text size="xs" mb={4}>Rows</Text>
              <input
                type="number"
                min="1"
                aria-label="Number of rows"
                value={tableDialog.rows}
                onChange={(e) => setTableDialog(prev => ({ ...prev, rows: parseInt(e.target.value, 10) || 1 }))}
                className="rich-text-markdown-number-input"
              />
            </div>
            <div>
              <Text size="xs" mb={4}>Columns</Text>
              <input
                type="number"
                min="1"
                aria-label="Number of columns"
                value={tableDialog.columns}
                onChange={(e) => setTableDialog(prev => ({ ...prev, columns: parseInt(e.target.value, 10) || 1 }))}
                className="rich-text-markdown-number-input"
              />
            </div>
          </Group>
          <Group>
            <Button
              size="xs"
              onClick={() => {
                edit('table', { rows: tableDialog.rows, columns: tableDialog.columns });
                setTableDialog(prev => ({ ...prev, open: false }));
              }}
            >
              Create
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setTableDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
          </Group>
        </div>
      )}

      {/* Backdrop for dialogs */}
      {(tableDialog.open || imageDialog) && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close dialog"
          className="rich-text-markdown-backdrop"
          onClick={() => {
            setTableDialog(prev => ({ ...prev, open: false }));
            setImageDialog(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setTableDialog(prev => ({ ...prev, open: false }));
              setImageDialog(false);
            }
          }}
        />
      )}

      {/* Image Dialog - Simple implementation */}
      {imageDialog && (
        <div className="rich-text-markdown-dialog">
          <Text size="sm" mb="md">Insert Image</Text>
          <input
            type="file"
            accept="image/*"
            aria-label="Select image file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImageUpload(file);
              }
            }}
            className="rich-text-markdown-file-input"
          />
          <Group>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setImageDialog(false)}
            >
              Cancel
            </Button>
          </Group>
        </div>
      )}
    </div>
  );
}
