import React from 'react';
import { RichTextEditor, Link } from '@mantine/tiptap';
import '@mantine/tiptap/styles.css';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import SubScript from '@tiptap/extension-subscript';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import './RichTextHTML.css';

export interface RichTextHTMLProps {
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
  /** Whether to use minimal toolbar */
  minimal?: boolean;
  /** Editor font family */
  editorFont?: 'sans-serif' | 'serif' | 'monospace';
}

const defaultToolbar = [
  'bold',
  'italic',
  'underline',
  'h1',
  'h2',
  'h3',
  'numlist',
  'bullist',
  'removeformat',
  'blockquote',
  'customLink',
  'hr',
  'code',
];

export function RichTextHTML({
  value = '',
  onChange,
  label,
  placeholder = 'Start typing...',
  disabled = false,
  required = false,
  error,
  toolbar = defaultToolbar,
  folder: _folder, // Reserved for future file upload functionality
  softLength,
  minimal = false,
  editorFont = 'sans-serif',
}: RichTextHTMLProps) {
  // Font configuration
  const fontOptions = {
    'sans-serif': 'ui-sans-serif, system-ui, sans-serif',
    'serif': 'ui-serif, Georgia, serif',
    'monospace': 'ui-monospace, Menlo, monospace'
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false, // Disable StarterKit's link to use Mantine's Link
      }),
      Highlight,
      Underline,
      Link,
      Superscript,
      SubScript,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Color,
      TextStyle,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
    editable: !disabled,
    // Always false: the editor is created asynchronously in a useEffect after
    // the component's DOM has been committed. This is critical when the editor
    // mounts inside a container that was just made visible (e.g. accordion
    // section) — with `true`, Tiptap tries to attach ProseMirror to a DOM node
    // that React hasn't committed yet, resulting in a zero-height content area.
    immediatelyRender: false,
    // Tiptap v3 defaults this to false for performance, but we need the
    // component to re-render when the editor becomes available so the
    // loading placeholder is replaced with the actual editor UI.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        style: `font-family: ${fontOptions[editorFont]}`,
      },
    },
  });

  // Update editor content when value prop changes
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [editor, value]);

  // Character count functionality
  const characterCount = editor?.getText()?.length || 0;
  const isNearLimit = softLength && characterCount > softLength * 0.8;
  const isOverLimit = softLength && characterCount > softLength;

  // Don't render until editor is ready
  if (!editor) {
    return (
      <div className="rich-text-html-wrapper">
        {label && (
          <div className={`rich-text-html-label ${error ? 'rich-text-html-label--error' : ''}`}>
            {label}
            {required && <span className="rich-text-html-required"> *</span>}
          </div>
        )}
        <div className="rich-text-html-loading">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="rich-text-html-wrapper">
      {label && (
        <div className={`rich-text-html-label ${error ? 'rich-text-html-label--error' : ''}`}>
          {label}
          {required && <span className="rich-text-html-required"> *</span>}
        </div>
      )}
      
      <RichTextEditor 
        editor={editor}
        className={error ? 'rich-text-html-editor--error' : undefined}
      >
        {!minimal && (
          <RichTextEditor.Toolbar>
            <RichTextEditor.ControlsGroup>
              {toolbar.includes('bold') && <RichTextEditor.Bold />}
              {toolbar.includes('italic') && <RichTextEditor.Italic />}
              {toolbar.includes('underline') && <RichTextEditor.Underline />}
              {toolbar.includes('strikethrough') && <RichTextEditor.Strikethrough />}
              {toolbar.includes('removeformat') && <RichTextEditor.ClearFormatting />}
              {toolbar.includes('highlight') && <RichTextEditor.Highlight />}
              {toolbar.includes('code') && <RichTextEditor.Code />}
            </RichTextEditor.ControlsGroup>

            {(toolbar.includes('h1') || toolbar.includes('h2') || toolbar.includes('h3') || 
              toolbar.includes('h4') || toolbar.includes('h5') || toolbar.includes('h6')) && (
              <RichTextEditor.ControlsGroup>
                {toolbar.includes('h1') && <RichTextEditor.H1 />}
                {toolbar.includes('h2') && <RichTextEditor.H2 />}
                {toolbar.includes('h3') && <RichTextEditor.H3 />}
                {toolbar.includes('h4') && <RichTextEditor.H4 />}
                {toolbar.includes('h5') && <RichTextEditor.H5 />}
                {toolbar.includes('h6') && <RichTextEditor.H6 />}
              </RichTextEditor.ControlsGroup>
            )}

            {(toolbar.includes('blockquote') || toolbar.includes('hr') || toolbar.includes('bullist') || 
              toolbar.includes('numlist') || toolbar.includes('subscript') || toolbar.includes('superscript')) && (
              <RichTextEditor.ControlsGroup>
                {toolbar.includes('blockquote') && <RichTextEditor.Blockquote />}
                {toolbar.includes('hr') && <RichTextEditor.Hr />}
                {toolbar.includes('bullist') && <RichTextEditor.BulletList />}
                {toolbar.includes('numlist') && <RichTextEditor.OrderedList />}
                {toolbar.includes('subscript') && <RichTextEditor.Subscript />}
                {toolbar.includes('superscript') && <RichTextEditor.Superscript />}
              </RichTextEditor.ControlsGroup>
            )}

            {toolbar.includes('customLink') && (
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>
            )}

            {(toolbar.includes('alignleft') || toolbar.includes('aligncenter') || 
              toolbar.includes('alignright') || toolbar.includes('alignjustify')) && (
              <RichTextEditor.ControlsGroup>
                {toolbar.includes('alignleft') && <RichTextEditor.AlignLeft />}
                {toolbar.includes('aligncenter') && <RichTextEditor.AlignCenter />}
                {toolbar.includes('alignright') && <RichTextEditor.AlignRight />}
                {toolbar.includes('alignjustify') && <RichTextEditor.AlignJustify />}
              </RichTextEditor.ControlsGroup>
            )}

            {(toolbar.includes('undo') || toolbar.includes('redo')) && (
              <RichTextEditor.ControlsGroup>
                {toolbar.includes('undo') && <RichTextEditor.Undo />}
                {toolbar.includes('redo') && <RichTextEditor.Redo />}
              </RichTextEditor.ControlsGroup>
            )}
          </RichTextEditor.Toolbar>
        )}

        <RichTextEditor.Content />
        
        {softLength && (
          <div
            className={`rich-text-html-char-count ${
              isOverLimit ? 'rich-text-html-char-count--over-limit' : 
              isNearLimit ? 'rich-text-html-char-count--near-limit' : 
              'rich-text-html-char-count--normal'
            }`}
          >
            {softLength - characterCount}
          </div>
        )}
      </RichTextEditor>
      
      {error && (
        <div className="rich-text-html-error-message">
          {error}
        </div>
      )}
    </div>
  );
}
