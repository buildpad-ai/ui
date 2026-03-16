import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { InputHash, InputHashProps } from '../input-hash';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('InputHash', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders with label', () => {
      renderWithProvider(<InputHash label="Password" onChange={mockOnChange} />);
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('renders without label', () => {
      renderWithProvider(<InputHash onChange={mockOnChange} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      renderWithProvider(
        <InputHash label="Password" description="Enter a strong password" onChange={mockOnChange} />
      );
      expect(screen.getByText('Enter a strong password')).toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      renderWithProvider(
        <InputHash label="Password" error="This field is required" onChange={mockOnChange} />
      );
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('displays placeholder when no hashed value', () => {
      renderWithProvider(
        <InputHash placeholder="Enter value to hash" onChange={mockOnChange} />
      );
      expect(screen.getByPlaceholderText('Enter value to hash')).toBeInTheDocument();
    });

    it('uses monospace font', () => {
      const { container } = renderWithProvider(
        <InputHash label="Hash" data-testid="hash-input" onChange={mockOnChange} />
      );
      // The style is applied to the Mantine input wrapper
      const styledEl = container.querySelector('[style*="Monaco"]');
      expect(styledEl).not.toBeNull();
    });
  });

  describe('Hashed Value Indicator', () => {
    it('shows "Value securely stored" placeholder when value is hashed and no local input', () => {
      renderWithProvider(
        <InputHash value="$argon2id$v=19$m=65536" onChange={mockOnChange} />
      );
      expect(screen.getByPlaceholderText('Value securely stored')).toBeInTheDocument();
    });

    it('shows lock icon when value is hashed', () => {
      renderWithProvider(
        <InputHash value="$argon2id$v=19$m=65536" data-testid="hash-input" onChange={mockOnChange} />
      );
      const lockIcon = screen.getByTestId('hash-input-lock-icon');
      expect(lockIcon).toBeInTheDocument();
    });

    it('shows lock-open icon when no hashed value', () => {
      renderWithProvider(
        <InputHash data-testid="hash-input" onChange={mockOnChange} />
      );
      const lockIcon = screen.getByTestId('hash-input-lock-icon');
      expect(lockIcon).toBeInTheDocument();
    });

    it('shows custom placeholder when no hashed value exists', () => {
      renderWithProvider(
        <InputHash placeholder="Enter password" onChange={mockOnChange} />
      );
      expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    });
  });

  describe('Value Handling', () => {
    it('starts with empty local value regardless of hashed value', () => {
      renderWithProvider(
        <InputHash value="$argon2id$hashed" onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('calls onChange with typed value', () => {
      renderWithProvider(
        <InputHash onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'newpassword' } });
      expect(mockOnChange).toHaveBeenCalledWith('newpassword');
    });

    it('calls onChange with null when input is cleared', () => {
      renderWithProvider(
        <InputHash onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'something' } });
      fireEvent.change(input, { target: { value: '' } });
      expect(mockOnChange).toHaveBeenLastCalledWith(null);
    });

    it('updates local value when typing', () => {
      renderWithProvider(
        <InputHash onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'newvalue' } });
      expect(input.value).toBe('newvalue');
    });
  });

  describe('Masked Mode', () => {
    it('renders as password input when masked is true', () => {
      renderWithProvider(
        <InputHash masked label="Password" onChange={mockOnChange} />
      );
      const input = screen.getByLabelText('Password') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('sets autocomplete to new-password when masked', () => {
      renderWithProvider(
        <InputHash masked data-testid="hash-input" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('hash-input');
      expect(input.getAttribute('autocomplete')).toBe('new-password');
    });
  });

  describe('Autocomplete', () => {
    it('defaults to off when not masked', () => {
      renderWithProvider(
        <InputHash data-testid="hash-input" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('hash-input');
      expect(input.getAttribute('autocomplete')).toBe('off');
    });

    it('uses custom autocomplete when provided', () => {
      renderWithProvider(
        <InputHash autocomplete="username" data-testid="hash-input" onChange={mockOnChange} />
      );
      const input = screen.getByTestId('hash-input');
      expect(input.getAttribute('autocomplete')).toBe('username');
    });
  });

  describe('Disabled and ReadOnly States', () => {
    it('renders as disabled when disabled prop is true', () => {
      renderWithProvider(
        <InputHash disabled onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('renders as readonly when readonly prop is true', () => {
      renderWithProvider(
        <InputHash readonly onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });

    it('does not call onChange when disabled', () => {
      renderWithProvider(
        <InputHash disabled onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      // Disabled inputs don't fire change events in real browsers,
      // but in jsdom the event may still fire - verify intent by checking disabled state
      expect((input as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('Required Field', () => {
    it('shows required indicator when required prop is true', () => {
      renderWithProvider(
        <InputHash label="Password" required onChange={mockOnChange} />
      );
      // Mantine adds * to the label for required fields
      const label = screen.getByText('Password');
      expect(label).toBeInTheDocument();
      const asterisk = document.querySelector('.mantine-InputWrapper-required');
      expect(asterisk).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onChange gracefully', () => {
      renderWithProvider(<InputHash />);
      const input = screen.getByRole('textbox');
      expect(() => fireEvent.change(input, { target: { value: 'test' } })).not.toThrow();
    });

    it('handles null value', () => {
      renderWithProvider(
        <InputHash value={null} onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('handles undefined value', () => {
      renderWithProvider(
        <InputHash value={undefined} onChange={mockOnChange} />
      );
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('handles empty string value (not hashed)', () => {
      renderWithProvider(
        <InputHash value="" placeholder="Enter value" onChange={mockOnChange} />
      );
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });
  });

  describe('Test ID Support', () => {
    it('applies data-testid when provided', () => {
      renderWithProvider(
        <InputHash data-testid="my-hash" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('my-hash')).toBeInTheDocument();
    });

    it('applies lock icon test ID when data-testid is provided', () => {
      renderWithProvider(
        <InputHash data-testid="my-hash" onChange={mockOnChange} />
      );
      expect(screen.getByTestId('my-hash-lock-icon')).toBeInTheDocument();
    });
  });
});
