'use client';

import { useState } from 'react';
import { Badge, Button, Group, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type CommentsTranslations } from '@buildpad/utils';
import { CommentBody } from './CommentBody';
import { Composer } from './Composer';
import { PhotoStrip } from './PhotoStrip';
import { ReactionBar } from './ReactionBar';
import type { Comment, Person } from './core/types';

export interface CommentMessageProps {
  comment: Comment;
  strings: CommentsTranslations;
  /** True for the first comment of a thread (only that one can be resolved). */
  top: boolean;
  /** The author's name when this reply's parent is not shown, else null. */
  orphanOf?: boolean;
  linked?: boolean;
  isNew?: boolean;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canResolve: boolean;
  onReply: () => void;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
  onReact?: (emoji: string, on: boolean) => void;
  /** The signed-in user's id: a mention of them stands out. */
  meId?: string;
  /** People for the @ picker (also used when editing). */
  searchPeople?: (query: string) => Promise<Person[]>;
  /** Where a stored picture loads from. Leave out and pictures are not shown. */
  photoUrl?: (fileId: string, size: 'thumb' | 'full') => string;
  /** The link for "Copy link", or undefined to hide the button. */
  link?: string;
}

/** "just now", "5 min ago", "yesterday", "3 days ago"; older than a week shows the date. */
export function relativeTime(
  iso: string,
  strings: CommentsTranslations,
  formatCount: (count: number, forms: CommentsTranslations['message']['minutesAgo']) => string,
  now = Date.now()
): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return strings.message.justNow;
  if (minutes < 60) return formatCount(minutes, strings.message.minutesAgo);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatCount(hours, strings.message.hoursAgo);
  const days = Math.floor(hours / 24);
  if (days === 1) return strings.message.yesterday;
  if (days < 8) return formatCount(days, strings.message.daysAgo);
  return new Date(then).toLocaleDateString();
}

/** One comment: who and when, the text, its reactions, and the actions the viewer may take. */
export function CommentMessage({
  comment,
  strings,
  top,
  orphanOf,
  linked,
  isNew,
  canReply,
  canEdit,
  canDelete,
  canResolve,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onReact,
  link,
  meId,
  searchPeople,
  photoUrl,
}: CommentMessageProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const { formatCount } = useBuildpadI18n();
  const name = comment.author?.name ?? strings.message.someone;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: nothing to tell the person that they can act on.
    }
  };

  const action = (label: string, run: () => void, extra?: { color?: string; label?: string }) => (
    <Button
      variant="subtle"
      size="compact-xs"
      color={extra?.color ?? 'gray'}
      onClick={run}
      aria-label={extra?.label}
    >
      {label}
    </Button>
  );

  return (
    <div
      className="bp-cm-msg"
      data-comment-id={comment.id}
      data-linked={linked || undefined}
      data-new={isNew || undefined}
      data-resolved={comment.resolved || undefined}
    >
      {orphanOf && (
        <Text size="xs" c="dimmed" mb={2}>
          {strings.message.replyingToUnknown}
        </Text>
      )}
      <Group gap="xs" className="bp-cm-meta" wrap="wrap">
        <Text size="sm" fw={600}>
          {name}
        </Text>
        {isNew && (
          <Badge size="xs" variant="light">
            {strings.message.new}
          </Badge>
        )}
        <Text size="xs" c="dimmed" component="time" dateTime={comment.createdAt} title={comment.createdAt}>
          {relativeTime(comment.createdAt, strings, formatCount)}
        </Text>
        {comment.resolved && (
          <Badge size="xs" color="green" variant="light" leftSection={<IconCheck size={10} />}>
            {strings.message.resolved}
          </Badge>
        )}
      </Group>

      {editing ? (
        <Composer
          strings={strings}
          placeholder={strings.composer.placeholder}
          submitLabel={strings.composer.save}
          initial={comment.body}
          searchPeople={searchPeople}
          autoFocus
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            if (body !== comment.body.trim()) await onEdit(body);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <CommentBody body={comment.body} meId={meId} />
          {photoUrl && comment.photos && <PhotoStrip photos={comment.photos} url={photoUrl} strings={strings} />}
          <ReactionBar chips={comment.reactions ?? []} onToggle={onReact} strings={strings} />
          <Group gap={2} mt={4} className="bp-cm-actions">
            {canReply &&
              action(strings.message.reply, onReply, {
                label: interpolate(strings.message.replyTo, { name }),
              })}
            {link && action(copied ? strings.message.linkCopied : strings.message.copyLink, () => void copy())}
            {canEdit && action(strings.message.edit, () => setEditing(true))}
            {canResolve && top &&
              action(comment.resolved ? strings.message.reopen : strings.message.resolve, () =>
                void onResolve(!comment.resolved)
              )}
            {canDelete && !confirming && action(strings.message.delete, () => setConfirming(true), { color: 'red' })}
          </Group>
          {confirming && (
            <Group gap="xs" mt={4} role="alertdialog" aria-label={strings.message.deleteConfirm}>
              <Text size="xs">{strings.message.deleteConfirm}</Text>
              <Button
                size="compact-xs"
                color="red"
                onClick={() => {
                  setConfirming(false);
                  void onDelete();
                }}
              >
                {strings.message.delete}
              </Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setConfirming(false)}>
                {strings.composer.cancel}
              </Button>
            </Group>
          )}
        </>
      )}
    </div>
  );
}
