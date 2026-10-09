'use client';

import React from 'react';
import { interpolate, splitRichText, type InterpolationValues } from '@buildpad/utils';

export interface CronRichTextProps {
  /** A dictionary string that may carry `<tag>…</tag>` markers and `{placeholders}`. */
  template: string;
  /** Values for the placeholders. A value is never read as markup. */
  values?: InterpolationValues;
  /**
   * How to draw the text inside each tag, by tag name. A tag without a
   * renderer is drawn as plain text.
   */
  tags?: Record<string, (text: string) => React.ReactNode>;
}

/**
 * Draws a dictionary string that carries inline tags (`<code>`): each tag
 * becomes the element its renderer returns, and everything else stays text.
 * Nothing is injected as HTML.
 *
 * Used by the job editor's code help; not exported from the package.
 */
export const CronRichText: React.FC<CronRichTextProps> = ({ template, values, tags = {} }) => (
  <>
    {splitRichText(template).map((segment, index) => {
      const text = interpolate(segment.text, values);
      const render = segment.tag ? tags[segment.tag] : undefined;
      // The runs of one template never reorder, so the index is a stable key
      return <React.Fragment key={index}>{render ? render(text) : text}</React.Fragment>;
    })}
  </>
);

export default CronRichText;
