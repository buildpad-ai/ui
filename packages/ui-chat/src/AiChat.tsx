'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useChat } from '@ai-sdk/react';
import type { ChatTransport, UIMessage } from 'ai';
import { useStickToBottom } from 'use-stick-to-bottom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Kbd,
  Loader,
  Popover,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconHistory,
  IconMessagePlus,
  IconPaperclip,
  IconPencil,
  IconPlayerStopFilled,
  IconRefresh,
  IconScreenshot,
  IconSparkles,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useBuildpadI18n } from '@buildpad/services';
import { interpolate, type ChatTranslations, type DeepPartial } from '@buildpad/utils';
import { IMAGE_TYPES, MAX_ATTACHMENTS, type ImagePart } from './attachments';
import type { AiChatBackend, AiChatBackendHandlers } from './backends';
import { annotateImage, AttachmentError, imagePartFromFile, takeScreenshot } from './capture';
import { useChatStrings } from './AiChatProvider';
import { AiChatMessage, isWorking, messageText, WorkingWord } from './AiChatMessage';
import type { LinkTarget } from './AiChatMarkdown';
import {
  deleteTranscript,
  forgetChat,
  loadChatMemory,
  loadTranscript,
  rememberChat,
  saveChatMemory,
  saveTranscript,
  type ChatMemory,
} from './storage';
import './AiChat.css';

/** Longest question the chat sends. */
export const MAX_MESSAGE_CHARS = 8000;

export interface AiChatFeatures {
  /** Paper clip, paste and drag-and-drop images. Default true. */
  attachments?: boolean;
  /** Take a screenshot of the page and draw on it. Default true. */
  screenshot?: boolean;
  /** The recent chats list. Default true. */
  recentChats?: boolean;
}

/** Props shared by `AiChat`, `AiChatPanel` and `AiChatWidget`. */
export interface AiChatProps {
  /** How the chat reaches its agent: `chocolateFactoryBackend(config)` or `routeBackend()`. */
  backend: AiChatBackend;
  /** Header title. Default "Assistant". */
  title?: string;
  /** A small badge beside the title, e.g. "Beta". */
  badge?: string;
  /** Empty-state heading. Default "How can I help?". */
  greeting?: string;
  /** Empty-state text under the heading. */
  description?: string;
  /** Starter questions shown while the chat is empty. */
  suggestions?: string[];
  /** Question box placeholder. */
  placeholder?: string;
  /** Line under the question box. Default "AI answers can be wrong. Check anything important." */
  disclaimer?: string;
  /** Template variables for the agent's prompt (page, user, …), sent with every message. */
  vars?: Record<string, unknown> | (() => Record<string, unknown> | undefined);
  /** Shown above the question box, e.g. a chip saying which page is shared. */
  context?: ReactNode;
  features?: AiChatFeatures;
  /** Scopes the recent chats kept in local storage; pass the signed-in user's id. Default "default". */
  storageKey?: string;
  /** Where an answer's link opens. Default: this app's pages in place, others in a new tab. */
  linkTarget?: (href: string) => LinkTarget;
  /** Client-side navigation for links that open in place, e.g. Next.js `router.push`. */
  onNavigate?: (href: string) => void;
  /** Hosts an answer may show images from; images from anywhere else show their alt text. */
  imageHosts?: string[];
  /** Per-instance strings; app-wide ones come from `BuildpadI18nProvider`. */
  translations?: DeepPartial<ChatTranslations>;
  /** Called with a failed request's error. Default `console.error`. */
  onError?: (error: Error) => void;
}

export interface AiChatViewProps extends AiChatProps {
  /** Whether the chat is on screen: it focuses the question box and loads the open conversation then. */
  active?: boolean;
  /** Shows a close button and closes on Escape. */
  onClose?: () => void;
}

/** Readable text for a failed request: plain sentences are shown as they are (the proxy route writes them). */
function errorText(error: Error, t: ChatTranslations): string {
  const message = error.message?.trim() ?? '';
  if (!message || message.length > 300 || message.startsWith('<') || message.startsWith('{')) return t.error.generic;
  return message;
}

const EMPTY_MEMORY: ChatMemory = { current: null, recent: [] };
const NO_HOSTS: string[] = [];

function newChatId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The chat itself: header, thread and question box. `AiChatPanel` and
 * `AiChatWidget` wrap it in a docked panel or a floating window; use it directly
 * to build another shell.
 */
export function AiChat({
  backend,
  title,
  badge,
  greeting,
  description,
  suggestions = [],
  placeholder,
  disclaimer,
  vars,
  context,
  features,
  storageKey = 'default',
  linkTarget,
  onNavigate,
  imageHosts = NO_HOSTS,
  translations,
  onError,
  active = true,
  onClose,
}: AiChatViewProps) {
  const t = useChatStrings(translations);
  const { formatCount } = useBuildpadI18n();
  const allowAttachments = features?.attachments !== false;
  const allowScreenshot = features?.screenshot !== false;
  const showRecent = features?.recentChats !== false;

  const [memory, setMemory] = useState<ChatMemory>(EMPTY_MEMORY);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [attachments, setAttachments] = useState<ImagePart[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  // Read by the transport, which useChat keeps from its first render.
  const backendRef = useRef(backend);
  backendRef.current = backend;
  const varsRef = useRef(vars);
  varsRef.current = vars;
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const conversationRef = useRef<string | null>(null);
  const firstQuestionRef = useRef('');
  const historyLoadedRef = useRef(false);

  const updateMemory = useCallback((update: (current: ChatMemory) => ChatMemory) => {
    setMemory((current) => {
      const next = update(current);
      saveChatMemory(storageKeyRef.current, next);
      return next;
    });
  }, []);

  /** Puts the open chat at the top of the recent list, keeping its title once it has one. */
  const rememberCurrent = useCallback(
    (id: string) => {
      updateMemory((current) => {
        const title = current.recent.find((item) => item.id === id)?.title ?? (firstQuestionRef.current.slice(0, 80) || t.title);
        const { memory: next, evicted } = rememberChat(current, { id, title, at: Date.now() });
        if (backendRef.current.history === 'client') evicted.forEach((old) => deleteTranscript(storageKeyRef.current, old));
        return next;
      });
    },
    [updateMemory, t.title]
  );
  const rememberCurrentRef = useRef(rememberCurrent);
  rememberCurrentRef.current = rememberCurrent;

  // One transport for the chat's life that hands each request to the current
  // backend, so an app can rebuild its backend object on every render.
  const transport = useMemo<ChatTransport<UIMessage>>(() => {
    const handlers: AiChatBackendHandlers = {
      getConversation: () => conversationRef.current,
      onConversation: (id) => {
        conversationRef.current = id;
        rememberCurrentRef.current(id);
      },
      getVars: () => {
        const current = varsRef.current;
        return typeof current === 'function' ? current() : current;
      },
    };
    return {
      sendMessages: (options) => backendRef.current.createTransport(handlers).sendMessages(options),
      reconnectToStream: (options) => backendRef.current.createTransport(handlers).reconnectToStream(options),
    };
  }, []);

  const { messages, sendMessage, setMessages, status, stop, error, regenerate, clearError } = useChat({
    transport,
    experimental_throttle: 50,
    // The chat shows a friendly message; keep the real cause findable.
    onError: (chatError) => (onErrorRef.current ?? console.error)(chatError),
  });
  const busy = status === 'submitted' || status === 'streaming';

  // Recall the open conversation for this storage key.
  useEffect(() => {
    const stored = loadChatMemory(storageKey);
    setMemory(stored);
    conversationRef.current = stored.current;
    historyLoadedRef.current = false;
  }, [storageKey]);

  // A browser-kept transcript is saved whenever an answer finishes.
  useEffect(() => {
    if (status !== 'ready' || backend.history !== 'client' || !conversationRef.current || !messages.length) return;
    saveTranscript(storageKey, conversationRef.current, messages);
  }, [status, messages, backend.history, storageKey]);

  const loadConversation = useCallback(
    async (id: string) => {
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        const current = backendRef.current;
        const stored =
          current.history === 'client'
            ? loadTranscript(storageKeyRef.current, id)
            : current.loadConversation
              ? await current.loadConversation(id)
              : null;
        if (stored === null) {
          // Expired or deleted: forget it and start fresh.
          updateMemory((memoryNow) => forgetChat(memoryNow, id));
          if (conversationRef.current === id) conversationRef.current = null;
          setMessages([]);
          setHistoryError(t.empty.historyGone);
          return;
        }
        if (conversationRef.current === id) setMessages(stored);
      } catch (problem) {
        (onErrorRef.current ?? console.error)(problem instanceof Error ? problem : new Error(String(problem)));
        setHistoryError(t.empty.historyFailed);
      } finally {
        setLoadingHistory(false);
      }
    },
    [setMessages, updateMemory, t.empty.historyGone, t.empty.historyFailed]
  );

  // Load the open conversation the first time the chat is shown, not on every page load.
  useEffect(() => {
    if (!active || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    if (conversationRef.current && messages.length === 0) void loadConversation(conversationRef.current);
  }, [active, messages.length, loadConversation]);

  /** Sends a question with any attached images; false when there is nothing to send yet. */
  const send = useCallback(
    (text: string, files: ImagePart[] = []) => {
      const question = text.trim();
      if ((!question && !files.length) || busy || question.length > MAX_MESSAGE_CHARS) return false;
      if (messages.length === 0) firstQuestionRef.current = question || files[0].filename || t.message.image;
      // A browser-kept chat gets its id now; a server backend reports its own after the first answer starts.
      if (backendRef.current.history === 'client') {
        if (!conversationRef.current) conversationRef.current = newChatId();
        rememberCurrent(conversationRef.current);
      }
      setHistoryError(null);
      clearError();
      void sendMessage(!files.length ? { text: question } : question ? { text: question, files } : { files });
      setAttachments([]);
      setAttachError(null);
      return true;
    },
    [busy, messages.length, sendMessage, clearError, rememberCurrent, t.message.image]
  );

  const tooManyText = formatCount(MAX_ATTACHMENTS, t.attachment.tooMany);

  const addImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith('image/'));
      if (!images.length) {
        if (files.length) setAttachError(t.attachment.onlyImages);
        return;
      }
      const room = MAX_ATTACHMENTS - attachmentsRef.current.length;
      if (room <= 0) {
        setAttachError(tooManyText);
        return;
      }
      setPreparing(true);
      const parts: ImagePart[] = [];
      const problems: string[] = [];
      for (const file of images.slice(0, room)) {
        try {
          parts.push(await imagePartFromFile(file, file.name || `${t.attachment.pastedImage}.png`, t));
        } catch (problem) {
          problems.push(
            problem instanceof AttachmentError ? problem.message : interpolate(t.attachment.couldNotAttach, { name: file.name || t.message.image })
          );
        }
      }
      if (images.length > room) problems.push(tooManyText);
      setAttachments((current) => [...current, ...parts].slice(0, MAX_ATTACHMENTS));
      setAttachError(problems[0] ?? null);
      setPreparing(false);
      textareaRef.current?.focus();
    },
    [t, tooManyText]
  );

  const onTakeScreenshot = useCallback(async () => {
    if (attachmentsRef.current.length >= MAX_ATTACHMENTS) {
      setAttachError(tooManyText);
      return;
    }
    setAttachError(null);
    setPreparing(true);
    const root = document.documentElement;
    try {
      // The attribute hides every chat shell at once, so it's neither in the shot nor in the way.
      const shot = await takeScreenshot(() => {
        root.setAttribute('data-ai-chat-capturing', '');
        return () => root.removeAttribute('data-ai-chat-capturing');
      }, t);
      if (shot) setAttachments((current) => [...current, shot].slice(0, MAX_ATTACHMENTS));
    } catch (problem) {
      setAttachError(problem instanceof AttachmentError ? problem.message : t.attachment.screenshotFailed);
    } finally {
      setPreparing(false);
      textareaRef.current?.focus();
    }
  }, [t, tooManyText]);

  const annotateAttachment = async (index: number) => {
    const part = attachmentsRef.current[index];
    if (!part) return;
    setAttachError(null);
    setPreparing(true);
    try {
      const annotated = await annotateImage(part, t);
      if (annotated) setAttachments((current) => current.map((item) => (item === part ? annotated : item)));
    } catch (problem) {
      setAttachError(problem instanceof AttachmentError ? problem.message : t.attachment.annotateFailed);
    } finally {
      setPreparing(false);
      textareaRef.current?.focus();
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, at) => at !== index));
    setAttachError(null);
    textareaRef.current?.focus();
  };

  // Focus the question box when shown; when hidden, hand focus back to whatever opened the chat.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) {
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected && (document.activeElement === document.body || !document.activeElement)) target.focus();
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 160);
    return () => window.clearTimeout(timer);
  }, [active]);

  const resetChat = useCallback(() => {
    void stop();
    setMessages([]);
    clearError();
    setHistoryError(null);
    conversationRef.current = null;
    firstQuestionRef.current = '';
  }, [stop, setMessages, clearError]);

  const startNewChat = useCallback(() => {
    resetChat();
    updateMemory((current) => ({ ...current, current: null }));
    textareaRef.current?.focus();
  }, [resetChat, updateMemory]);

  const removeChat = useCallback(
    (id: string) => {
      // Keep keyboard users in the list: focus the next row (or the previous one at the end).
      const index = memory.recent.findIndex((item) => item.id === id);
      const neighbour = memory.recent[index + 1] ?? memory.recent[index - 1];
      if (id === conversationRef.current) resetChat();
      if (backendRef.current.history === 'client') deleteTranscript(storageKeyRef.current, id);
      updateMemory((current) => forgetChat(current, id));
      window.requestAnimationFrame(() => {
        const next = neighbour && document.querySelector<HTMLElement>(`[data-ai-chat-recent="${CSS.escape(neighbour.id)}"]`);
        if (next) next.focus();
        else setRecentOpen(false);
      });
    },
    [memory.recent, resetChat, updateMemory]
  );

  const openChat = useCallback(
    (id: string) => {
      if (id === conversationRef.current && messages.length) return;
      void stop();
      clearError();
      conversationRef.current = id;
      firstQuestionRef.current = '';
      updateMemory((current) => ({ ...current, current: id }));
      setMessages([]);
      void loadConversation(id);
    },
    [messages.length, stop, clearError, updateMemory, setMessages, loadConversation]
  );

  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({ initial: 'instant', resize: 'smooth' });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || preparing) return;
    if (send(input, attachments)) setInput('');
  };

  // A pasted screenshot is attached; text copied along with an image still pastes as text.
  const onComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allowAttachments) return;
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    if (!event.clipboardData.getData('text/plain')) event.preventDefault();
    void addImages(images);
  };

  const draggingFiles = (event: DragEvent) => allowAttachments && event.dataTransfer.types.includes('Files');
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };
  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    setDragging(false);
    void addImages(Array.from(event.dataTransfer.files));
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit(event);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    // Escape inside the recent-chats popover (portalled, but bubbling here through
    // React) only closes the popover.
    if (!onClose || event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
    onClose();
  };

  const relativeTime = (at: number): string => {
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return t.recent.justNow;
    if (minutes < 60) return formatCount(minutes, t.recent.minutesAgo);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return formatCount(hours, t.recent.hoursAgo);
    const days = Math.round(hours / 24);
    return days === 1 ? t.recent.yesterday : formatCount(days, t.recent.daysAgo);
  };

  const lastMessage = messages[messages.length - 1];
  // One working word from sending until the answer itself streams.
  const working = status === 'submitted' || (status === 'streaming' && isWorking(lastMessage));
  const overLimit = input.length > MAX_MESSAGE_CHARS;
  const canSend = (!!input.trim() || attachments.length > 0) && !overLimit && !preparing;
  const attachmentsFull = attachments.length >= MAX_ATTACHMENTS;

  return (
    <section
      className="bp-ai-chat"
      aria-label={title ?? t.panelLabel}
      onKeyDown={onKeyDown}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="bp-ai-chat-drop-overlay" aria-hidden>
          <IconPaperclip size={22} />
          <Text size="sm" fw={500}>
            {t.composer.dropImages}
          </Text>
        </div>
      )}
      <header className="bp-ai-chat-header">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <span className="bp-ai-chat-mark">
            <IconSparkles size={16} />
          </span>
          <Text fw={600} size="sm" truncate>
            {title ?? t.title}
          </Text>
          {badge && (
            <Badge size="xs" variant="light" color="gray">
              {badge}
            </Badge>
          )}
        </Group>
        <Group gap={2} wrap="nowrap">
          <Tooltip label={t.header.newChat} withArrow>
            <ActionIcon variant="subtle" color="gray" onClick={startNewChat} aria-label={t.header.newChat} disabled={!messages.length && !error}>
              <IconMessagePlus size={18} />
            </ActionIcon>
          </Tooltip>
          {showRecent && (
            <Popover position="bottom-end" width={300} shadow="md" withinPortal opened={recentOpen} onChange={setRecentOpen}>
              <Popover.Target>
                <Tooltip label={t.header.recentChats} withArrow disabled={recentOpen}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={t.header.recentChats}
                    aria-expanded={recentOpen}
                    // A controlled popover's target doesn't toggle it by itself.
                    onClick={() => setRecentOpen((value) => !value)}
                  >
                    <IconHistory size={18} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown p={4}>
                <Text size="xs" fw={500} c="dimmed" px={8} pt={4} pb={6}>
                  {t.header.recentChats}
                </Text>
                {memory.recent.length === 0 ? (
                  <Text size="xs" c="dimmed" px={8} pb={6}>
                    {t.recent.empty}
                  </Text>
                ) : (
                  <ul className="bp-ai-chat-recent-list">
                    {memory.recent.map((item) => {
                      const isCurrent = item.id === memory.current;
                      return (
                        <li key={item.id} className="bp-ai-chat-recent-row" data-current={isCurrent || undefined}>
                          <UnstyledButton
                            className="bp-ai-chat-recent-open"
                            data-ai-chat-recent={item.id}
                            aria-current={isCurrent ? 'true' : undefined}
                            onClick={() => {
                              setRecentOpen(false);
                              openChat(item.id);
                            }}
                          >
                            <Text size="sm" truncate fw={isCurrent ? 600 : undefined}>
                              {item.title}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {relativeTime(item.at)}
                            </Text>
                          </UnstyledButton>
                          <Tooltip label={t.recent.removeFromList} withArrow position="left">
                            <ActionIcon
                              className="bp-ai-chat-recent-remove"
                              variant="subtle"
                              color="gray"
                              size="sm"
                              aria-label={interpolate(t.recent.removeLabel, { title: item.title })}
                              onClick={() => removeChat(item.id)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {memory.recent.length > 0 && backend.history === 'server' && (
                  <Text size="xs" c="dimmed" px={8} pt={6} pb={4} className="bp-ai-chat-recent-note">
                    {t.recent.note}
                  </Text>
                )}
              </Popover.Dropdown>
            </Popover>
          )}
          {onClose && (
            <Tooltip
              label={
                <Group gap={6} wrap="nowrap">
                  <span>{t.header.close}</span>
                  <Kbd size="xs">{t.header.escapeKey}</Kbd>
                </Group>
              }
              withArrow
            >
              <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label={t.header.closeLabel}>
                <IconX size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </header>

      <div className="bp-ai-chat-scroll" ref={scrollRef}>
        <div className="bp-ai-chat-thread" ref={contentRef} role="log" aria-busy={busy || loadingHistory}>
          {loadingHistory && (
            <Group justify="center" py="xl">
              <Loader size="sm" />
            </Group>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="bp-ai-chat-empty">
              <span className="bp-ai-chat-mark" data-size="lg">
                <IconSparkles size={22} />
              </span>
              <Text fw={600} size="lg" mt="sm">
                {greeting ?? t.empty.greeting}
              </Text>
              {description && (
                <Text size="sm" c="dimmed" mt={4} maw={300} ta="center">
                  {description}
                </Text>
              )}
              {historyError && (
                <Text size="xs" c="dimmed" mt="sm">
                  {historyError}
                </Text>
              )}
              {suggestions.length > 0 && (
                <div className="bp-ai-chat-suggestions">
                  {suggestions.map((question) => (
                    <UnstyledButton key={question} className="bp-ai-chat-suggestion" onClick={() => send(question, attachments)}>
                      {question}
                    </UnstyledButton>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <AiChatMessage
              key={message.id}
              message={message}
              streaming={status === 'streaming' && index === messages.length - 1}
              t={t}
              linkTarget={linkTarget}
              onNavigate={onNavigate}
              imageHosts={imageHosts}
            />
          ))}

          {working && <WorkingWord t={t} />}

          {error && (
            <Alert color="red" variant="light" mt="xs" title={t.error.title}>
              <Text size="sm">{errorText(error, t)}</Text>
              <Button
                size="xs"
                variant="light"
                color="red"
                mt="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                {t.error.tryAgain}
              </Button>
            </Alert>
          )}
        </div>
      </div>

      {!isAtBottom && messages.length > 0 && (
        <ActionIcon className="bp-ai-chat-jump" variant="default" radius="xl" size="lg" onClick={() => scrollToBottom()} aria-label={t.jumpToLatest}>
          <IconArrowDown size={16} />
        </ActionIcon>
      )}

      <form className="bp-ai-chat-composer" onSubmit={onSubmit}>
        {context && <div className="bp-ai-chat-context">{context}</div>}

        <div className="bp-ai-chat-input-box" data-error={overLimit || undefined}>
          {(attachments.length > 0 || preparing) && (
            <ul className="bp-ai-chat-attachments" aria-label={t.composer.attachedImages}>
              {attachments.map((part, index) => {
                const name = part.filename ?? t.message.image;
                return (
                  <li key={`${index}-${part.url.length}`} className="bp-ai-chat-attachment">
                    <img src={part.url} alt={name} title={part.filename} />
                    <UnstyledButton
                      className="bp-ai-chat-attachment-annotate"
                      onClick={() => void annotateAttachment(index)}
                      disabled={preparing}
                      aria-label={interpolate(t.composer.annotateLabel, { name })}
                      title={t.composer.annotate}
                    >
                      <IconPencil size={11} />
                    </UnstyledButton>
                    <UnstyledButton
                      className="bp-ai-chat-attachment-remove"
                      onClick={() => removeAttachment(index)}
                      aria-label={interpolate(t.composer.removeImageLabel, { name })}
                    >
                      <IconX size={12} />
                    </UnstyledButton>
                  </li>
                );
              })}
              {preparing && (
                <li className="bp-ai-chat-attachment" data-loading>
                  <Loader size="xs" />
                </li>
              )}
            </ul>
          )}
          <div className="bp-ai-chat-input-row">
            {(allowAttachments || allowScreenshot) && (
              <Group gap={0} wrap="nowrap" className="bp-ai-chat-input-tools">
                {allowAttachments && (
                  <Tooltip label={t.composer.attachImages} withArrow disabled={preparing}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      radius="xl"
                      size="md"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={preparing || attachmentsFull}
                      aria-label={t.composer.attachImages}
                    >
                      <IconPaperclip size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {allowScreenshot && (
                  <Tooltip label={t.composer.takeScreenshot} withArrow disabled={preparing}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      radius="xl"
                      size="md"
                      onClick={() => void onTakeScreenshot()}
                      disabled={preparing || attachmentsFull}
                      aria-label={t.composer.takeScreenshot}
                    >
                      <IconScreenshot size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            )}
            {allowAttachments && (
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                multiple
                hidden
                data-testid="ai-chat-file-input"
                onChange={(event) => {
                  void addImages(Array.from(event.currentTarget.files ?? []));
                  event.currentTarget.value = '';
                }}
              />
            )}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={onComposerKeyDown}
              onPaste={onComposerPaste}
              placeholder={placeholder ?? (attachments.length ? t.composer.placeholderWithImage : t.composer.placeholder)}
              aria-label={t.composer.inputLabel}
              autosize
              minRows={1}
              maxRows={6}
              variant="unstyled"
              className="bp-ai-chat-textarea"
            />
            {busy ? (
              <Tooltip label={t.composer.stop} withArrow>
                <ActionIcon onClick={() => void stop()} radius="xl" size="md" variant="filled" color="dark" aria-label={t.composer.stopLabel}>
                  <IconPlayerStopFilled size={14} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <ActionIcon type="submit" radius="xl" size="md" variant="filled" disabled={!canSend} aria-label={t.composer.send}>
                <IconArrowUp size={16} />
              </ActionIcon>
            )}
          </div>
        </div>

        <Text size="xs" mt={6} c={overLimit || attachError ? 'red' : 'dimmed'} role={attachError ? 'alert' : undefined}>
          {overLimit
            ? formatCount(input.length - MAX_MESSAGE_CHARS, t.composer.overLimit)
            : attachError
              ? attachError
              : attachments.length
                ? t.composer.imagesNote
                : (disclaimer ?? t.composer.disclaimer)}
        </Text>
      </form>
    </section>
  );
}
