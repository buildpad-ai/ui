'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Text, Textarea, Tooltip } from '@mantine/core';
import { IconBold, IconItalic, IconList, IconUnderline } from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import { EmojiPicker } from './EmojiPicker';
import { MentionPicker } from './MentionPicker';
import { caretOffset } from './core/caret';
import { capMentions, findTrigger, toDisplay, toStored } from './core/mentions';
import { continueBullet, toggleBullets, toggleMark } from './core/richtext';
import { MAX_BODY, type Person } from './core/types';
import { checkBody, type CommentError } from './core/validation';

export interface ComposerProps {
  strings: CommentsTranslations;
  placeholder: string;
  /** Label of the primary button: "Comment", "Reply" or "Save". */
  submitLabel: string;
  /** Sends the stored text (mentions as tokens). Reject to keep the box as it is (the caller reports it). */
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  /** The stored text to start from, when editing (mention tokens are shown as plain `@Name`). */
  initial?: string;
  autoFocus?: boolean;
  maxLength?: number;
  /** People for the @ picker. Leave out and `@` is just text. */
  searchPeople?: (query: string) => Promise<Person[]>;
}

const SEARCH_DELAY = 150;
const LIST_HEIGHT = 210;

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
 * The comment box: a textarea with a formatting toolbar (bold, italic, underline, bullets), an
 * emoji picker and, with `searchPeople`, an @ picker. Ctrl/Cmd+Enter sends, Esc cancels (the first
 * Esc closes an open @ list), Enter inside a bullet continues the list.
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
  searchPeople,
}: ComposerProps) {
  const start = useRef(toDisplay(initial));
  const [text, setText] = useState(start.current.text);
  // Who each `@Name` in the box stands for. The box shows plain names; tokens exist only when sending.
  const [picked, setPicked] = useState<Record<string, string>>(start.current.picked);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<{ from: number; to: number } | null>(null);
  const { formatCount } = useBuildpadI18n();
  const listId = useId();

  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [found, setFound] = useState<{ query: string; people: Person[] } | null>(null);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<React.CSSProperties>({});

  // After the text changes from a toolbar action, put the selection where the action left it.
  useLayoutEffect(() => {
    if (caret.current && field.current) {
      field.current.setSelectionRange(caret.current.from, caret.current.to);
      caret.current = null;
    }
  }, [text]);

  // Search after a short pause. An answer for an older query never replaces a newer one, and the
  // previous list stays up while the next one loads.
  useEffect(() => {
    if (!trigger || !searchPeople) return;
    let current = true;
    const timer = window.setTimeout(() => {
      searchPeople(trigger.query)
        .then((people) => {
          if (current) {
            setFound({ query: trigger.query, people });
            setActive(0);
          }
        })
        .catch(() => {
          if (current) setFound({ query: trigger.query, people: [] });
        });
    }, SEARCH_DELAY);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [trigger, searchPeople]);

  const selection = () => {
    const el = field.current;
    return { from: el?.selectionStart ?? text.length, to: el?.selectionEnd ?? text.length };
  };

  /** Look for `@word` before the caret and float the list under it (above when there is no room below). */
  const watch = (value: string, at: number) => {
    const next = searchPeople ? findTrigger(value, at) : null;
    setTrigger(next);
    const el = field.current;
    if (next && el) {
      const spot = caretOffset(el, next.start);
      const rect = el.getBoundingClientRect();
      const below = window.innerHeight - (rect.top + spot.top + spot.height) > LIST_HEIGHT;
      setPlace({ left: Math.max(0, spot.left), top: below ? spot.top + spot.height + 4 : undefined, bottom: below ? undefined : -spot.top + 4 });
    }
  };

  const apply = (next: { text: string; from: number; to: number }) => {
    caret.current = { from: next.from, to: next.to };
    setText(next.text);
    setProblem(null);
    watch(next.text, next.to);
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

  const choose = (person: Person) => {
    if (!trigger) return;
    const { from } = selection();
    const name = person.name;
    const inserted = `@${name} `;
    setPicked((current) => ({ ...current, [name]: person.id }));
    apply({
      text: text.slice(0, trigger.start) + inserted + text.slice(from),
      from: trigger.start + inserted.length,
      to: trigger.start + inserted.length,
    });
    setTrigger(null);
    setFound(null);
  };

  const send = async () => {
    if (busy) return;
    // Only names still in the box count: a person whose @Name was deleted is no longer picked.
    const stored = capMentions(toStored(text, picked));
    const checked = checkBody(stored, false, maxLength);
    if (!checked.ok) {
      setProblem(errorText(checked.error, strings, maxLength));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(checked.value);
      setText('');
      setPicked({});
      setTrigger(null);
      setProblem(null);
    } catch {
      // The caller has reported it; the text stays so nothing is lost.
    } finally {
      setBusy(false);
    }
  };

  // The previous answer stays up while the next one loads.
  const people = found?.people ?? [];
  const open = !!trigger && !!searchPeople && found !== null;
  const searching = !!trigger && (!found || found.query !== trigger.query);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && people.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + people.length) % people.length);
    } else if (open && people.length > 0 && !event.ctrlKey && !event.metaKey && (event.key === 'Enter' || event.key === 'Tab')) {
      event.preventDefault();
      choose(people[Math.min(active, people.length - 1)]);
    } else if (event.key === 'Escape' && trigger) {
      // The first Esc closes the list only; the next one cancels the box.
      event.preventDefault();
      event.stopPropagation();
      setTrigger(null);
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
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
      <div className="bp-cm-field">
        <Textarea
          ref={field}
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete={searchPeople ? 'list' : undefined}
          aria-controls={open && people.length > 0 ? listId : undefined}
          aria-activedescendant={open && people.length > 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          minRows={3}
          autosize
          maxRows={12}
          disabled={busy}
          error={problem ?? (over > 0 ? formatCount(over, strings.composer.overLimit) : undefined)}
          onChange={(event) => {
            setText(event.currentTarget.value);
            setProblem(null);
            watch(event.currentTarget.value, event.currentTarget.selectionStart);
          }}
          onClick={(event) => watch(text, event.currentTarget.selectionStart)}
          onBlur={() => setTrigger(null)}
          onKeyDown={onKeyDown}
        />
        {open && (
          <MentionPicker
            id={listId}
            people={people}
            active={active}
            query={trigger!.query}
            searching={searching}
            style={place}
            strings={strings}
            onChoose={choose}
            onHover={setActive}
          />
        )}
      </div>
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
