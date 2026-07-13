'use client';

import React from 'react';
import { SystemToken } from '@buildpad/ui-interfaces/system-token';
import { generateToken } from './accessUtils';

export interface TokenInputProps {
  /** Current value: `null` (no token), a plaintext token, or the backend-concealed asterisks. */
  value: string | null;
  /** Called with the newly generated token, or `null` to revoke. */
  onChange: (value: string | null) => void;
  /** Field label. Default: "Token". */
  label?: string;
  /** Field description shown under the label. */
  description?: string;
  /** Disables all actions and renders the field inert. */
  disabled?: boolean;
  /** Error message. */
  error?: string;
  'data-testid'?: string;
}

/**
 * Static access token field: the ui-interfaces `system-token` interface with
 * generation switched to the client-side `generateToken()` (this module's API
 * contract has no `/api/utils/random/string`). All display states — plaintext
 * once with Copy + can't-view-again notice, "Value Securely Saved"
 * concealment (`/^\*+$/` backend masking), Clear-to-revoke — come from
 * `SystemToken` itself.
 */
export const TokenInput: React.FC<TokenInputProps> = ({ label = 'Token', ...props }) => (
  <SystemToken label={label} generate={generateToken} {...props} />
);

export default TokenInput;
