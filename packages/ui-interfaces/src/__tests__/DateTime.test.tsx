import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DateTime, DateTimeProps } from '../datetime/DateTime';

// Helper function to render components with Mantine provider
const renderWithProvider = (component: React.ReactElement) => {
  return render(<MantineProvider>{component}</MantineProvider>);
};

// Mantine's pickers render the field as a <button> whose text is the
// formatted value (or the placeholder when empty).
const getField = (container: HTMLElement) =>
  container.querySelector('button[data-dates-input]') as HTMLButtonElement;
const getClearButton = (container: HTMLElement) =>
  container.querySelector('.mantine-InputClearButton-root');

describe('DateTime', () => {
  const defaultProps: DateTimeProps = {
    value: null,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      const { container } = renderWithProvider(<DateTime {...defaultProps} />);
      expect(getField(container)).toBeInTheDocument();
    });

    it('renders label when provided', () => {
      renderWithProvider(<DateTime {...defaultProps} label="Published at" />);
      expect(screen.getByText('Published at')).toBeInTheDocument();
    });

    it('marks the label as required', () => {
      renderWithProvider(<DateTime {...defaultProps} label="Published at" required />);
      expect(screen.getByText('Published at *')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      renderWithProvider(
        <DateTime {...defaultProps} label="Published at" description="When the post goes live" />
      );
      expect(screen.getByText('When the post goes live')).toBeInTheDocument();
    });

    it('renders error message when provided', () => {
      renderWithProvider(
        <DateTime {...defaultProps} label="Published at" error="Date is required" />
      );
      expect(screen.getByText('Date is required')).toBeInTheDocument();
    });

    it('forwards data-testid to the picker', () => {
      renderWithProvider(<DateTime {...defaultProps} data-testid="published-at" />);
      expect(screen.getByTestId('published-at')).toBeInTheDocument();
    });
  });

  describe('Placeholder', () => {
    it('uses the datetime placeholder by default', () => {
      renderWithProvider(<DateTime {...defaultProps} />);
      expect(screen.getByText('Pick date and time')).toBeInTheDocument();
    });

    it('uses the date placeholder for type="date"', () => {
      renderWithProvider(<DateTime {...defaultProps} type="date" />);
      expect(screen.getByText('Pick date')).toBeInTheDocument();
    });

    it('uses the time placeholder for type="time"', () => {
      renderWithProvider(<DateTime {...defaultProps} type="time" />);
      expect(screen.getByText('Pick time')).toBeInTheDocument();
    });

    it('prefers an explicit placeholder', () => {
      renderWithProvider(<DateTime {...defaultProps} placeholder="When?" />);
      expect(screen.getByText('When?')).toBeInTheDocument();
    });

    it('accepts per-instance translation overrides', () => {
      renderWithProvider(
        <DateTime {...defaultProps} translations={{ pickDateTime: 'Choose a moment' }} />
      );
      expect(screen.getByText('Choose a moment')).toBeInTheDocument();
    });
  });

  describe('Value Display', () => {
    it('formats a datetime value with the 24-hour default format', () => {
      renderWithProvider(<DateTime {...defaultProps} value="2024-01-15T14:30:00" />);
      expect(screen.getByText('15 Jan 2024 14:30')).toBeInTheDocument();
    });

    it('includes seconds when includeSeconds is true', () => {
      renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:45" includeSeconds />
      );
      expect(screen.getByText('15 Jan 2024 14:30:45')).toBeInTheDocument();
    });

    it('uses the 12-hour format when use24 is false', () => {
      renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:00" use24={false} />
      );
      expect(screen.getByText('15 Jan 2024 02:30 PM')).toBeInTheDocument();
    });

    it('formats a date-only value', () => {
      renderWithProvider(<DateTime {...defaultProps} type="date" value="2024-01-15" />);
      expect(screen.getByText('15 Jan 2024')).toBeInTheDocument();
    });

    it('honours a custom valueFormat', () => {
      renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:00" valueFormat="YYYY/MM/DD" />
      );
      expect(screen.getByText('2024/01/15')).toBeInTheDocument();
    });

    it('falls back to the placeholder for an unparseable value', () => {
      renderWithProvider(<DateTime {...defaultProps} value="not a date" />);
      expect(screen.getByText('Pick date and time')).toBeInTheDocument();
    });
  });

  describe('Disabled and ReadOnly States', () => {
    it('disables the field when disabled is true', () => {
      const { container } = renderWithProvider(<DateTime {...defaultProps} disabled />);
      expect(getField(container)).toBeDisabled();
    });

    it('offers a clear button for a value by default', () => {
      const { container } = renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:00" />
      );
      expect(getClearButton(container)).toBeInTheDocument();
    });

    it('does not offer a clear button when readOnly', () => {
      const { container } = renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:00" readOnly />
      );
      expect(getClearButton(container)).not.toBeInTheDocument();
    });
  });

  describe('Clearing', () => {
    it('emits null when the clear button is clicked', () => {
      const onChange = jest.fn();
      const { container } = renderWithProvider(
        <DateTime value="2024-01-15T14:30:00" onChange={onChange} />
      );
      const clear = getClearButton(container) as HTMLElement;
      expect(clear).toBeInTheDocument();
      fireEvent.click(clear);
      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('does not render a clear button when clearable is false', () => {
      const { container } = renderWithProvider(
        <DateTime {...defaultProps} value="2024-01-15T14:30:00" clearable={false} />
      );
      expect(getClearButton(container)).not.toBeInTheDocument();
    });
  });
});
