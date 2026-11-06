'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Text, Textarea, Tooltip, VisuallyHidden } from '@mantine/core';
import { IconBold, IconItalic, IconList, IconPhoto, IconUnderline } from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import { EmojiPicker } from './EmojiPicker';
import { MentionPicker } from './MentionPicker';
import { PhotoStrip } from './PhotoStrip';
import { caretOffset } from './core/caret';
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, checkImage, nameFor, pictureFiles } from './core/images';
import { capMentions, findTrigger, toDisplay, toStored } from './core/mentions';
import { continueBullet, toggleBullets, toggleMark } from './core/richtext';
import { MAX_BODY, MAX_PHOTOS, type Person } from './core/types';
import { checkBody, type CommentError } from './core/validation';

export interface ComposerProps {
  strings: CommentsTranslations;
  placeholder: string;
  /** Label of the primary button: "Comment", "Reply" or "Save". */
  submitLabel: string;
  /** Sends the stored text (mentions as tokens). Reject to keep the box as it is (the caller reports it). */
  onSubmit: (body: string, photos: string[]) => Promise<void>;
  onCancel?: () => void;
  /** The stored text to start from, when editing (mention tokens are shown as plain `@Name`). */
  initial?: string;
  autoFocus?: boolean;
  maxLength?: number;
  /** People for the @ picker. Leave out and `@` is just text. */
  searchPeople?: (query: string) => Promise<Person[]>;
  /** Uploads one picture and returns its file id. Leave out and there is no picture button and no paste. */
  uploadImage?: (file: File) => Promise<string>;
  /** Where a stored picture loads from (needed with `uploadImage`, to show thumbnails). */
  photoUrl?: (fileId: string, size: 'thumb' | 'full') => string;
  /** Most pictures per comment. */
  maxPhotos?: number;
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
  uploadImage,
  photoUrl,
  maxPhotos = MAX_PHOTOS,
}: ComposerProps) {
  const start = useRef(toDisplay(initial));
  // Pictures attached so far (file ids) and how many are still uploading.
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const filePicker = useRef<HTMLInputElement>(null);
  // Counted in a ref as well: a paste of several pictures must not outrun the state.
  const slots = useRef(0);
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

  /** Upload each picture, up to the limit. A refused or failed one says why and the others carry on. */
  const attach = (files: File[]) => {
    if (!uploadImage || files.length === 0) return;
    // Clear the old message once for the whole batch; a refusal below then stays on screen even
    // though the next, valid file in the same choice still uploads.
    setProblem(null);
    for (const original of files) {
      if (slots.current >= maxPhotos) {
        setProblem(strings.errors.tooManyPhotos);
        return;
      }
      const refused = checkImage(original);
      if (refused) {
        setProblem(
          refused === 'not-image'
            ? strings.errors.notImage
            : interpolate(strings.errors.tooBig, { max: `${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB` })
        );
        continue;
      }
      slots.current++;
      setUploading((count) => count + 1);
      uploadImage(nameFor(original))
        .then((id) => setPhotos((current) => (current.includes(id) ? current : [...current, id])))
        .catch(() => {
          slots.current--;
          setProblem(strings.errors.uploadFailed);
        })
        .finally(() => setUploading((count) => count - 1));
    }
  };

  const removePhoto = (id: string) => {
    slots.current--;
    setPhotos((current) => current.filter((item) => item !== id));
  };

  const send = async () => {
    if (busy || uploading > 0) return;
    // Only names still in the box count: a person whose @Name was deleted is no longer picked.
    const stored = capMentions(toStored(text, picked));
    const checked = checkBody(stored, photos.length > 0, maxLength);
    if (!checked.ok) {
      setProblem(errorText(checked.error, strings, maxLength));
      return;
    }
    setBusy(true);
    try {
      await onSubmit(checked.value, photos);
      setText('');
      setPicked({});
      setPhotos([]);
      slots.current = 0;
      setTrigger(null);
      setProblem(null);
    } catch {
      // The caller has reported it; the text stays so nothing is lost.
    } finally {
      setBusy(false);
      // Send disables itself while saving, which drops focus to the page. Bring it back to the box
      // (a box that closes on success, like a reply, is gone by now and this does nothing).
      if (!document.activeElement || document.activeElement === document.body) field.current?.focus();
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
    <div
      className="bp-cm-composer"
      // In the capture phase, so a paste works whether the textarea or the toolbar has focus. Only a
      // clipboard that really holds a picture is taken over: a plain-text paste is left alone.
      onPasteCapture={(event) => {
        if (!uploadImage) return;
        const files = pictureFiles(event.clipboardData?.items);
        if (files.length === 0) return;
        event.preventDefault();
        attach(files);
      }}
    >
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
          // Read-only while saving, not disabled: disabling the focused field drops focus to the page.
          readOnly={busy}
          error={problem ?? (over > 0 ? formatCount(over, strings.composer.overLimit) : undefined)}
          // A problem comes from an action (a refused or failed upload, an empty send), not from
          // typing, so it is announced. The over-limit count is not: it changes on every keystroke.
          errorProps={problem ? { role: 'alert' } : undefined}
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
      {photoUrl && (
        <PhotoStrip photos={photos} url={photoUrl} strings={strings} onRemove={removePhoto} pending={uploading} />
      )}
      {/* Send waits while a picture uploads; say so, or the disabled button is a mystery. */}
      <VisuallyHidden role="status">{uploading > 0 ? strings.images.uploading : ''}</VisuallyHidden>
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
          {uploadImage && (
            <>
              {tool(strings.images.attach, <IconPhoto size={16} />, () => filePicker.current?.click())}
              <input
                ref={filePicker}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                hidden
                aria-label={strings.images.attach}
                data-testid="bp-cm-file-input"
                onChange={(event) => {
                  attach(Array.from(event.currentTarget.files ?? []));
                  // So choosing the same file again fires a change.
                  event.currentTarget.value = '';
                }}
              />
            </>
          )}
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
          <Button size="xs" onClick={() => void send()} disabled={busy || uploading > 0 || over > 0}>
            {busy ? strings.composer.saving : submitLabel}
          </Button>
        </Group>
      </Group>
    </div>
  );
}
