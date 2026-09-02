import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DatesProvider, DateInput } from '@mantine/dates';

// jsdom has no matchMedia; MantineProvider needs it for color-scheme detection.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }),
});

test('DatesProvider timezone setting has no effect on rendered picker value', () => {
  const instant = new Date('2025-01-01T23:30:00Z');
  const { container } = render(
    <MantineProvider>
      <DatesProvider settings={{ locale: 'en', ...({ timezone: 'Asia/Tokyo' } as object) }}>
        <DateInput value={instant} valueFormat="YYYY-MM-DD HH:mm" onChange={() => {}} />
      </DatesProvider>
    </MantineProvider>,
  );
  const input = container.querySelector('input') as HTMLInputElement;
  console.log(`TZ=${process.env.TZ} rendered="${input.value}"  (if timezone were honoured: "2025-01-02 08:30")`);
  expect(input.value).not.toBe('');
});
