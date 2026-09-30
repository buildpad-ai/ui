import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Toggle, ToggleProps } from '../toggle';
import { IconSun, IconMoon } from '@tabler/icons-react';

// Helper function to render components with Mantine provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('Toggle', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Functionality', () => {
    it('renders with label', () => {
      renderWithProvider(
        <Toggle
          label="Enable feature"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Enable feature')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('renders without label', () => {
      renderWithProvider(
        <Toggle
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      renderWithProvider(
        <Toggle
          label="Enable feature"
          description="This enables the feature"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('This enables the feature')).toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      renderWithProvider(
        <Toggle
          label="Enable feature"
          error="This field is required"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });
  });

  describe('Value Handling', () => {
    it('displays unchecked state for false value', () => {
      renderWithProvider(
        <Toggle
          value={false}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('displays checked state for true value', () => {
      renderWithProvider(
        <Toggle
          value={true}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('displays unchecked state for null value', () => {
      renderWithProvider(
        <Toggle
          value={null}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('displays unchecked state for undefined value', () => {
      renderWithProvider(
        <Toggle
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('calls onChange with true when clicked on unchecked toggle', () => {
      renderWithProvider(
        <Toggle
          value={false}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when clicked on checked toggle', () => {
      renderWithProvider(
        <Toggle
          value={true}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Disabled and ReadOnly States', () => {
    it('renders as disabled when disabled prop is true', () => {
      renderWithProvider(
        <Toggle
          value={false}
          disabled
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.disabled).toBe(true);
    });

    it('reports readonly without disabling, and suppresses writes', () => {
      renderWithProvider(
        <Toggle
          value={false}
          readOnly
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      // readOnly is deliberately NOT disabled (40d4360, then e3bb26b "make
      // readonly a real state end-to-end"): the control stays focusable and
      // reports itself read-only, with writes suppressed instead.
      expect(checkbox.disabled).toBe(false);
      expect(checkbox).toHaveAttribute('aria-readonly', 'true');
      fireEvent.click(checkbox);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when disabled and clicked', () => {
      renderWithProvider(
        <Toggle
          value={false}
          disabled
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when readOnly and clicked', () => {
      renderWithProvider(
        <Toggle
          value={false}
          readOnly
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Required Field', () => {
    it('shows required indicator when required prop is true', () => {
      renderWithProvider(
        <Toggle
          label="Enable feature"
          required
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Enable feature *')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders with different sizes', () => {
      const sizes: Array<ToggleProps['size']> = ['xs', 'sm', 'md', 'lg', 'xl'];
      
      sizes.forEach((size) => {
        const { unmount } = renderWithProvider(
          <Toggle
            value={false}
            size={size}
            onChange={mockOnChange}
          />
        );
        
        const checkbox = screen.getByRole('switch');
        expect(checkbox).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('State Labels', () => {
    it('renders with state labels when showStateLabels is true', () => {
      renderWithProvider(
        <Toggle
          value={false}
          showStateLabels
          labelOn="Active"
          labelOff="Inactive"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('uses default state labels (On/Off) when not specified', () => {
      renderWithProvider(
        <Toggle
          value={false}
          showStateLabels
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('On')).toBeInTheDocument();
      expect(screen.getByText('Off')).toBeInTheDocument();
    });

    it('shows label and description with state labels', () => {
      renderWithProvider(
        <Toggle
          value={false}
          showStateLabels
          label="Toggle Label"
          description="Toggle description"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Toggle Label')).toBeInTheDocument();
      expect(screen.getByText('Toggle description')).toBeInTheDocument();
    });

    it('shows error with state labels', () => {
      renderWithProvider(
        <Toggle
          value={false}
          showStateLabels
          error="Error message"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Icon Support', () => {
    it('handles custom icon props', () => {
      renderWithProvider(
        <Toggle
          value={false}
          iconOn={<IconSun data-testid="icon-on" />}
          iconOff={<IconMoon data-testid="icon-off" />}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Color Customization', () => {
    it('handles color props without breaking', () => {
      renderWithProvider(
        <Toggle
          value={true}
          colorOn="#00ff00"
          colorOff="#ff0000"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Test ID Support', () => {
    it('applies data-testid when provided', () => {
      renderWithProvider(
        <Toggle
          value={false}
          data-testid="my-toggle"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('my-toggle')).toBeInTheDocument();
    });

    it('applies container test IDs when showStateLabels is true', () => {
      renderWithProvider(
        <Toggle
          value={false}
          showStateLabels
          data-testid="my-toggle"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByTestId('my-toggle-container')).toBeInTheDocument();
      expect(screen.getByTestId('my-toggle-label-on')).toBeInTheDocument();
      expect(screen.getByTestId('my-toggle-label-off')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label when label is provided', () => {
      renderWithProvider(
        <Toggle
          label="Enable feature"
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-label', 'Enable feature');
    });

    it('has default aria-label when no label is provided', () => {
      renderWithProvider(
        <Toggle
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-label', 'Toggle');
    });

    it('allows custom aria-label via switchProps', () => {
      renderWithProvider(
        <Toggle
          switchProps={{ 'aria-label': 'Custom label' }}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-label', 'Custom label');
    });
  });

  describe('Additional Props', () => {
    it('passes additional switchProps to the Switch component', () => {
      renderWithProvider(
        <Toggle
          value={false}
          switchProps={{
            'aria-describedby': 'description-id',
          }}
          onChange={mockOnChange}
        />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-describedby', 'description-id');
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onChange gracefully', () => {
      renderWithProvider(
        <Toggle
          value={false}
        />
      );

      const checkbox = screen.getByRole('switch');
      expect(() => fireEvent.click(checkbox)).not.toThrow();
    });

    it('handles empty label gracefully', () => {
      renderWithProvider(
        <Toggle
          value={false}
          label=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('handles toggling from null to true', () => {
      renderWithProvider(
        <Toggle
          value={null}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });
  });
});
