import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { Color } from '@buildpad/ui-interfaces';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

// Mantine's Select also renders an <input type="hidden"> carrying its value,
// so ByDisplayValue matches it twice; return the visible (interactive) input.
const getSelectByDisplayValue = (value: string) => {
  const matches = screen
    .getAllByDisplayValue(value)
    .filter((el) => el.getAttribute('type') !== 'hidden');
  expect(matches).toHaveLength(1);
  return matches[0];
};

// Mock console.warn to avoid color value warnings during tests
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Color Component', () => {
  const defaultProps = {
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without errors', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} />
      </TestWrapper>
    );
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays label when provided', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} label="Select Color" />
      </TestWrapper>
    );
    
    expect(screen.getByText('Select Color')).toBeInTheDocument();
  });

  it('shows required indicator when required prop is true', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} label="Color" required />
      </TestWrapper>
    );
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays description when provided', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} description="Choose your favorite color" />
      </TestWrapper>
    );
    
    expect(screen.getByText('Choose your favorite color')).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} error="Invalid color format" />
      </TestWrapper>
    );
    
    expect(screen.getByText('Invalid color format')).toBeInTheDocument();
  });

  it('displays the current color value', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('#FF0000');
  });

  it('handles hex color input changes', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '#00FF00');
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('#00FF00');
  });

  it('adds # prefix to hex values without it', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'FF0000');
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('#FF0000');
  });

  it('keeps a partially typed hex in a controlled form and commits it once valid', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const Controlled = () => {
      const [color, setColor] = React.useState<string | null>(null);
      return (
        <Color
          value={color}
          onChange={(next) => {
            onChange(next);
            setColor(next);
          }}
        />
      );
    };

    render(
      <TestWrapper>
        <Controlled />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.type(input, '#00FF');
    expect(input.value).toBe('#00FF');
    expect(onChange).not.toHaveBeenCalled();

    await user.type(input, '00');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#00FF00');
    expect(input.value).toBe('#00FF00');
  });

  it('reverts an unfinished hex draft to the stored value on blur', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '#12');
    expect(input.value).toBe('#12');

    await user.tab();
    expect(input.value).toBe('#FF0000');
  });

  it('handles clearing color value', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.clear(input);
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(null);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} disabled />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('uses placeholder when provided', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} placeholder="Choose a color..." />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('Choose a color...');
  });

  it('opens color picker popover on input focus', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    // Check if popover content is visible
    await waitFor(() => {
      expect(screen.getByText('RGB')).toBeInTheDocument();
    });
  });

  it('displays color presets', async () => {
    const user = userEvent.setup();
    const customPresets = [
      { name: 'Red', color: '#FF0000' },
      { name: 'Blue', color: '#0000FF' },
    ];
    
    render(
      <TestWrapper>
        <Color {...defaultProps} presets={customPresets} />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      expect(screen.getByText('Presets')).toBeInTheDocument();
    });
  });

  it('handles preset selection', async () => {
    const user = userEvent.setup();
    const customPresets = [
      { name: 'Red', color: '#FF0000' },
    ];
    
    render(
      <TestWrapper>
        <Color {...defaultProps} presets={customPresets} />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      const presetButton = screen.getByTitle('Red');
      fireEvent.click(presetButton);
    });
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('#FF0000');
  });

  it('switches between RGB and HSL color formats', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      const formatSelect = getSelectByDisplayValue('RGB');
      expect(formatSelect).toBeInTheDocument();
    });
    
    // Switch to HSL format
    const formatSelect = getSelectByDisplayValue('RGB');
    await user.click(formatSelect);
    
    // Find first, then click once: clicking inside waitFor reruns the click on
    // every retry, and user-event's delays could push it past the timeout
    // when the suite runs in parallel.
    await user.click(await screen.findByText('HSL'));

    await waitFor(() => {
      expect(getSelectByDisplayValue('HSL')).toBeInTheDocument();
    });
  });

  it('supports opacity mode with RGBA/HSLA formats', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} opacity />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      expect(getSelectByDisplayValue('RGBA')).toBeInTheDocument();
      expect(screen.getByText('Opacity')).toBeInTheDocument();
    });
  });

  it('handles invalid hex color gracefully', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} value="invalid" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('invalid');
    
    // Should not crash and should show color picker icon
    await user.click(input);
    
    await waitFor(() => {
      expect(screen.getByText('RGB')).toBeInTheDocument();
    });
  });

  it('validates hex color format', () => {
    // Valid hex colors
    expect(() => {
      render(
        <TestWrapper>
          <Color {...defaultProps} value="#FF0000" />
        </TestWrapper>
      );
    }).not.toThrow();
    
    expect(() => {
      render(
        <TestWrapper>
          <Color {...defaultProps} value="#FF000080" />
        </TestWrapper>
      );
    }).not.toThrow();
  });

  it('handles color format conversions correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    // Check RGB values for red color
    await waitFor(() => {
      const rgbInputs = screen.getAllByDisplayValue('255');
      expect(rgbInputs).toHaveLength(1); // R value should be 255
      
      // G and B are both 0 for pure red, so there are exactly two
      const zeroInputs = screen.getAllByDisplayValue('0');
      expect(zeroInputs).toHaveLength(2);
    });
  });

  it('provides native color picker integration', () => {
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    // Find the color swatch button (left section; the clear button is second)
    const colorSwatch = screen.getAllByRole('button')[0];
    expect(colorSwatch).toBeInTheDocument();
    
    // Should have background color style
    expect(colorSwatch).toHaveStyle('background-color: #FF0000');
  });

  it('handles clear button functionality', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color {...defaultProps} value="#FF0000" />
      </TestWrapper>
    );
    
    // Find the clear button (X icon)
    const clearButton = screen.getAllByRole('button')[1]; // Second button should be clear
    await user.click(clearButton);
    
    expect(defaultProps.onChange).toHaveBeenCalledWith(null);
  });
});

// Color utility tests
describe('ColorUtils', () => {
  // We'll test these through the component behavior since ColorUtils is internal
  it('converts colors between formats correctly through component interaction', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <Color onChange={jest.fn()} value="#FF0000" />
      </TestWrapper>
    );
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    await waitFor(() => {
      // Red color in RGB should show: R=255, G=0, B=0
      expect(screen.getByDisplayValue('255')).toBeInTheDocument();
      expect(screen.getAllByDisplayValue('0')).toHaveLength(2);
    });
  });
});
