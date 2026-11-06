'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Group, Loader, Text } from '@mantine/core';
import { useBuildpadI18n } from '@buildpad/services';
import type { CommentsTranslations, DeepPartial } from '@buildpad/utils';
import './Comments.css';
import type { CommentsAdapter } from './CommentsAdapter';
import { CommentMessage } from './CommentMessage';
import { Composer } from './Composer';
import { buildThreads, indentFor } from './core/thread';
import type { ThreadNode } from './core/types';
import { useComments, type CommentsAction } from './useComments';
import { useCommentsStrings } from './useCommentsStrings';

export interface CommentsKitProps {
  adapter: CommentsAdapter;
  /** The signed-in user. Their comments can be edited, and their name shows on their own reactions. */
  meId: string;
  meName: string;
  /** May start threads and reply. False for a read-only viewer: the list and the chips stay. */
  canComment?: boolean;
  /** May delete and resolve anyone's comment. */
  canModerate?: boolean;
  /** Scroll to and highlight this comment (from a `?comment=` link). */
  focusId?: string | null;
  /** Comments to mark "New". */
  newIds?: ReadonlySet<string> | readonly string[];
  /** Replaces the heading. */
  title?: string;
  /** Called after a failure, besides the message the kit shows. */
  onError?: (action: CommentsAction, error: unknown) => void;
  translations?: DeepPartial<CommentsTranslations>;
}

/**
 * Comments for one record: threads with replies at any depth, a comment box with formatting and
 * emoji, and one-click reactions. What it can do depends on the adapter it is given: no `react`
 * means read-only chips, no `edit`/`remove`/`resolve` means those buttons are not shown.
 */
export function CommentsKit({
  adapter,
  meId,
  meName,
  canComment = true,
  canModerate = false,
  focusId,
  newIds,
  title,
  onError,
  translations,
}: CommentsKitProps) {
  const strings = useCommentsStrings(translations);
  const { formatCount } = useBuildpadI18n();
  const [problem, setProblem] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { comments, loading, add, edit, remove, resolve, react } = useComments(adapter, {
    meName,
    onError: (action, error) => {
      setProblem(
        action === 'load'
          ? strings.errors.loadFailed
          : action === 'react'
            ? strings.errors.reactFailed
            : action === 'delete'
              ? strings.errors.deleteFailed
              : strings.errors.saveFailed
      );
      onError?.(action, error);
    },
  });

  const threads = useMemo(() => buildThreads(comments), [comments]);
  const fresh = useMemo(() => new Set(newIds ?? []), [newIds]);
  const me = meId.toLowerCase();
  const mine = (authorId?: string | null) => !!authorId && authorId.toLowerCase() === me;

  // A link to a comment scrolls to it once it is on screen.
  const root = useRef<HTMLElement>(null);
  const scrolled = useRef<string | null>(null);
  useEffect(() => {
    if (!focusId || loading || scrolled.current === focusId) return;
    const target = root.current?.querySelector(`[data-comment-id="${CSS.escape(focusId)}"]`);
    if (target) {
      scrolled.current = focusId;
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [focusId, loading, comments]);

  const guarded = (run: () => Promise<void>) => async () => {
    try {
      setProblem(null);
      await run();
    } catch {
      // useComments has reported it (the message is shown above the list).
    }
  };

  const renderNode = (node: ThreadNode): React.ReactNode => {
    const { comment } = node;
    const top = node.depth === 0;
    const authored = mine(comment.author?.id);
    return (
      <li key={comment.id} className="bp-cm-item" style={{ marginInlineStart: indentFor(node.depth) }}>
        <CommentMessage
          comment={comment}
          strings={strings}
          top={top}
          orphanOf={node.orphan}
          linked={focusId === comment.id}
          isNew={fresh.has(comment.id)}
          canReply={canComment}
          canEdit={!!adapter.edit && authored}
          canDelete={!!adapter.remove && (authored || canModerate)}
          canResolve={!!adapter.resolve && (authored || canModerate)}
          link={adapter.linkFor?.(comment.id)}
          onReply={() => setReplyTo((open) => (open === comment.id ? null : comment.id))}
          onEdit={(body) => edit(comment.id, body)}
          onDelete={guarded(() => remove(comment.id))}
          onResolve={(resolved) => guarded(() => resolve(comment.id, resolved))()}
          onReact={adapter.react && canComment ? (emoji, on) => void react(comment.id, emoji, on) : undefined}
        />
        {replyTo === comment.id && (
          <div className="bp-cm-reply-box" style={{ marginInlineStart: indentFor(node.depth + 1) }}>
            <Composer
              strings={strings}
              placeholder={strings.composer.replyPlaceholder}
              submitLabel={strings.composer.reply}
              autoFocus
              onCancel={() => setReplyTo(null)}
              onSubmit={async (body) => {
                await add({ body, parent: comment.id });
                setReplyTo(null);
              }}
            />
          </div>
        )}
        {node.children.length > 0 && <ul className="bp-cm-list">{node.children.map(renderNode)}</ul>}
      </li>
    );
  };

  const total = comments.length;

  return (
    <section ref={root} className="bp-cm" aria-label={title ?? strings.title}>
      <Group gap="xs" mb="sm">
        <Text fw={600}>{title ?? strings.title}</Text>
        {total > 0 && (
          <Badge variant="light" color="gray" size="sm">
            {formatCount(total, strings.count)}
          </Badge>
        )}
      </Group>

      {problem && (
        <Alert color="red" variant="light" mb="sm" withCloseButton onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      {loading ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : threads.length === 0 ? (
        <Text size="sm" c="dimmed" mb="sm">
          {canComment ? strings.empty.canWrite : strings.empty.readOnly}
        </Text>
      ) : (
        <ul className="bp-cm-list bp-cm-list--root">{threads.map(renderNode)}</ul>
      )}

      {canComment && (
        <div className="bp-cm-new">
          <Composer
            strings={strings}
            placeholder={strings.composer.placeholder}
            submitLabel={strings.composer.submit}
            onSubmit={async (body) => {
              setProblem(null);
              await add({ body });
            }}
          />
        </div>
      )}
    </section>
  );
}
