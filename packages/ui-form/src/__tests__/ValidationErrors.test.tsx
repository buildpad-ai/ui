/**
 * ValidationErrors — the summary banner at the top of a form.
 *
 * It shipped with no tests at all (0% of its functions), which matters more
 * than the line count suggests: it is the only place the form explains *why*
 * a save was rejected, and three of its behaviours are easy to regress
 * silently —
 *
 *   - a custom `meta.validation_message` only applies to FAILED_VALIDATION;
 *   - an error on a field the user cannot see has to say so, naming the
 *     collapsed group when there is one, or the banner points at nothing;
 *   - clicking a field name falls back to scrolling the DOM when the host
 *     passes no `onScrollToField`.
 *
 * Strings are asserted against the English defaults in `utils`' `form`
 * namespace, which is what renders when no I18n provider is mounted.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { Field } from '@buildpad/types';
import { ValidationErrors } from '../components/ValidationErrors';
import type { ValidationError } from '../types';

const field = (f: string, meta: Record<string, unknown> | null = {}): Field =>
  ({ collection: 'articles', field: f, type: 'string', meta }) as Field;

function show(
  validationErrors: ValidationError[],
  fields: Field[] = [],
  onScrollToField?: (fieldKey: string) => void,
) {
  return render(
    <MantineProvider>
      <ValidationErrors validationErrors={validationErrors} fields={fields} onScrollToField={onScrollToField} />
    </MantineProvider>,
  );
}

describe('ValidationErrors — the banner itself', () => {
  test('renders nothing when there are no errors', () => {
    // MantineProvider injects its own <style> tags, so "empty" means no banner.
    show([]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('announces itself as an alert and counts the errors', () => {
    show([
      { field: 'title', type: 'required' },
      { field: 'slug', type: 'required' },
    ]);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('2 validation errors');
  });

  test('the count is singular for one error', () => {
    show([{ field: 'title', type: 'required' }]);
    expect(screen.getByRole('alert')).toHaveTextContent('1 validation error');
  });

  test('two errors on the same field both render', () => {
    show([
      { field: 'title', type: 'required' },
      { field: 'title', type: 'unique' },
    ]);
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    expect(screen.getByRole('alert')).toHaveTextContent('This value must be unique');
  });
});

describe('ValidationErrors — naming the field', () => {
  test('prefers the field label from meta.name', () => {
    show([{ field: 'title', type: 'required' }], [field('title', { name: 'Headline' })]);
    expect(screen.getByRole('button', { name: 'Headline' })).toBeInTheDocument();
  });

  test('falls back to the field key when meta has no name', () => {
    show([{ field: 'title', type: 'required' }], [field('title')]);
    expect(screen.getByRole('button', { name: 'title' })).toBeInTheDocument();
  });

  test('falls back to the key when the field is not in the schema at all', () => {
    show([{ field: 'ghost', type: 'required' }], [field('title')]);
    expect(screen.getByRole('button', { name: 'ghost' })).toBeInTheDocument();
  });

  test('unwraps a function-wrapped key like count(id)', () => {
    show([{ field: 'count(id)', type: 'required' }], [field('id', { name: 'ID' })]);
    expect(screen.getByRole('button', { name: 'ID' })).toBeInTheDocument();
  });

  test('a field with null meta is named by its key', () => {
    show([{ field: 'title', type: 'required' }], [field('title', null)]);
    expect(screen.getByRole('button', { name: 'title' })).toBeInTheDocument();
  });
});

describe('ValidationErrors — the message', () => {
  const messageOf = (error: ValidationError, fields: Field[] = []) => {
    show([error], fields);
    return screen.getByRole('alert').textContent ?? '';
  };

  test.each([
    ['required', 'This field is required'],
    ['unique', 'This value must be unique'],
    ['RECORD_NOT_UNIQUE', 'This value must be unique'],
    ['email', 'Must be a valid email address'],
    ['url', 'Must be a valid URL'],
    ['number', 'Must be a valid number'],
    ['FAILED_VALIDATION', 'Validation failed'],
  ])('type %s reads "%s"', (type, expected) => {
    expect(messageOf({ field: 'title', type })).toContain(expected);
  });

  test('an unrecognised type interpolates the generic message', () => {
    expect(messageOf({ field: 'title', type: 'regex' })).toContain('Validation error: regex');
  });

  test("the error's own message wins over the default for its type", () => {
    expect(messageOf({ field: 'title', type: 'required', message: 'Pick a headline' })).toContain('Pick a headline');
  });

  test('a custom validation_message wins over everything for FAILED_VALIDATION', () => {
    const text = messageOf(
      { field: 'title', type: 'FAILED_VALIDATION', code: 'FAILED_VALIDATION', message: 'generic failure' },
      [field('title', { validation_message: 'Headlines must be in title case' })],
    );
    expect(text).toContain('Headlines must be in title case');
    expect(text).not.toContain('generic failure');
  });

  test('a custom validation_message is ignored for any other code', () => {
    const text = messageOf(
      { field: 'title', type: 'required', code: 'RECORD_NOT_UNIQUE' },
      [field('title', { validation_message: 'Headlines must be in title case' })],
    );
    expect(text).toContain('This field is required');
    expect(text).not.toContain('title case');
  });
});

describe('ValidationErrors — errors on fields the user cannot see', () => {
  test('a visible field is not annotated', () => {
    show([{ field: 'title', type: 'required' }], [field('title')]);
    expect(screen.getByRole('alert')).not.toHaveTextContent('(hidden');
  });

  test('a directly hidden field is marked hidden', () => {
    show([{ field: 'title', type: 'required' }], [field('title', { hidden: true })]);
    expect(screen.getByRole('alert')).toHaveTextContent('(hidden)');
  });

  test('a field in a hidden group names the group', () => {
    show(
      [{ field: 'title', type: 'required' }],
      [field('title', { group: 'seo' }), field('seo', { hidden: true, name: 'SEO' })],
    );
    expect(screen.getByRole('alert')).toHaveTextContent('(hidden in group: SEO)');
  });

  test('a hidden group with no label falls back to its key', () => {
    show(
      [{ field: 'title', type: 'required' }],
      [field('title', { group: 'seo' }), field('seo', { hidden: true })],
    );
    expect(screen.getByRole('alert')).toHaveTextContent('(hidden in group: seo)');
  });

  test('a field in a visible group is not marked hidden', () => {
    show(
      [{ field: 'title', type: 'required' }],
      [field('title', { group: 'seo' }), field('seo', { name: 'SEO' })],
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('(hidden');
  });

  test('a group named in meta but absent from the schema is not treated as hidden', () => {
    show([{ field: 'title', type: 'required' }], [field('title', { group: 'missing' })]);
    expect(screen.getByRole('alert')).not.toHaveTextContent('(hidden');
  });
});

describe('ValidationErrors — clicking a field name', () => {
  test('calls onScrollToField with the field key', async () => {
    const onScrollToField = jest.fn();
    show([{ field: 'title', type: 'required' }], [field('title', { name: 'Headline' })], onScrollToField);

    await userEvent.click(screen.getByRole('button', { name: 'Headline' }));
    expect(onScrollToField).toHaveBeenCalledWith('title');
  });

  test('without a handler, scrolls the [data-field] element into view', async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { container } = render(
      <MantineProvider>
        <div data-field="title" />
        <ValidationErrors validationErrors={[{ field: 'title', type: 'required' }]} fields={[field('title')]} />
      </MantineProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'title' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(container.querySelector('[data-field="title"]')).toBeInTheDocument();
  });

  test('without a handler and with no matching element, the click is a no-op', async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    show([{ field: 'ghost', type: 'required' }]);
    await userEvent.click(screen.getByRole('button', { name: 'ghost' }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test('clicking one of several errors reports only that field', async () => {
    const onScrollToField = jest.fn();
    show(
      [
        { field: 'title', type: 'required' },
        { field: 'slug', type: 'required' },
      ],
      [field('title'), field('slug')],
      onScrollToField,
    );

    await userEvent.click(screen.getByRole('button', { name: 'slug' }));
    expect(onScrollToField).toHaveBeenCalledTimes(1);
    expect(onScrollToField).toHaveBeenCalledWith('slug');
  });
});

describe('ValidationErrors — per-instance translation overrides', () => {
  test('an override replaces one string and leaves the rest alone', () => {
    render(
      <MantineProvider>
        <ValidationErrors
          validationErrors={[{ field: 'title', type: 'required' }]}
          fields={[field('title')]}
          translations={{ validation: { required: 'Required, sorry' } }}
        />
      </MantineProvider>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Required, sorry');
    expect(alert).toHaveTextContent('1 validation error');
  });
});
