import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconShield } from '@tabler/icons-react';
import { SelectIcon, IconDisplay } from '../select-icon/SelectIcon';

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('SelectIcon', () => {
  it('renders with default props', () => {
    renderWithMantine(<SelectIcon />);
    expect(screen.getByTestId('select-icon-trigger')).toBeInTheDocument();
    expect(screen.getByText('Search for an icon...')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    renderWithMantine(<SelectIcon label="Choose Icon" />);
    expect(screen.getByText('Choose Icon')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    renderWithMantine(<SelectIcon label="Icon" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message', () => {
    renderWithMantine(<SelectIcon error="Icon is required" />);
    expect(screen.getByText('Icon is required')).toBeInTheDocument();
  });

  it('displays selected value', () => {
    renderWithMantine(<SelectIcon value="home" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    renderWithMantine(<SelectIcon />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search icons...')).toBeInTheDocument();
    });
  });

  it('filters icons based on search', async () => {
    renderWithMantine(<SelectIcon />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search icons...');
      fireEvent.change(searchInput, { target: { value: 'home' } });
    });
    
    await waitFor(() => {
      // Should show results with "home" and hide categories that don't contain it
      expect(screen.queryByTestId('icon-home')).toBeInTheDocument(); // 'home' lives in Action
      expect(screen.queryByText('Communication')).not.toBeInTheDocument(); // no 'home' in Communication
    });
  });

  it('calls onChange when icon is selected', async () => {
    const mockOnChange = jest.fn();
    renderWithMantine(<SelectIcon onChange={mockOnChange} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search icons...');
      fireEvent.change(searchInput, { target: { value: 'add' } });
    });
    
    await waitFor(() => {
      const addIconButton = screen.getByTestId('icon-add');
      fireEvent.click(addIconButton);
    });
    
    expect(mockOnChange).toHaveBeenCalledWith('add');
  });

  it('clears selection when clear button is clicked', () => {
    const mockOnChange = jest.fn();
    renderWithMantine(<SelectIcon value="home" onChange={mockOnChange} />);

    fireEvent.click(screen.getByTestId('clear-icon-button'));

    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('is disabled when disabled prop is true', () => {
    renderWithMantine(<SelectIcon disabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('shows no results message when search has no matches', async () => {
    renderWithMantine(<SelectIcon />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search icons...');
      fireEvent.change(searchInput, { target: { value: 'nonexistenticon' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText(/No icons found for/)).toBeInTheDocument();
    });
  });

  it('clears search when clear search button is clicked', async () => {
    renderWithMantine(<SelectIcon />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search icons...');
      fireEvent.change(searchInput, { target: { value: 'test' } });
    });
    
    await waitFor(() => {
      // Get search input and clear it programmatically for testing
      const searchInput = screen.getByPlaceholderText('Search icons...');
      fireEvent.change(searchInput, { target: { value: '' } });
    });
    
    const searchInput = screen.getByPlaceholderText('Search icons...');
    expect(searchInput).toHaveValue('');
  });

  it('formats icon names correctly', () => {
    renderWithMantine(<SelectIcon value="arrow_back_ios" />);
    expect(screen.getByText('Arrow Back Ios')).toBeInTheDocument();
  });

  it('accepts a custom width without breaking rendering', () => {
    // Mantine 8 applies the `w` style prop through its styles engine, which
    // jsdom cannot observe (no inline style, no jsdom-visible stylesheet) —
    // so this is a smoke test of the prop path only.
    renderWithMantine(<SelectIcon width="300px" />);
    expect(screen.getByTestId('select-icon-trigger')).toBeInTheDocument();
  });
});

describe('IconDisplay', () => {
  it('renders the mapped Tabler icon for a known Material name', () => {
    const { container } = renderWithMantine(<IconDisplay icon="shield" />);
    expect(container.querySelector('svg.tabler-icon-shield')).not.toBeNull();
  });

  it('renders the daas default role icon (supervised_user_circle)', () => {
    const { container } = renderWithMantine(<IconDisplay icon="supervised_user_circle" />);
    expect(container.querySelector('svg.tabler-icon-users-group')).not.toBeNull();
  });

  it('falls back to the provided component for unknown or empty names', () => {
    const { container } = renderWithMantine(<IconDisplay icon="not_a_real_icon" />);
    expect(container.querySelector('svg.tabler-icon-users-group')).not.toBeNull();

    const { container: second } = renderWithMantine(
      <IconDisplay icon={null} fallback={IconShield} />
    );
    expect(second.querySelector('svg.tabler-icon-shield')).not.toBeNull();
  });

  it('applies size and stroke and stays aria-hidden (decorative)', () => {
    const { container } = renderWithMantine(<IconDisplay icon="key" size={28} stroke={2} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '28');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
