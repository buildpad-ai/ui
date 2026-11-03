'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useHotkeys } from '@mantine/hooks';
import { useBuildpadTranslations } from '@buildpad/services';
import type { ChatTranslations, DeepPartial } from '@buildpad/utils';

/** The `chat` strings, with a component's own `translations` prop layered on top. */
export function useChatStrings(translations?: DeepPartial<ChatTranslations>): ChatTranslations {
  return useBuildpadTranslations((dictionary) => dictionary.chat, translations);
}

export interface AiChatContextValue {
  opened: boolean;
  /** The registered shortcut (`mod+I` by default), or null when there is none. */
  hotkey: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

// The chat stays open across reloads within a tab, the way sidebars stay put.
const OPENED_KEY = 'buildpad.ai-chat.opened';

export interface AiChatProviderProps {
  children: ReactNode;
  /** Shortcut that opens and closes the chat; `mod` is ⌘ on macOS, Ctrl elsewhere. `null` turns it off. */
  hotkey?: string | null;
  /** Open on first load. Ignored when the tab already remembers a state. */
  defaultOpened?: boolean;
}

/**
 * Open/closed state shared by `AiChatButton` and `AiChatPanel` (or `AiChatWidget`),
 * which usually live far apart: the button in the header, the panel at the
 * layout's edge. Also registers the keyboard shortcut.
 */
export function AiChatProvider({ children, hotkey = 'mod+I', defaultOpened = false }: AiChatProviderProps) {
  const [opened, setOpened] = useState(defaultOpened);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(OPENED_KEY);
      if (stored !== null) setOpened(stored === '1');
    } catch {
      // Storage can be blocked; the chat keeps its default.
    }
  }, []);

  const setAndRemember = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    setOpened((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      try {
        window.sessionStorage.setItem(OPENED_KEY, value ? '1' : '0');
      } catch {
        // Not remembering is fine.
      }
      return value;
    });
  }, []);

  // Fires from inputs too (Mantine skips them by default), so the shortcut also
  // closes the chat while typing in it.
  useHotkeys(hotkey ? [[hotkey, () => setAndRemember((current) => !current)]] : [], []);

  const value = useMemo<AiChatContextValue>(
    () => ({
      opened,
      hotkey,
      open: () => setAndRemember(true),
      close: () => setAndRemember(false),
      toggle: () => setAndRemember((current) => !current),
    }),
    [opened, hotkey, setAndRemember]
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

/** The shared open/closed state, or null outside an `AiChatProvider`. */
export function useAiChat(): AiChatContextValue | null {
  return useContext(AiChatContext);
}
