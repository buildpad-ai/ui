/**
 * TokenInput unit tests: empty/generated/concealed states, copy affordance,
 * clear-to-revoke, and disabled rendering.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, it, expect, vi } from 'vitest';
import { TokenInput } from '../src/TokenInput';

/** Stateful harness mirroring how UserDetail hosts the controlled field. */
function Harness({
  initial,
  onChange,
  disabled,
}: {
  initial: string | null;
  onChange?: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <TokenInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      disabled={disabled}
      data-testid="token"
    />
  );
}

function renderToken(props: React.ComponentProps<typeof Harness>) {
  return render(
    <MantineProvider>
      <Harness {...props} />
    </MantineProvider>
  );
}

describe('TokenInput', () => {
  it('shows the generate placeholder and no copy/clear when empty', () => {
    renderToken({ initial: null });
    expect(screen.getByTestId('token')).toHaveAttribute(
      'placeholder',
      'Click "Generate Token" to create a new static access token'
    );
    expect(screen.getByTestId('token-generate')).toBeInTheDocument();
    expect(screen.queryByTestId('token-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('token-clear')).not.toBeInTheDocument();
    expect(screen.queryByTestId('token-notice')).not.toBeInTheDocument();
  });

  it('suppresses password-manager overlays via data-lpignore/data-1p-ignore', () => {
    renderToken({ initial: null });
    const input = screen.getByTestId('token');
    expect(input).toHaveAttribute('data-lpignore', 'true');
    expect(input).toHaveAttribute('data-1p-ignore', 'true');
  });

  it('generates a plaintext token with copy affordance and security notice', () => {
    const onChange = vi.fn();
    renderToken({ initial: null, onChange });

    fireEvent.click(screen.getByTestId('token-generate'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const token = onChange.mock.calls[0][0] as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.getByTestId('token')).toHaveValue(token);
    expect(screen.getByTestId('token-copy')).toBeInTheDocument();
    expect(screen.getByTestId('token-clear')).toBeInTheDocument();
    expect(screen.getByTestId('token-notice')).toBeInTheDocument();
  });

  it('shows "Value Securely Saved" for a concealed value with no plaintext or copy', () => {
    renderToken({ initial: '**********' });
    const input = screen.getByTestId('token');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Value Securely Saved');
    expect(screen.queryByTestId('token-copy')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Regenerate token')).toBeInTheDocument();
    expect(screen.getByTestId('token-clear')).toBeInTheDocument();
  });

  it('regenerates over a concealed value, replacing it with new plaintext', () => {
    const onChange = vi.fn();
    renderToken({ initial: '**********', onChange });

    fireEvent.click(screen.getByTestId('token-generate'));

    const token = onChange.mock.calls[0][0] as string;
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(screen.getByTestId('token')).toHaveValue(token);
    expect(screen.getByTestId('token-notice')).toBeInTheDocument();
  });

  it('clears to null (revoke) and returns to the empty state', () => {
    const onChange = vi.fn();
    renderToken({ initial: '**********', onChange });

    fireEvent.click(screen.getByTestId('token-clear'));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('token')).toHaveAttribute(
      'placeholder',
      'Click "Generate Token" to create a new static access token'
    );
    expect(screen.queryByTestId('token-clear')).not.toBeInTheDocument();
  });

  it('is read-only: typing never mutates the value', () => {
    const onChange = vi.fn();
    renderToken({ initial: null, onChange });
    const input = screen.getByTestId('token');
    expect(input).toHaveAttribute('readonly');
    fireEvent.change(input, { target: { value: 'typed' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders no actions when disabled', () => {
    renderToken({ initial: '**********', disabled: true });
    expect(screen.queryByTestId('token-generate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('token-clear')).not.toBeInTheDocument();
  });
});
