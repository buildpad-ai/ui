import React from 'react';
import { RichTextEditor, Link, type RichTextEditorLabels } from '@mantine/tiptap';
import '@mantine/tiptap/styles.css';
import { useBuildpadTranslations } from '@buildpad/services';
import { interpolate, type DeepPartial, type InterfacesTranslations } from '@buildpad/utils';
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
  /** Content is visible but not editable — Tiptap's own `editable` flag. */
  readOnly?: boolean;
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
  /** Per-instance overrides of the dictionary strings (`interfaces.richTextHtml`) */
  translations?: DeepPartial<InterfacesTranslations['richTextHtml']>;
}

/**
 * Mantine's `RichTextEditor` `labels` config from the dictionary. The two
 * colour labels are `{color}` templates in the dictionary (strings, not
 * functions) and are turned back into the functions Mantine expects.
 */
export function toRichTextEditorLabels(
  labels: InterfacesTranslations['richTextHtml']['editor'],
): RichTextEditorLabels {
  const { colorControlLabel, colorPickerColorLabel, ...rest } = labels;
  return {
    ...rest,
    colorControlLabel: (color) => interpolate(colorControlLabel, { color }),
    colorPickerColorLabel: (color) => interpolate(colorPickerColorLabel, { color }),
  };
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
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  toolbar = defaultToolbar,
  folder: _folder, // Reserved for future file upload functionality
  softLength,
  minimal = false,
  editorFont = 'sans-serif',
  translations,
}: RichTextHTMLProps) {
  // Dictionary strings; the `placeholder` prop wins over both the
  // `translations` prop and the provider dictionary.
  const t = useBuildpadTranslations((d) => d.interfaces.richTextHtml, translations, { placeholder });
  const editorLabels = React.useMemo(() => toRichTextEditorLabels(t.editor), [t.editor]);

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
        placeholder: t.placeholder,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
    editable: !disabled && !readOnly,
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

  // `editable` above is only read when the editor is constructed, so a
  // disabled/readOnly flag that resolves after mount (async permissions) would
  // otherwise leave a live editor behind. Keep it in sync.
  React.useEffect(() => {
    editor?.setEditable(!disabled && !readOnly);
  }, [editor, disabled, readOnly]);

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
          {t.loading}
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
        labels={editorLabels}
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
