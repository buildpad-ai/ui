import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { InputCode } from '../input-code/InputCode';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('InputCode', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders textarea element', () => {
    render(
      <TestWrapper>
        <InputCode onChange={mockOnChange} />
      </TestWrapper>
    );

    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('renders with label', () => {
    render(
      <TestWrapper>
        <InputCode label="Test Label" onChange={mockOnChange} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Label')).toBeDefined();
  });

  it('displays string values correctly', () => {
    render(
      <TestWrapper>
        <InputCode value="test string" onChange={mockOnChange} />
      </TestWrapper>
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('test string');
  });

  it('calls onChange when textarea value changes', () => {
    render(
      <TestWrapper>
        <InputCode onChange={mockOnChange} />
      </TestWrapper>
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test content' } });

    expect(mockOnChange).toHaveBeenCalledWith('test content');
  });

  it('shows line numbers by default', () => {
    render(
      <TestWrapper>
        <InputCode value="line 1" onChange={mockOnChange} />
      </TestWrapper>
    );

    expect(screen.getByText('1')).toBeDefined();
  });

  it('renders template fill button when template is provided', () => {
    render(
      <TestWrapper>
        <InputCode 
          template="Hello {{name}}" 
          onChange={mockOnChange} 
        />
      </TestWrapper>
    );

    // The button contains an icon, so we check for the button element
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('fills template when button is clicked', () => {
    render(
      <TestWrapper>
        <InputCode 
          template="Hello {{name}}" 
          onChange={mockOnChange} 
        />
      </TestWrapper>
    );

    const fillButton = screen.getByRole('button');
    fireEvent.click(fillButton);

    expect(mockOnChange).toHaveBeenCalledWith('Hello {{name}}');
  });

  it('forwards ref to textarea element', () => {
    const ref = React.createRef<HTMLTextAreaElement>();

    render(
      <TestWrapper>
        <InputCode ref={ref} onChange={mockOnChange} />
      </TestWrapper>
    );

    expect(ref.current).toBeDefined();
    expect(ref.current?.tagName).toBe('TEXTAREA');
  });

  describe('non-string values', () => {
    it('renders an array value as pretty-printed JSON without crashing', () => {
      render(
        <TestWrapper>
          <InputCode value={['bug', 'feature']} onChange={mockOnChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(JSON.stringify(['bug', 'feature'], null, 2));
    });

    it('renders an object value as pretty-printed JSON with matching line numbers', () => {
      const value = { enabled: true, count: 2 };
      render(
        <TestWrapper>
          <InputCode value={value} onChange={mockOnChange} />
        </TestWrapper>
      );

      const pretty = JSON.stringify(value, null, 2);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(pretty);
      // Line numbers reflect the pretty-printed line count
      expect(screen.getByText(String(pretty.split('\n').length))).toBeDefined();
    });

    it('renders numeric and boolean values as their string representation', () => {
      const { rerender } = render(
        <TestWrapper>
          <InputCode value={42} onChange={mockOnChange} />
        </TestWrapper>
      );

      let textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('42');

      rerender(
        <TestWrapper>
          <InputCode value={false} onChange={mockOnChange} />
        </TestWrapper>
      );

      textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('false');
    });

    it('renders an empty editor for null and undefined values', () => {
      const { rerender } = render(
        <TestWrapper>
          <InputCode value={null} onChange={mockOnChange} />
        </TestWrapper>
      );

      let textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');

      rerender(
        <TestWrapper>
          <InputCode value={undefined} onChange={mockOnChange} />
        </TestWrapper>
      );

      textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('');
    });
  });

  describe('structured field save path', () => {
    it('emits the parsed value for valid JSON when type is "json"', () => {
      render(
        <TestWrapper>
          <InputCode type="json" onChange={mockOnChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '["bug", "idea"]' } });

      expect(mockOnChange).toHaveBeenCalledWith(['bug', 'idea']);
    });

    it('emits the parsed value for valid JSON when language is "json"', () => {
      render(
        <TestWrapper>
          <InputCode language="json" onChange={mockOnChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '{"a": 1}' } });

      expect(mockOnChange).toHaveBeenCalledWith({ a: 1 });
    });

    it('emits the raw string for invalid JSON mid-edit without crashing', () => {
      render(
        <TestWrapper>
          <InputCode type="json" onChange={mockOnChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '["bug",' } });

      expect(mockOnChange).toHaveBeenCalledWith('["bug",');
    });

    it('keeps emitting raw strings for plain string fields', () => {
      render(
        <TestWrapper>
          <InputCode type="text" onChange={mockOnChange} />
        </TestWrapper>
      );

      const textarea = screen.getByRole('textbox');
      // Valid JSON content in a non-structured field must NOT be parsed
      fireEvent.change(textarea, { target: { value: '[1, 2]' } });

      expect(mockOnChange).toHaveBeenCalledWith('[1, 2]');
    });
  });
});
