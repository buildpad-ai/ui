'use client';

import React from 'react';
import { Box } from '@mantine/core';
import { InputCode } from '@buildpad/ui-interfaces/input-code';

/**
 * What the job editor hands its code editor — the built-in one, or the one a
 * host app draws through `renderCodeEditor`.
 */
export interface CronCodeEditorProps {
  /** The job's code. Always a string; `''` for none. */
  value: string;
  /** Called with the new code on every edit. Pass `''`, not `null`, for an emptied editor. */
  onChange: (value: string) => void;
  /** The caller may read the code but not change it: show it, and take no edit. */
  readOnly: boolean;
  /** Height the editor should at least have, in pixels. */
  minHeight: number;
  /** Shown while the editor is empty (a JavaScript comment). */
  placeholder: string;
  /** `id` for the element that takes the text, so the form can refer to it. */
  id: string;
  /** `id` of the "Job Code" label: put it on the element that takes the text. */
  'aria-labelledby': string;
  /** `id` of the line under the label ("JavaScript — async/await supported"). */
  'aria-describedby': string;
}

/**
 * The job editor's built-in code editor: ui-interfaces' `InputCode`, a
 * monospace textarea with line numbers and no syntax highlighting. `InputCode`
 * emits `null` for an emptied editor; the form holds `''`.
 *
 * It grows to `minHeight` and no further than `InputCode`'s own cap (480 px),
 * past which the text scrolls. A host that wants highlighting passes its own
 * editor through `CronJobDetail`'s `renderCodeEditor`.
 *
 * Private to the package: the props type is the slot's contract and is
 * exported, the component is not.
 */
export const CronCodeEditor: React.FC<CronCodeEditorProps> = ({
  value,
  onChange,
  readOnly,
  minHeight,
  placeholder,
  id,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}) => (
  <Box style={{ height: minHeight }}>
    <InputCode
      value={value}
      onChange={(next) => onChange(typeof next === 'string' ? next : '')}
      readOnly={readOnly}
      placeholder={placeholder}
      id={id}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-testid="cron-job-detail-code-editor"
    />
  </Box>
);

export default CronCodeEditor;
