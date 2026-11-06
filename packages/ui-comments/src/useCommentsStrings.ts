import { useBuildpadTranslations } from '@buildpad/services';
import type { CommentsTranslations, DeepPartial } from '@buildpad/utils';

/** The `comments` strings, with a component's own `translations` prop layered on top. */
export function useCommentsStrings(translations?: DeepPartial<CommentsTranslations>): CommentsTranslations {
  return useBuildpadTranslations((dictionary) => dictionary.comments, translations);
}
