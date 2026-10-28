'use client';

import {
  DEFAULT_THEME,
  MantineProvider,
  Portal,
  convertCssVariables,
  defaultCssVariablesResolver,
  mergeMantineTheme,
  mergeThemeOverrides,
} from '@mantine/core';
import { useId, useMemo, useRef, type ReactNode } from 'react';
// The exact theme `buildpad init` ships — the gallery never re-declares it.
import { theme as appTheme } from '../../../../../packages/cli/templates/lib/theme';
import { useScheme } from '../SchemeContext';
import './styles';
import styles from './gallery.module.css';

const VARIABLES_SELECTOR = '.bp-gallery';

/**
 * The theme's CSS variables, built once (what MantineProvider's own
 * <MantineCssVariables> writes). A page has many galleries; letting each
 * provider write its own ~39KB copy inlined hundreds of KB per page.
 */
const GALLERY_CSS_VARIABLES =
  convertCssVariables(
    defaultCssVariablesResolver(mergeMantineTheme(DEFAULT_THEME, appTheme)),
    VARIABLES_SELECTOR,
  ) +
  convertCssVariables(
    {
      variables: {},
      light: { '--mantine-color-scheme': 'light' },
      dark: { '--mantine-color-scheme': 'dark' },
    },
    VARIABLES_SELECTOR,
  );

/**
 * Root for every live component demo in the styleguide.
 *
 * Renders real Mantine components with the shipped theme.ts and a scoped copy
 * of the shipped globals.css, so what you see is what a Buildpad app renders.
 * Everything is scoped to this element instead of :root/body so the Nextra
 * chrome is untouched and the Showcase light/dark toggle drives it:
 *
 * - the theme's CSS variables live on `.bp-gallery`, written once per page
 *   (see GALLERY_CSS_VARIABLES);
 * - `getRootElement` + `forceColorScheme` keep `data-mantine-color-scheme`
 *   on this element in sync with the Showcase scheme;
 * - portals (menus, modals, tooltips, popovers) render into a target inside
 *   the root, otherwise they would escape the scoped variables. The target
 *   pins Modal/Drawer's fixed inner wrapper to the viewport (see `.portal`).
 */
export function Gallery({ children }: { children: ReactNode }) {
  const scheme = useScheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const portalId = `bp-gallery-portal-${useId().replace(/:/g, '')}`;

  const theme = useMemo(
    () =>
      mergeThemeOverrides(appTheme, {
        components: {
          Portal: Portal.extend({ defaultProps: { target: `#${portalId}` } }),
        },
      }),
    [portalId],
  );

  return (
    <div
      ref={rootRef}
      className={`bp-gallery ${styles.root}`}
      data-mantine-color-scheme={scheme}
    >
      {/* React 19 hoists a <style> with href + precedence into <head> and
          keeps one per href, so every gallery on the page shares this block. */}
      <style href="bp-gallery-css-variables" precedence="default">
        {GALLERY_CSS_VARIABLES}
      </style>
      <MantineProvider
        theme={theme}
        forceColorScheme={scheme}
        cssVariablesSelector={VARIABLES_SELECTOR}
        getRootElement={() => rootRef.current ?? undefined}
        withCssVariables={false}
        withGlobalClasses={false}
      >
        {children}
        <div id={portalId} className={styles.portal} />
      </MantineProvider>
    </div>
  );
}
