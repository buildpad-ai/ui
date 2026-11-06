/**
 * @buildpad/ui-comments — comments for any record in a Buildpad app.
 *
 * `CommentsKit` is the thread: replies at any depth, a comment box with formatting and an emoji
 * picker, and one-click reactions. It talks to its data through a `CommentsAdapter`;
 * `itemsAdapter` is the default one, over the app's `/api/items/...` routes and the create hook
 * of the `add-comments` skill. What the adapter leaves out (react, edit, remove, resolve) is not
 * shown.
 *
 * Pieces for a shell of your own: `useComments` (state), `Composer`, `CommentMessage`,
 * `ReactionBar`, `EmojiPicker`, `CommentBody`.
 */
'use client';

export { CommentsKit } from './CommentsKit';
export type { CommentsKitProps } from './CommentsKit';

export { itemsAdapter, usersSearch, uploadToFiles, assetUrl, DEFAULT_FIELDS, REPLY_CHUNK } from './CommentsAdapter';
export type { CommentsAdapter, CommentFields, ItemsAdapterOptions } from './CommentsAdapter';

export { useComments } from './useComments';
export type { CommentsAction, UseCommentsOptions, UseCommentsResult } from './useComments';
export { useCommentsStrings } from './useCommentsStrings';

export { Composer } from './Composer';
export type { ComposerProps } from './Composer';
export { CommentMessage, relativeTime } from './CommentMessage';
export type { CommentMessageProps } from './CommentMessage';
export { CommentBody } from './CommentBody';
export type { CommentBodyProps } from './CommentBody';
export { PhotoStrip } from './PhotoStrip';
export type { PhotoStripProps } from './PhotoStrip';
export { MentionPicker } from './MentionPicker';
export type { MentionPickerProps } from './MentionPicker';
export { ReactionBar } from './ReactionBar';
export type { ReactionBarProps } from './ReactionBar';
export { EmojiPicker, EMOJI_TABS } from './EmojiPicker';
export type { EmojiPickerProps } from './EmojiPicker';

export { REACTIONS, canonicalReaction, summarize, toggleLocal, reactorNames } from './core/reactions';
export type { ReactionSummary } from './core/reactions';
export { blocks, inline, toggleMark, toggleBullets, continueBullet } from './core/richtext';
export type { Block, Run } from './core/richtext';
export { buildThreads, countThread, indentFor, MAX_DEPTH } from './core/thread';
export { checkBody, checkPhotos } from './core/validation';
export type { CommentError } from './core/validation';
export { displayName } from './core/people';
export {
  MAX_MENTIONS,
  capMentions,
  cleanName,
  findTrigger,
  makeToken,
  mentionIds,
  parseTokens,
  segments,
  stripTokens,
  toDisplay,
  toStored,
} from './core/mentions';
export type { Segment, Token } from './core/mentions';
export { caretOffset } from './core/caret';
export { IMAGE_TYPES, IMAGE_ACCEPT, MAX_IMAGE_BYTES, checkImage, nameFor, pictureFiles } from './core/images';
export type { ImageProblem } from './core/images';
export { MAX_BODY, MAX_PHOTOS } from './core/types';
export type { Comment, CommentAuthor, NewComment, Person, ThreadNode } from './core/types';
