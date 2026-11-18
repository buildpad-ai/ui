import { useBuildpadTranslations } from '@buildpad/services';
import type { DeepPartial, NotificationsTranslations } from '@buildpad/utils';

/** The `notifications` strings, with a component's own `translations` prop layered on top. */
export function useNotificationsStrings(translations?: DeepPartial<NotificationsTranslations>): NotificationsTranslations {
  return useBuildpadTranslations((dictionary) => dictionary.notifications, translations);
}
