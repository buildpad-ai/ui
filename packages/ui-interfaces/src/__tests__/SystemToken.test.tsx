import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SystemToken, SystemTokenProps } from '../system-token';

// Mock @buildpad/services apiRequest
jest.mock('@buildpad/services', () => ({
  apiRequest: jest.fn(),
}));

// Mock @buildpad/hooks useClipboard
jest.mock('@buildpad/hooks', () => ({
  useClipboard: jest.fn(() => ({
    isCopySupported: true,
    isPasteSupported: false,
    copyToClipboard: jest.fn().mockResolvedValue(true),
    pasteFromClipboard: jest.fn(),
  })),
}));

import { apiRequest } from '@buildpad/services';
import { useClipboard } from '@buildpad/hooks';

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedUseClipboard = useClipboard as jest.MockedFunction<typeof useClipboard>;

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('SystemToken', () => {
  const mockOnChange = jest.fn();
  const mockCopyToClipboard = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    mockOnChange.mockClear();
    mockCopyToClipboard.mockClear();
    mockedApiRequest.mockClear();
    mockedUseClipboard.mockReturnValue({
      isCopySupported: true,
      isPasteSupported: false,
      copyToClipboard: mockCopyToClipboard,
      pasteFromClipboard: jest.fn(),
    });
  });

  describe('Basic Rendering', () => {
    it('renders with label', () => {
      renderWithProvider(<SystemToken label="API Token" onChange={mockOnChange} />);
      expect(screen.getByText('API Token')).toBeInTheDocument();
    });

    it('renders without label', () => {
      renderWithProvider(<SystemToken onChange={mockOnChange} data-testid="token" />);
      expect(screen.getByTestId('token')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      renderWithProvider(
        <SystemToken label="Token" description="Generate a token for API access" onChange={mockOnChange} />
      );
      expect(screen.getByText('Generate a token for API access')).toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      renderWithProvider(
        <SystemToken label="Token" error="Token is required" onChange={mockOnChange} />
      );
      expect(screen.getByText('Token is required')).toBeInTheDocument();
    });

    it('uses monospace font', () => {
      const { container } = renderWithProvider(
        <SystemToken label="Token" data-testid="token" onChange={mockOnChange} />
      );
      const styledEl = container.querySelector('[style*="Monaco"]');
      expect(styledEl).not.toBeNull();
    });

    it('renders input as readonly', () => {
      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });
  });

  describe('Placeholder Text', () => {
    it('shows generate prompt when no token exists', () => {
      renderWithProvider(<SystemToken onChange={mockOnChange} />);
      expect(screen.getByPlaceholderText('No token set — click generate to create one')).toBeInTheDocument();
    });

    it('shows "Token securely saved" when token exists but not in local state', () => {
      renderWithProvider(
        <SystemToken value="**************" onChange={mockOnChange} />
      );
      expect(screen.getByPlaceholderText('Token securely saved')).toBeInTheDocument();
    });

    it('shows no placeholder when disabled and no value', () => {
      renderWithProvider(
        <SystemToken disabled onChange={mockOnChange} data-testid="token" />
      );
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.placeholder).toBe('');
    });
  });

  describe('Token Generation', () => {
    it('shows generate button (plus icon) when no token exists', () => {
      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('token-generate')).toBeInTheDocument();
      expect(screen.getByLabelText('Generate token')).toBeInTheDocument();
    });

    it('shows regenerate button (refresh icon) when token exists', () => {
      renderWithProvider(
        <SystemToken value="existing-token" data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('token-generate')).toBeInTheDocument();
      expect(screen.getByLabelText('Regenerate token')).toBeInTheDocument();
    });

    it('calls API and emits value on generate', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: 'generated-token-123' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(mockedApiRequest).toHaveBeenCalledWith('/api/utils/random/string');
        expect(mockOnChange).toHaveBeenCalledWith('generated-token-123');
      });
    });

    it('shows success notice after generation', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: 'new-token-456' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} value="new-token-456" />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('token-notice')).toBeInTheDocument();
        expect(screen.getByText(/copy the token now/i)).toBeInTheDocument();
      });
    });

    it('switches to text input type after generation', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: 'visible-token' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      // Initially password type
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.type).toBe('password');

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(input.type).toBe('text');
      });
    });

    it('handles API error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockedApiRequest.mockRejectedValueOnce(new Error('Network error'));

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
        expect(mockOnChange).not.toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('does not show generate button when disabled', () => {
      renderWithProvider(
        <SystemToken disabled data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.queryByTestId('token-generate')).not.toBeInTheDocument();
    });
  });

  describe('Clipboard Copy', () => {
    it('shows copy button when token is generated and clipboard is supported', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: 'copy-token' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('token-copy')).toBeInTheDocument();
      });
    });

    it('does not show copy button when no local value', () => {
      renderWithProvider(
        <SystemToken value="**************" data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.queryByTestId('token-copy')).not.toBeInTheDocument();
    });

    it('calls copyToClipboard when copy button is clicked', async () => {
      mockedApiRequest.mockResolvedValueOnce({ data: 'token-to-copy' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('token-copy')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('token-copy'));
      expect(mockCopyToClipboard).toHaveBeenCalledWith('token-to-copy');
    });

    it('does not show copy button when clipboard is not supported', async () => {
      mockedUseClipboard.mockReturnValue({
        isCopySupported: false,
        isPasteSupported: false,
        copyToClipboard: mockCopyToClipboard,
        pasteFromClipboard: jest.fn(),
      });

      mockedApiRequest.mockResolvedValueOnce({ data: 'some-token' });

      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('token-generate'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('token-copy')).not.toBeInTheDocument();
      });
    });
  });

  describe('Token Removal', () => {
    it('shows clear button when token exists and not disabled', () => {
      renderWithProvider(
        <SystemToken value="some-token" data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('token-clear')).toBeInTheDocument();
    });

    it('does not show clear button when no token', () => {
      renderWithProvider(
        <SystemToken data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.queryByTestId('token-clear')).not.toBeInTheDocument();
    });

    it('does not show clear button when disabled', () => {
      renderWithProvider(
        <SystemToken value="some-token" disabled data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.queryByTestId('token-clear')).not.toBeInTheDocument();
    });

    it('calls onChange with null when clear button is clicked', () => {
      renderWithProvider(
        <SystemToken value="some-token" data-testid="token" onChange={mockOnChange} />
      );
      fireEvent.click(screen.getByTestId('token-clear'));
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Masked Value Handling', () => {
    it('resets local state when value is masked asterisks', () => {
      const { rerender } = renderWithProvider(
        <SystemToken value="real-token" data-testid="token" onChange={mockOnChange} />
      );

      rerender(
        <MantineProvider>
          <SystemToken value="**************" data-testid="token" onChange={mockOnChange} />
        </MantineProvider>
      );

      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('resets isNewTokenGenerated when value becomes masked', () => {
      const { rerender } = renderWithProvider(
        <SystemToken value="real-token" data-testid="token" onChange={mockOnChange} />
      );

      rerender(
        <MantineProvider>
          <SystemToken value="***" data-testid="token" onChange={mockOnChange} />
        </MantineProvider>
      );

      // Should be password type (not text) since isNewTokenGenerated is reset
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('clears local value when value becomes null', () => {
      const { rerender } = renderWithProvider(
        <SystemToken value="real-token" data-testid="token" onChange={mockOnChange} />
      );

      rerender(
        <MantineProvider>
          <SystemToken value={null} data-testid="token" onChange={mockOnChange} />
        </MantineProvider>
      );

      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Key Icon', () => {
    it('shows key icon in blue when token exists and disabled', () => {
      renderWithProvider(
        <SystemToken value="some-token" disabled data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('token-key-icon')).toBeInTheDocument();
    });

    it('shows key icon in gray when no token', () => {
      renderWithProvider(
        <SystemToken disabled data-testid="token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('token-key-icon')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('renders as disabled when disabled prop is true', () => {
      renderWithProvider(
        <SystemToken disabled data-testid="token" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onChange gracefully', () => {
      renderWithProvider(<SystemToken data-testid="token" />);
      expect(screen.getByTestId('token')).toBeInTheDocument();
    });

    it('handles null value', () => {
      renderWithProvider(
        <SystemToken value={null} data-testid="token" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('handles undefined value', () => {
      renderWithProvider(
        <SystemToken value={undefined} data-testid="token" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('token') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Test ID Support', () => {
    it('applies data-testid to input', () => {
      renderWithProvider(
        <SystemToken data-testid="my-token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('my-token')).toBeInTheDocument();
    });

    it('applies container test ID', () => {
      renderWithProvider(
        <SystemToken data-testid="my-token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('my-token-container')).toBeInTheDocument();
    });

    it('applies generate button test ID', () => {
      renderWithProvider(
        <SystemToken data-testid="my-token" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('my-token-generate')).toBeInTheDocument();
    });
  });
});
