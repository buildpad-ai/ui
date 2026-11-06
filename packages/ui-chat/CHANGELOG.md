# @buildpad/ui-chat

## 3.7.0

### Patch Changes

- Updated dependencies [d67b55a]
  - @buildpad/utils@3.7.0
  - @buildpad/services@3.7.0

## 3.6.0

### Minor Changes

- 4b2e73f: New AI Chat module (`@buildpad/ui-chat`, CLI targets `ai-chat`, `ai-chat-routes` and `ai-chat-proxy-routes`; recipe at /ai-chat): an assistant backed by a Chocolate Factory agent, as a docked side panel (`AiChatPanel`, which docks beside the page from 75em through `--bp-ai-chat-offset`) or a floating widget (`AiChatWidget`), opened by `AiChatButton` and ⌘I / Ctrl+I through `AiChatProvider`; `AiChat` is the chat itself for other shells. Streaming Markdown answers, one working word while the agent searches, Stop, Try again, Copy answer, starter questions, recent chats, image attachments (paper clip, paste, drag and drop) and annotated screenshots of the page (the get-feedback region selector, snapdom capture and annotator). Ported from the Buildpad Platform's Ask AI panel.

  Two backends: `chocolateFactoryBackend` calls the agent from the browser (streams on Amplify Hosting; stateless mode with transcripts kept in local storage, because Chocolate Factory's CORS headers don't expose `X-Conversation-Id`; the key is visible to the browser), with its settings from `GET /api/ai-chat/config` (`ai-chat-routes`) via `useChocolateFactoryConfig`; `routeBackend` posts to the app's own `POST /api/ai-chat` and `GET /api/ai-chat/history` (`ai-chat-proxy-routes`), which keep the key on the server and the conversation in Chocolate Factory behind HMAC-signed tokens (`AI_CHAT_SECRET`), and stream only on a long-lived Node server.

  Strings come from the new `chat` namespace of the shared dictionary (English and Bahasa Indonesia); overrides via `BuildpadI18nProvider` or the components' `translations` prop. The CLI pins `ai` ^5.0.282 (the first to accept the `finishReason` Chocolate Factory sends on its stream's finish chunk), `@ai-sdk/react` ^2.0.285, `react-markdown`, `remark-gfm`, `use-stick-to-bottom` and `@zumer/snapdom`.

### Patch Changes

- Updated dependencies [4b2e73f]
  - @buildpad/utils@3.6.0
  - @buildpad/services@3.6.0
