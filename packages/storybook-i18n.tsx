/**
 * Shared Storybook i18n decorator for every Buildpad package.
 *
 * Adds a "Locale" toolbar switch and wraps each story in `BuildpadI18nProvider`
 * with the catalog Buildpad ships for that locale, so a story can be checked
 * in `id` (and in an RTL locale for direction bugs) without any per-story
 * setup. With the default `en` the provider is transparent: components render
 * exactly what they render without a provider.
 *
 * Usage in a package's .storybook/preview.tsx:
 *
 *   import { i18nGlobalTypes, i18nInitialGlobals, withBuildpadI18n } from '../../storybook-i18n';
 *   const preview: Preview = {
 *     globalTypes: i18nGlobalTypes,
 *     initialGlobals: i18nInitialGlobals,
 *     decorators: [existingDecorator, withBuildpadI18n],
 *   };
 */
import React from 'react';
import { DirectionProvider } from '@mantine/core';
import { BuildpadI18nProvider } from '@buildpad/services';
import { bundledTranslationsFor, directionForLocale } from '@buildpad/utils';

export const STORYBOOK_LOCALES = [
  { value: 'en', title: 'English' },
  { value: 'id', title: 'Bahasa Indonesia' },
  { value: 'ar', title: 'العربية (RTL, untranslated)' },
] as const;

export const i18nGlobalTypes = {
  locale: {
    description: 'Locale for Buildpad components (BuildpadI18nProvider)',
    toolbar: {
      title: 'Locale',
      icon: 'globe',
      items: STORYBOOK_LOCALES.map((l) => ({ value: l.value, title: l.title })),
      dynamicTitle: true,
    },
  },
};

export const i18nInitialGlobals = { locale: 'en' };

interface DecoratorContext {
  globals: Record<string, unknown>;
}

/** Storybook decorator: mounts BuildpadI18nProvider for the toolbar locale. */
export function withBuildpadI18n(Story: React.ComponentType, context: DecoratorContext) {
  const locale = typeof context.globals.locale === 'string' ? context.globals.locale : 'en';
  const direction = directionForLocale(locale);
  return (
    <DirectionProvider initialDirection={direction} detectDirection={false}>
      <BuildpadI18nProvider
        locale={locale}
        direction={direction}
        timeZone="UTC"
        translations={bundledTranslationsFor(locale)}
      >
        <div dir={direction} style={{ display: 'contents' }}>
          <Story />
        </div>
      </BuildpadI18nProvider>
    </DirectionProvider>
  );
}
