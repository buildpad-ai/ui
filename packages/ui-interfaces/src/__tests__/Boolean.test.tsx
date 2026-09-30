import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Boolean, BooleanProps } from '../boolean/Boolean';

// Helper function to render components with Mantine provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('Boolean', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Basic Functionality', () => {
    it('renders with label', () => {
      renderWithProvider(
        <Boolean
          label="Enable feature"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Enable feature')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('renders without label', () => {
      renderWithProvider(
        <Boolean
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      renderWithProvider(
        <Boolean
          label="Enable feature"
          description="This enables the feature"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('This enables the feature')).toBeInTheDocument();
    });

    it('displays error message when error prop is provided', () => {
      renderWithProvider(
        <Boolean
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
        <Boolean
          value={false}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('displays checked state for true value', () => {
      renderWithProvider(
        <Boolean
          value={true}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('displays unchecked state for null value', () => {
      renderWithProvider(
        <Boolean
          value={null}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('displays unchecked state for undefined value', () => {
      renderWithProvider(
        <Boolean
          value={undefined}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('calls onChange when clicked', () => {
      renderWithProvider(
        <Boolean
          value={false}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when unchecked', () => {
      renderWithProvider(
        <Boolean
          value={true}
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch');
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Props and Configuration', () => {
    it('renders as disabled when disabled prop is true', () => {
      renderWithProvider(
        <Boolean
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
        <Boolean
          value={false}
          readOnly
          onChange={mockOnChange}
        />
      );

      const checkbox = screen.getByRole('switch') as HTMLInputElement;
      // readOnly is deliberately NOT disabled (e3bb26b, "make readonly a
      // real state end-to-end"): the control stays focusable and reports
      // itself read-only, with writes suppressed instead.
      expect(checkbox.disabled).toBe(false);
      expect(checkbox).toHaveAttribute('aria-readonly', 'true');
      fireEvent.click(checkbox);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('shows required indicator when required prop is true', () => {
      renderWithProvider(
        <Boolean
          label="Enable feature"
          required
          onChange={mockOnChange}
        />
      );

      expect(screen.getByText('Enable feature *')).toBeInTheDocument();
    });

    it('does not call onChange when disabled and clicked', () => {
      renderWithProvider(
        <Boolean
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
        <Boolean
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

  describe('Size Variants', () => {
    it('renders with different sizes', () => {
      const sizes: Array<BooleanProps['size']> = ['xs', 'sm', 'md', 'lg', 'xl'];
      
      sizes.forEach((size) => {
        const { unmount } = renderWithProvider(
          <Boolean
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

  describe('Icon Support', () => {
    it('handles icon props without breaking', () => {
      renderWithProvider(
        <Boolean
          value={false}
          iconOn={<span>ON</span>}
          iconOff={<span>OFF</span>}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Color Customization', () => {
    it('handles color props without breaking', () => {
      renderWithProvider(
        <Boolean
          value={false}
          colorOn="#00ff00"
          colorOff="#ff0000"
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Additional Props', () => {
    it('passes additional switchProps to the Switch component', () => {
      renderWithProvider(
        <Boolean
          value={false}
          switchProps={{
            'aria-label': 'custom-switch',
          }}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByLabelText('custom-switch')).toBeInTheDocument();
    });

    it('handles additional props passed directly', () => {
      renderWithProvider(
        <Boolean
          value={false}
          onChange={mockOnChange}
          data-testid="direct-prop"
        />
      );

      expect(screen.getByTestId('direct-prop')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onChange gracefully', () => {
      renderWithProvider(
        <Boolean
          value={false}
        />
      );

      const checkbox = screen.getByRole('switch');
      expect(() => fireEvent.click(checkbox)).not.toThrow();
    });

    it('handles empty label gracefully', () => {
      renderWithProvider(
        <Boolean
          value={false}
          label=""
          onChange={mockOnChange}
        />
      );

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });
});
