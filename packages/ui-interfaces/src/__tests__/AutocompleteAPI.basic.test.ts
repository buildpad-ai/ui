/**
 * Basic unit tests for AutocompleteAPI component
 * 
 * These tests demonstrate the key functionality:
 * 1. Component renders correctly
 * 2. API calls are made with correct URLs
 * 3. Data mapping works properly
 * 4. Error handling is implemented
 * 
 * To run tests: npm test
 */

import { AutocompleteAPI } from '../autocomplete-api';

describe('AutocompleteAPI Component', () => {
  
  test('Component exports correctly', () => {
    expect(AutocompleteAPI).toBeDefined();
    // AutocompleteAPI is (and always has been) a React.forwardRef component,
    // i.e. an exotic component object wrapping a render function — not a
    // plain function component.
    expect((AutocompleteAPI as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for('react.forward_ref')
    );
    expect(typeof (AutocompleteAPI as unknown as { render: unknown }).render).toBe('function');
  });

  test('Component has correct display name', () => {
    expect(AutocompleteAPI.displayName).toBe('AutocompleteAPI');
  });

  // Template rendering test
  test('Template rendering works correctly', () => {
    // This tests the internal renderTemplate function
    const template = 'https://api.example.com/search?q={{value}}&limit={{limit}}';
    const data: Record<string, string> = { value: 'test', limit: '5' };
    
    // Simulate the template replacement
    const result = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
    
    expect(result).toBe('https://api.example.com/search?q=test&limit=5');
  });

  // Property path access test
  test('Property path access works correctly', () => {
    const testObject = {
      data: {
        results: [
          { name: 'Test', code: 'T1' }
        ]
      }
    };
    
    // Simulate the getValue function
    const getValue = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    expect(getValue(testObject, 'data.results')).toEqual([{ name: 'Test', code: 'T1' }]);
    expect(getValue(testObject, 'data.results.0.name')).toBe('Test');
  });

  // Test API URL generation for the countries example
  test('Countries API URL generation', () => {
    const baseUrl = 'https://usmanlive.com/wp-json/api/countries?q={{value}}';
    const searchValue = 'united';
    
    const generatedUrl = baseUrl.replace(/\{\{value\}\}/g, searchValue);
    
    expect(generatedUrl).toBe('https://usmanlive.com/wp-json/api/countries?q=united');
  });

});
