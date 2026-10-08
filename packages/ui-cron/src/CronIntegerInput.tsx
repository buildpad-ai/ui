'use client';

import React, { useRef, useState } from 'react';
import { NumberInput } from '@mantine/core';

export interface CronIntegerInputProps {
  label: string;
  description?: string;
  /** The value the form holds: always a whole number. */
  value: number;
  /** Called with a whole number, never with a half-typed or an emptied input. */
  onChange: (value: number) => void;
  /**
   * What the input holds as the number the server stores
   * (`normalizeCronTimeoutMs`, `normalizeCronMemoryLimitMb`): a fraction is
   * dropped, and anything that is not a number is the field's default.
   */
  normalize: (value: unknown) => number;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  'data-testid'?: string;
}

/**
 * A number input for one of the job's two integer columns (Timeout, Memory
 * Limit): it takes whole numbers only — no decimal separator, no sign — and
 * hands the form a whole number every time.
 *
 * The input keeps what is being typed to itself. An emptied input is not a
 * number yet: the form keeps its value until the field loses focus, and then
 * gets the field's default. (Handing the default to the form at the keystroke
 * would put it back in the input the moment the last digit is deleted, under
 * the user's cursor.)
 *
 * Private to the package.
 */
export const CronIntegerInput: React.FC<CronIntegerInputProps> = ({
  label,
  description,
  value,
  onChange,
  normalize,
  min,
  max,
  step,
  readOnly,
  'data-testid': testId,
}) => {
  // What the input shows while it is edited: a number, or '' while it is empty
  const [draft, setDraft] = useState<string | number>(value);
  // The form's value changing from outside (a load, a save) replaces the draft
  const formValueRef = useRef(value);
  if (formValueRef.current !== value) {
    formValueRef.current = value;
    if (draft !== value) setDraft(value);
  }

  const commit = (next: number) => {
    formValueRef.current = next;
    if (next !== value) onChange(next);
  };

  return (
    <NumberInput
      label={label}
      description={description}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        if (typeof next === 'number') commit(normalize(next));
      }}
      onBlur={() => {
        if (typeof draft === 'number') return;
        // Emptied, and left that way: the field's default
        const fallback = normalize(draft);
        setDraft(fallback);
        commit(fallback);
      }}
      allowDecimal={false}
      allowNegative={false}
      min={min}
      max={max}
      step={step}
      readOnly={readOnly}
      data-testid={testId}
    />
  );
};

export default CronIntegerInput;
