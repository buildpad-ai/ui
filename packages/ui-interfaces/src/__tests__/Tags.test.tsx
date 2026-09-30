import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import { Tags } from '../tags/Tags';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('Tags', () => {
  it('renders with default props', () => {
    renderWithProvider(<Tags />);
    
    // Check if input is present when allowCustom is true (default)
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with label when provided', () => {
    renderWithProvider(
      <Tags label="Tags Field" />
    );
    
    expect(screen.getByText('Tags Field')).toBeInTheDocument();
  });

  it('shows preset tags as chips', () => {
    renderWithProvider(
      <Tags presets={['React', 'Vue', 'Angular']} />
    );
    
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.getByText('Angular')).toBeInTheDocument();
  });

  it('handles preset tag selection', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        presets={['React', 'Vue', 'Angular']} 
        onChange={mockOnChange}
      />
    );
    
    const reactChip = screen.getByText('React');
    fireEvent.click(reactChip);
    
    expect(mockOnChange).toHaveBeenCalledWith(['React']);
  });

  it('handles custom tag input with Enter key', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags onChange={mockOnChange} allowCustom />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Custom Tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledWith(['Custom Tag']);
  });

  it('handles custom tag input with comma separator', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        onChange={mockOnChange} 
        allowCustom
        presets={['preset1', 'preset2']} // Force it to use TextInput path
      />
    );
    
    const input = screen.getByRole('textbox');
    
    // Type text and comma
    fireEvent.change(input, { target: { value: 'Custom Tag' } });
    fireEvent.keyDown(input, { key: ',' });
    
    // Should process the tag and call onChange
    expect(mockOnChange).toHaveBeenCalledWith(['Custom Tag']);
  });

  it('handles tag input with TagsInput component (no presets)', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags onChange={mockOnChange} allowCustom />
    );
    
    const input = screen.getByRole('textbox');
    
    // Direct value change should work with Mantine TagsInput
    fireEvent.change(input, { target: { value: 'Test Tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledWith(['Test Tag']);
  });

  it('shows required indicator when required', () => {
    renderWithProvider(
      <Tags label="Tags Field" required />
    );
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    renderWithProvider(
      <Tags error="This field is required" />
    );
    
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  // The transform options are the `uppercase` / `lowercase` / `capitalize` /
  // `trim` booleans the DaaS tags config uses (see Tags.stories.tsx and the
  // TC42-TC44 storybook specs). These cases were written against DaaS-style
  // `capitalization="..."` / `whitespace="-"` props that this component has
  // never had, so they were silently ignored.
  //
  // Each case also asserts a single onChange: Enter used to be listed in
  // TagsInput's `splitChars`, which Mantine turns into the regex class
  // `[,Enter]`, so Enter split the typed tag on the letters E/n/t/e/r
  // ("lowercase tag" -> ["low", "cas", "ag"]) before adding the whole tag.
  it('processes tags with uppercase capitalization', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        onChange={mockOnChange} 
        uppercase
        allowCustom 
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'lowercase tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(['LOWERCASE TAG']);
  });

  it('processes tags with lowercase capitalization', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        onChange={mockOnChange} 
        lowercase
        allowCustom 
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'UPPERCASE TAG' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(['uppercase tag']);
  });

  // There is no whitespace-replacement option; whitespace handling is `trim`
  // (on by default): surrounding whitespace is dropped, inner spaces kept.
  it('handles whitespace trimming', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        onChange={mockOnChange} 
        allowCustom 
      />
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  tag with spaces  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(['tag with spaces']);
  });

  it('splits typed input on commas', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(<Tags onChange={mockOnChange} allowCustom />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'react, vue' } });
    fireEvent.keyDown(input, { key: ',' });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(['react', 'vue']);
  });

  it('handles disabled state', () => {
    renderWithProvider(
      <Tags disabled />
    );
    
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('handles array value prop', () => {
    renderWithProvider(
      <Tags value={['Tag1', 'Tag2']} presets={['Tag1', 'Tag2', 'Tag3']} />
    );
    
    // Preset chips should show as selected
    const tag1Chip = screen.getByText('Tag1');
    const tag2Chip = screen.getByText('Tag2');
    
    expect(tag1Chip).toBeInTheDocument();
    expect(tag2Chip).toBeInTheDocument();
  });

  it('filters out custom tags when allowCustom is false', () => {
    const mockOnChange = jest.fn();
    renderWithProvider(
      <Tags 
        onChange={mockOnChange}
        presets={['React', 'Vue']}
        allowCustom={false}
        value={['React', 'CustomTag']} // CustomTag should be filtered out
      />
    );
    
    // Should not show input when allowCustom is false
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    
    // Should only show preset tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
    expect(screen.queryByText('CustomTag')).not.toBeInTheDocument();
  });

  // A field whose array<->string cast is not wired up — a `csv` column, or one
  // still being migrated — hands this interface a raw string. `value.map` threw
  // on that and took the whole form down with it, so the value is ignored and
  // the field renders empty instead.
  it('renders an empty tag list when the value is not an array', () => {
    expect(() =>
      renderWithProvider(
        <Tags value={'react,vue' as unknown as string[]} data-testid="tags-field" />
      )
    ).not.toThrow();

    expect(screen.getByTestId('tags-field')).toBeInTheDocument();
    expect(screen.queryByText('react,vue')).not.toBeInTheDocument();
    expect(screen.queryByText('react')).not.toBeInTheDocument();
  });
});
