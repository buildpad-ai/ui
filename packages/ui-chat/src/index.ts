/**
 * @buildpad/ui-chat — AI chat for Buildpad apps, backed by a Chocolate Factory agent.
 *
 * Layouts: `AiChatPanel` (docked right panel) and `AiChatWidget` (floating
 * bubble and window), opened by `AiChatButton` and the ⌘I / Ctrl+I shortcut
 * through `AiChatProvider`; `AiChat` is the chat itself, for other shells.
 *
 * Backends: `chocolateFactoryBackend` (browser-direct, the default: streams on
 * Amplify, the key is visible to the browser) and `routeBackend` (the app's own
 * proxy route from `ai-chat-proxy-routes`: the key stays on the server; streams
 * only on a long-lived Node server).
 *
 * Private: the screenshot tools (./screenshot), the browser storage helpers and
 * the message helpers the chat uses internally.
 */
'use client';

export { AiChat, MAX_MESSAGE_CHARS } from './AiChat';
export type { AiChatProps, AiChatViewProps, AiChatFeatures } from './AiChat';

export { AiChatPanel } from './AiChatPanel';
export type { AiChatPanelProps } from './AiChatPanel';

export { AiChatWidget } from './AiChatWidget';
export type { AiChatWidgetProps } from './AiChatWidget';

export { AiChatButton, formatHotkey } from './AiChatButton';
export type { AiChatButtonProps } from './AiChatButton';

export { AiChatContextChip } from './AiChatContextChip';
export type { AiChatContextChipProps } from './AiChatContextChip';

export { AiChatProvider, useAiChat, useChatStrings } from './AiChatProvider';
export type { AiChatProviderProps, AiChatContextValue } from './AiChatProvider';

export { defaultLinkTarget } from './AiChatMarkdown';
export type { LinkTarget } from './AiChatMarkdown';

export {
  chocolateFactoryBackend,
  routeBackend,
  chocolateFactoryBaseUrl,
  chocolateFactoryAuthHeaders,
  AI_CHAT_CONVERSATION_HEADER,
} from './backends';
export type { AiChatBackend, AiChatBackendHandlers, ChocolateFactoryConfig, RouteBackendOptions } from './backends';

export { useChocolateFactoryConfig } from './useChocolateFactoryConfig';

export { parseImagePart, isAttachmentLinkText, IMAGE_TYPES, MAX_ATTACHMENTS } from './attachments';
export type { ImagePart } from './attachments';

export { toUIMessages } from './history';
export type { StoredUIMessage } from './history';
