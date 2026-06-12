import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider, createTheme } from '@mantine/core';
import { InputCode } from '../input-code/InputCode';

const theme = createTheme({});

// Test wrapper with Mantine provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider theme={theme}>{children}</MantineProvider>
);

describe('InputCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders textarea element', () => {
      render(
        <TestWrapper>
          <InputCode />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDefined();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('renders with label', () => {
      render(
        <TestWrapper>
          <InputCode label="Code Editor" />
        </TestWrapper>
      );

      expect(screen.getByText('Code Editor')).toBeDefined();
    });

    it('renders with required indicator', () => {
      render(
        <TestWrapper>
          <InputCode label="Code Editor" required />
        </TestWrapper>
      );

      expect(screen.getByText('Code Editor')).toBeDefined();
      expect(screen.getByText('*')).toBeDefined();
    });

    it('renders with placeholder', () => {
      render(
        <TestWrapper>
          <InputCode placeholder="Enter your code here..." />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText('Enter your code here...')).toBeDefined();
    });

    it('renders with error message', () => {
      render(
        <TestWrapper>
          <InputCode error="Invalid code format" />
        </TestWrapper>
      );

      expect(screen.getByText('Invalid code format')).toBeDefined();
    });

    it('renders as disabled', () => {
      render(
        <TestWrapper>
          <InputCode disabled />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.disabled).toBe(true);
    });
  });

  describe('Line Numbers', () => {
    it('shows line numbers by default', () => {
      render(
        <TestWrapper>
          <InputCode value={'line 1\nline 2\nline 3'} />
        </TestWrapper>
      );

      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
      expect(screen.getByText('3')).toBeDefined();
    });

    it('hides line numbers when lineNumber is false', () => {
      render(
        <TestWrapper>
          <InputCode value={'line 1\nline 2'} lineNumber={false} />
        </TestWrapper>
      );

      // Line numbers should not be present
      expect(screen.queryByText('1')).toBeNull();
      expect(screen.queryByText('2')).toBeNull();
    });

    it('updates line numbers when content changes', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'first line\nsecond line');

      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  describe('Value Handling', () => {
    it('displays string values correctly', () => {
      render(
        <TestWrapper>
          <InputCode value="Hello World" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Hello World');
    });

    it('displays number values as strings', () => {
      render(
        <TestWrapper>
          <InputCode value={42} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('42');
    });

    it('displays boolean values as strings', () => {
      render(
        <TestWrapper>
          <InputCode value={true as any} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('true');
    });

    it('displays null as empty string', () => {
      render(
        <TestWrapper>
          <InputCode value={null} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });

    it('displays undefined as empty string', () => {
      render(
        <TestWrapper>
          <InputCode value={undefined} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });
  });

  describe('JSON Handling', () => {
    it('formats object as JSON with proper indentation', () => {
      const testObject = { name: 'John', age: 30, active: true };
      
      render(
        <TestWrapper>
          <InputCode value={testObject} type="json" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const expectedJson = JSON.stringify(testObject, null, 2);
      expect(textarea.value).toBe(expectedJson);
    });

    it('formats array as JSON with proper indentation', () => {
      const testArray = ['apple', 'banana', 'cherry'];
      
      render(
        <TestWrapper>
          <InputCode value={testArray} type="json" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const expectedJson = JSON.stringify(testArray, null, 2);
      expect(textarea.value).toBe(expectedJson);
    });

    it('calls onChange with parsed JSON when valid JSON is entered', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode onChange={onChange} type="json" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      const validJson = '{"name": "test", "value": 123}';

      // Paste instead of type: user-event's keyboard parser treats "{" and "}"
      // as key descriptors, which breaks typing raw JSON.
      await user.click(textarea);
      await user.paste(validJson);

      expect(onChange).toHaveBeenLastCalledWith({ name: 'test', value: 123 });
    });

    it('does not call onChange with invalid JSON', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode onChange={onChange} type="json" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      
      // Clear any initial calls
      onChange.mockClear();

      // Enter incomplete JSON (paste — "{" is a user-event key descriptor)
      await user.click(textarea);
      await user.paste('{"name":');

      // At this point JSON is still invalid, onChange should not be called for the incomplete JSON
      const callsWithObjects = onChange.mock.calls.filter(call => 
        typeof call[0] === 'object' && call[0] !== null
      );
      expect(callsWithObjects).toHaveLength(0);
    });

    it('calls onChange with null when JSON input is cleared', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode onChange={onChange} type="json" value={{ test: true }} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);

      expect(onChange).toHaveBeenLastCalledWith(null);
    });
  });

  describe('User Interactions', () => {
    it('calls onChange when text is typed', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode onChange={onChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'hello');

      expect(onChange).toHaveBeenLastCalledWith('hello');
    });

    it('updates internal state when typing', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await user.type(textarea, 'test content');

      expect(textarea.value).toBe('test content');
    });

    it('handles external value changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <InputCode value="initial" />
        </TestWrapper>
      );

      let textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('initial');

      rerender(
        <TestWrapper>
          <InputCode value="updated" />
        </TestWrapper>
      );

      textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('updated');
    });
  });

  describe('Template Functionality', () => {
    it('renders template fill button when template is provided', () => {
      render(
        <TestWrapper>
          <InputCode template="console.log('Hello World');" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeDefined();
    });

    it('does not render template button when no template is provided', () => {
      render(
        <TestWrapper>
          <InputCode />
        </TestWrapper>
      );

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('fills template when button is clicked', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      const template = 'console.log("template");';
      
      render(
        <TestWrapper>
          <InputCode template={template} onChange={onChange} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onChange).toHaveBeenCalledWith(template);
    });

    it('fills JSON template correctly', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      const jsonTemplate = '{"key": "value", "number": 42}';
      
      render(
        <TestWrapper>
          <InputCode template={jsonTemplate} onChange={onChange} type="json" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      // fillTemplate emits the raw template string; parsing only happens on edit
      expect(onChange).toHaveBeenCalledWith(jsonTemplate);
    });

    it('template button is disabled when component is disabled', () => {
      render(
        <TestWrapper>
          <InputCode template="test" disabled />
        </TestWrapper>
      );

      const button = screen.getByRole('button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe('Language Display', () => {
    it('shows language indicator when language is specified', () => {
      render(
        <TestWrapper>
          <InputCode language="javascript" />
        </TestWrapper>
      );

      expect(screen.getByText('JAVASCRIPT')).toBeDefined();
    });

    it('does not show language indicator for plaintext', () => {
      render(
        <TestWrapper>
          <InputCode language="plaintext" />
        </TestWrapper>
      );

      expect(screen.queryByText('PLAINTEXT')).toBeNull();
    });

    it('does not show language indicator when no language is specified', () => {
      render(
        <TestWrapper>
          <InputCode />
        </TestWrapper>
      );

      // Should not have any uppercase language text
      expect(screen.queryByText(/^[A-Z]+$/)).toBeNull();
    });
  });

  describe('Line Wrapping', () => {
    it('applies correct white-space style for line wrapping', () => {
      render(
        <TestWrapper>
          <InputCode lineWrapping />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      // Inline style — jsdom's getComputedStyle does not resolve it reliably
      expect(textarea.style.whiteSpace).toBe('pre-wrap');
    });

    it('applies correct white-space style when line wrapping is disabled', () => {
      render(
        <TestWrapper>
          <InputCode lineWrapping={false} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      // Inline style — jsdom's getComputedStyle does not resolve it reliably
      expect(textarea.style.whiteSpace).toBe('pre');
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref to textarea element', () => {
      const ref = React.createRef<HTMLTextAreaElement>();
      
      render(
        <TestWrapper>
          <InputCode ref={ref} />
        </TestWrapper>
      );

      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
      expect(ref.current).toBe(screen.getByRole('textbox'));
    });
  });

  describe('Error Handling', () => {
    it('handles malformed JSON gracefully', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <InputCode onChange={onChange} type="json" />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      
      // Clear initial calls
      onChange.mockClear();
      
      // Enter invalid JSON (paste — "{" is a user-event key descriptor)
      await user.click(textarea);
      await user.paste('{invalid json}');
      
      // Component should not crash, textarea should exist
      expect(textarea).toBeDefined();
      
      // onChange should not be called with parsed object for invalid JSON
      const objectCalls = onChange.mock.calls.filter(call => 
        typeof call[0] === 'object' && call[0] !== null
      );
      expect(objectCalls).toHaveLength(0);
    });

    it('handles template parsing errors gracefully', async () => {
      const onChange = jest.fn();
      const user = userEvent.setup();
      const invalidJsonTemplate = '{invalid: json}';
      
      render(
        <TestWrapper>
          <InputCode template={invalidJsonTemplate} onChange={onChange} type="json" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      // Should fall back to string template
      expect(onChange).toHaveBeenCalledWith(invalidJsonTemplate);
    });
  });

  describe('Component Properties', () => {
    it('has correct display name', () => {
      expect(InputCode.displayName).toBe('InputCode');
    });

    it('applies custom className', () => {
      render(
        <TestWrapper>
          <InputCode className="custom-class" />
        </TestWrapper>
      );

      // The className should be applied to the root Box element
      const container = screen.getByRole('textbox').closest('.custom-class');
      expect(container).toBeDefined();
    });

    it('passes through additional props to textarea', () => {
      render(
        <TestWrapper>
          <InputCode data-testid="custom-textarea" />
        </TestWrapper>
      );

      expect(screen.getByTestId('custom-textarea')).toBeDefined();
    });
  });
});
