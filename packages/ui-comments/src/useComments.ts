'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentsAdapter } from './CommentsAdapter';
import { toggleLocal } from './core/reactions';
import type { Comment, NewComment } from './core/types';

export type CommentsAction = 'load' | 'save' | 'react' | 'delete';

export interface UseCommentsOptions {
  /** The viewer's display name, for their own chip before the server has answered. */
  meName: string;
  /** Called when a load, save, reaction or delete fails. */
  onError?: (action: CommentsAction, error: unknown) => void;
}

export interface UseCommentsResult {
  comments: Comment[];
  /** True only until the first load finishes: a refetch never brings it back (the list stays on screen). */
  loading: boolean;
  add(input: NewComment): Promise<void>;
  edit(commentId: string, body: string): Promise<void>;
  remove(commentId: string): Promise<void>;
  resolve(commentId: string, resolved: boolean): Promise<void>;
  react(commentId: string, emoji: string, on: boolean): Promise<void>;
  refetch(): Promise<void>;
}

/**
 * The comments of one adapter. Posting, replying and reacting never clear the list: the data on
 * screen is replaced quietly once the server has answered, and cleared only when a different
 * adapter (another record) is given. Reactions change at once and roll back on a failure.
 */
export function useComments(adapter: CommentsAdapter, { meName, onError }: UseCommentsOptions): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const live = useRef(adapter);
  const alive = useRef(true);
  const report = useRef(onError);
  report.current = onError;
  const latest = useRef<Comment[]>([]);
  latest.current = comments;

  const refetch = useCallback(async () => {
    const asked = live.current;
    try {
      const next = await asked.list();
      // An answer for a record that is no longer open must not replace the one that is.
      if (alive.current && live.current === asked) setComments(next);
    } catch (error) {
      report.current?.('load', error);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    live.current = adapter;
    setComments([]);
    setLoading(true);
    void refetch().finally(() => {
      if (alive.current && live.current === adapter) setLoading(false);
    });
    return () => {
      alive.current = false;
    };
  }, [adapter, refetch]);

  /** Run a write, then refetch quietly. A failure is reported and rethrown so the caller keeps its input. */
  const write = useCallback(
    async (action: CommentsAction, run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        report.current?.(action, error);
        throw error;
      }
      await refetch();
    },
    [refetch]
  );

  const add = useCallback((input: NewComment) => write('save', () => adapter.add(input)), [adapter, write]);

  const edit = useCallback(
    (commentId: string, body: string) => write('save', async () => adapter.edit?.(commentId, body)),
    [adapter, write]
  );

  const remove = useCallback(
    (commentId: string) => write('delete', async () => adapter.remove?.(commentId)),
    [adapter, write]
  );

  const resolve = useCallback(
    (commentId: string, resolved: boolean) => write('save', async () => adapter.resolve?.(commentId, resolved)),
    [adapter, write]
  );

  const react = useCallback(
    async (commentId: string, emoji: string, on: boolean) => {
      if (!adapter.react) return;
      // What to put back if the server refuses, read before the chips change.
      const before = latest.current.find((c) => c.id === commentId)?.reactions;
      const set = (reactions: Comment['reactions']) =>
        setComments((current) => current.map((c) => (c.id === commentId ? { ...c, reactions } : c)));
      set(toggleLocal(before, emoji, on, meName));
      try {
        await adapter.react(commentId, emoji, on);
      } catch (error) {
        set(before);
        report.current?.('react', error);
        return;
      }
      await refetch();
    },
    [adapter, meName, refetch]
  );

  return { comments, loading, add, edit, remove, resolve, react, refetch };
}
