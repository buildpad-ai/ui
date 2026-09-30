import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider, createTheme } from '@mantine/core';
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

const theme = createTheme({});

// Test wrapper with Mantine provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider theme={theme}>{children}</MantineProvider>
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

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
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
          // The component aborts in-flight requests, so it passes { signal }.
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
          // The component aborts in-flight requests, so it passes { signal }.
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
          // The component aborts in-flight requests, so it passes { signal }.
          expect.objectContaining({ signal: expect.anything() }),
        );
      });
    });
  });
});
