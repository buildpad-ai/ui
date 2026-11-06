'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Text, Textarea, Tooltip } from '@mantine/core';
import { IconBold, IconItalic, IconList, IconUnderline } from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import { EmojiPicker } from './EmojiPicker';
import { continueBullet, toggleBullets, toggleMark } from './core/richtext';
import { MAX_BODY } from './core/types';
import { checkBody, type CommentError } from './core/validation';

export interface ComposerProps {
  strings: CommentsTranslations;
  placeholder: string;
  /** Label of the primary button: "Comment", "Reply" or "Save". */
  submitLabel: string;
  /** Sends the text. Reject to keep the box as it is (the caller reports the failure). */
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  /** Text to start from, when editing. */
  initial?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

const errorText = (error: CommentError, strings: CommentsTranslations, max: number) => {
  switch (error) {
    case 'empty':
      return strings.errors.empty;
    case 'too-long':
      return interpolate(strings.errors.tooLong, { max });
    case 'too-many-photos':
      return strings.errors.tooManyPhotos;
    default:
      return strings.errors.photosInvalid;
  }
};

/**
 * The comment box: a textarea with a formatting toolbar (bold, italic, underline, bullets) and an
 * emoji picker. Ctrl/Cmd+Enter sends, Esc cancels, Enter inside a bullet continues the list.
 */
export function Composer({
  strings,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  initial = '',
  autoFocus,
  maxLength = MAX_BODY,
}: ComposerProps) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<{ from: number; to: number } | null>(null);
  const { formatCount } = useBuildpadI18n();

  // After the text changes from a toolbar action, put the selection where the action left it.
  useLayoutEffect(() => {
    if (caret.current && field.current) {
      field.current.setSelectionRange(caret.current.from, caret.current.to);
      caret.current = null;
    }
  }, [text]);

  const selection = () => {
    const el = field.current;
    return { from: el?.selectionStart ?? text.length, to: el?.selectionEnd ?? text.length };
  };

  const apply = (next: { text: string; from: number; to: number }) => {
    caret.current = { from: next.from, to: next.to };
    setText(next.text);
    setProblem(null);
    field.current?.focus();
  };

  const mark = (symbol: '**' | '*' | '++') => {
    const { from, to } = selection();
    apply(toggleMark(text, from, to, symbol));
  };

  const insert = (value: string) => {
    const { from, to } = selection();
    apply({ text: text.slice(0, from) + value + text.slice(to), from: from + value.length, to: from + value.length });
  };

  const send = async () => {
    if (busy) return;
    const checked = checkBody(text, false, maxLength);
    if (!checked.ok) {
      setProblem(errorText(checked.error, strings, maxLength));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(checked.value);
      setText('');
      setProblem(null);
    } catch {
      // The caller has reported it; the text stays so nothing is lost.
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void send();
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (event.key === 'Enter' && !event.shiftKey) {
      const continued = continueBullet(text, event.currentTarget.selectionStart);
      if (continued) {
        event.preventDefault();
        apply({ text: continued.text, from: continued.caret, to: continued.caret });
      }
    }
  };

  const over = text.length - maxLength;
  // The toolbar keeps the textarea's selection: pressing it must not move focus.
  const keep = (event: React.MouseEvent) => event.preventDefault();
  const tool = (label: string, icon: React.ReactNode, run: () => void) => (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={label} onMouseDown={keep} onClick={run} disabled={busy}>
        {icon}
      </ActionIcon>
    </Tooltip>
  );

  return (
    <div className="bp-cm-composer">
      <Textarea
        ref={field}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        minRows={3}
        autosize
        maxRows={12}
        disabled={busy}
        error={problem ?? (over > 0 ? formatCount(over, strings.composer.overLimit) : undefined)}
        onChange={(event) => {
          setText(event.currentTarget.value);
          setProblem(null);
        }}
        onKeyDown={onKeyDown}
      />
      <Group justify="space-between" mt={6} wrap="nowrap">
        <Group gap={2} role="toolbar" aria-label={strings.toolbar.label}>
          {tool(strings.toolbar.bold, <IconBold size={16} />, () => mark('**'))}
          {tool(strings.toolbar.italic, <IconItalic size={16} />, () => mark('*'))}
          {tool(strings.toolbar.underline, <IconUnderline size={16} />, () => mark('++'))}
          {tool(strings.toolbar.bulletList, <IconList size={16} />, () => {
            const { from, to } = selection();
            apply(toggleBullets(text, from, to));
          })}
          <EmojiPicker onPick={insert} strings={strings} disabled={busy} />
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" visibleFrom="sm">
            {strings.composer.sendHint}
          </Text>
          {onCancel && (
            <Button variant="subtle" color="gray" size="xs" onClick={onCancel} disabled={busy}>
              {strings.composer.cancel}
            </Button>
          )}
          <Button size="xs" onClick={() => void send()} disabled={busy || over > 0}>
            {busy ? strings.composer.saving : submitLabel}
          </Button>
        </Group>
      </Group>
    </div>
  );
}
