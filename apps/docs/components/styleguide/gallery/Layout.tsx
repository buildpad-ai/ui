'use client';

import type { CSSProperties, ReactNode } from 'react';
import styles from './gallery.module.css';

/** A responsive grid of specimens. */
export function SpecimenGrid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className={styles.grid} style={{ '--cols': cols } as CSSProperties}>
      {children}
    </div>
  );
}

/**
 * One live demo tile: the component on a stage, with a caption naming what
 * it is and the props / tokens behind it.
 */
export function Specimen({
  label,
  note,
  span,
  align = 'center',
  surface = 'card',
  children,
}: {
  label: string;
  /** Short explanation; inline `<code>` is styled. */
  note?: ReactNode;
  /** `full` spans every column of the grid. */
  span?: 'full';
  align?: 'center' | 'start';
  /** `muted` puts the stage on the page background instead of a card surface. */
  surface?: 'card' | 'muted';
  children: ReactNode;
}) {
  return (
    <div className={styles.specimen} data-span={span}>
      <div className={styles.specimenStage} data-align={align} data-surface={surface}>
        {children}
      </div>
      <div className={styles.specimenCaption}>
        <span className={styles.specimenLabel}>{label}</span>
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}

/**
 * A browser-window frame for full-page templates. Content scrolls inside a
 * fixed-height viewport so a whole app screen can sit on a docs page.
 */
export function BrowserFrame({
  url,
  height = 720,
  children,
}: {
  /** Path shown in the fake address bar, e.g. `/en/users`. */
  url: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.frameBar} aria-hidden>
        <div className={styles.frameDots}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.frameUrl}>northwind.buildpad.app{url}</div>
      </div>
      <div
        className={styles.frameViewport}
        style={{ '--frame-height': `${height}px` } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
