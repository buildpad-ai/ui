import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import axios from 'axios';
import { AutocompleteAPI } from '../autocomplete-api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock countries data for testing
const mockCountriesResponse = {
  data: [
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'UK' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    { name: 'Germany', code: 'DE' }
  ]
};

// Test wrapper with Mantine provider. env="test" is Mantine's documented test
// mode: without it the Popover's floating-ui `hide` middleware sees jsdom's
// all-zero layout as a detached reference and renders the dropdown with
// `display: none`, so role-based queries can't see the options.
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider env="test">{children}</MantineProvider>
);

describe('AutocompleteAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue(mockCountriesResponse);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI url="https://usmanlive.com/wp-json/api/countries?q={{value}}" />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            label="Select Country"
          />
        </TestWrapper>
      );

      expect(screen.getByText('Select Country')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            placeholder="Type to search countries..."
          />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Type to search countries...')).toBeInTheDocument();
    });

    it('shows error when URL is missing', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI label="Country" />
        </TestWrapper>
      );

      expect(screen.getByText('URL configuration is required')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('API Integration', () => {
    it('makes API call when user types', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Unit');

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://usmanlive.com/wp-json/api/countries?q=Unit',
          expect.objectContaining({ signal: expect.anything() }),
        );
      }, { timeout: 200 });
    });

    it('replaces template variables in URL', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}&limit=5"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://usmanlive.com/wp-json/api/countries?q=test&limit=5',
          expect.objectContaining({ signal: expect.anything() }),
        );
      });
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('[AutocompleteAPI] Error fetching results:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles non-array response data', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockedAxios.get.mockResolvedValueOnce({ data: 'invalid response' });

      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[AutocompleteAPI] Expected results type of array, "string" received'
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Data Mapping', () => {
    it('maps data with textPath and valuePath', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            textPath="name"
            valuePath="code"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Unit');

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
    });

    it('maps data with only valuePath', async () => {
      const user = userEvent.setup();
      
      mockedAxios.get.mockResolvedValueOnce({
        data: ['USA', 'UK', 'Canada']
      });

      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'U');

      await waitFor(() => {
        expect(screen.getByText('USA')).toBeInTheDocument();
      });
    });

    it('uses resultsPath to extract nested data', async () => {
      const user = userEvent.setup();
      
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          countries: [
            { name: 'United States', code: 'US' },
            { name: 'United Kingdom', code: 'UK' }
          ]
        }
      });

      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            resultsPath="countries"
            textPath="name"
            valuePath="code"
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Unit');

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
    });
  });

  describe('Trigger Modes', () => {
    it('works with debounce trigger', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="debounce"
            rate={300}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Should not call API immediately
      expect(mockedAxios.get).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://usmanlive.com/wp-json/api/countries?q=test',
          expect.objectContaining({ signal: expect.anything() }),
        );
      });
    });

    it('works with throttle trigger', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            trigger="throttle"
            rate={300}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Should not call API immediately
      expect(mockedAxios.get).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://usmanlive.com/wp-json/api/countries?q=test',
          expect.objectContaining({ signal: expect.anything() }),
        );
      });
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when value changes', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            onChange={onChange}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      expect(onChange).toHaveBeenCalledWith('test');
    });

    it('calls onFocus and onBlur handlers', async () => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      
      await user.click(input);
      expect(onFocus).toHaveBeenCalled();

      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });

    it('updates input value when external value prop changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            value="initial"
          />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('initial')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            value="updated"
          />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('updated')).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    it('respects limit prop', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          {/* The mock returns objects, so textPath/valuePath are required to
              get distinct options; without them every result stringifies to
              "[object Object]", dedupes to one entry, and never matches "U". */}
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            textPath="name"
            valuePath="code"
            limit={2}
            trigger="debounce"
            rate={100}
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'U');

      await waitFor(() => {
        // Should only show 2 options due to limit
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(2);
      });
    });

    it('can be disabled', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            disabled
          />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('can be required', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            required
            label="Country"
          />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox')).toBeRequired();
    });

    it('shows error state', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            error="This field is required"
          />
        </TestWrapper>
      );

      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('can be clearable', () => {
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            clearable
            value="test"
          />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
      // The clear button should be present (implementation depends on Mantine's internal structure)
    });
  });

  describe('Real API Integration Test', () => {
    it('works with the actual countries API structure', async () => {
      // Mock the actual API response structure
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          { name: 'United States', iso2: 'US' },
          { name: 'United Kingdom', iso2: 'GB' }
        ]
      });

      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AutocompleteAPI 
            url="https://usmanlive.com/wp-json/api/countries?q={{value}}"
            textPath="name"
            valuePath="iso2"
            trigger="debounce"
            rate={100}
            label="Select Country"
            placeholder="Type to search countries..."
          />
        </TestWrapper>
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Unit');

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          'https://usmanlive.com/wp-json/api/countries?q=Unit',
          expect.objectContaining({ signal: expect.anything() }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      });
    });
  });
});
