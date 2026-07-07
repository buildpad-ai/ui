/**
 * ChoicesInput
 *
 * A shared, textarea-based editor for a **choice interface**'s option list
 * (dropdown/radio/checkbox/multi-select). One choice per line; `label=value`
 * sets a separate stored value. Extracted from `AddFieldModal` so the advanced
 * "Add field" flow and the settings panel (editing a deferred field's choices)
 * share one implementation.
 *
 * The component keeps its raw text locally and emits parsed `Choice[]` (or
 * `undefined` when empty). Seed it from an existing value by remounting with a
 * `key` — it initializes its text from `value` once on mount.
 *
 * @package @buildpad/ui-forms
 */

'use client';

import { useState } from 'react';
import { Textarea } from '@mantine/core';

/** A single option: display `text` + stored `value`. */
export interface Choice {
  text: string;
  value: string;
}

/** Serialize choices back to the `label=value` per-line textarea format. */
export function choicesToRaw(choices?: Choice[]): string {
  if (!choices?.length) return '';
  return choices
    .map((c) => (c.text === c.value ? c.value : `${c.text}=${c.value}`))
    .join('\n');
}

/** Parse a "label=value" / "value" per-line textarea into DaaS choices. */
export function parseChoices(raw: string): Choice[] | undefined {
  const choices = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=');
      if (eq === -1) return { text: line, value: line };
      return { text: line.slice(0, eq).trim(), value: line.slice(eq + 1).trim() };
    });
  return choices.length > 0 ? choices : undefined;
}

export interface ChoicesInputProps {
  /** Initial choices (used to seed the textarea on mount). */
  value?: Choice[];
  /** Emit the parsed choices (or `undefined` when empty). */
  onChange: (choices: Choice[] | undefined) => void;
  /** Field label. @default 'Choices' */
  label?: string;
  /** Helper text. */
  description?: string;
}

/**
 * Textarea editor for a choice interface's options.
 */
export function ChoicesInput({
  value,
  onChange,
  label = 'Choices',
  description = 'One per line. Use label=value to set a separate value.',
}: ChoicesInputProps) {
  const [raw, setRaw] = useState(() => choicesToRaw(value));

  return (
    <Textarea
      label={label}
      description={description}
      placeholder={'Low\nMedium\nHigh'}
      autosize
      minRows={2}
      maxRows={6}
      value={raw}
      onChange={(e) => {
        const next = e.currentTarget.value;
        setRaw(next);
        onChange(parseChoices(next));
      }}
      data-testid="choices-input"
    />
  );
}

export default ChoicesInput;
