import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextDecoder, TextEncoder } from 'util';

// jsdom implements neither TextEncoder/TextDecoder nor URL.createObjectURL,
// but maplibre-gl (pulled in by the package barrel via MapWithRealMap) touches
// both at module load (it builds its worker from a Blob URL). Without these,
// any test importing '@buildpad/ui-interfaces' fails to load. Tests that care
// about object URLs still override createObjectURL with their own jest.fn().
if (typeof globalThis.TextDecoder === 'undefined') {
  Object.assign(globalThis, { TextDecoder, TextEncoder });
}
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = jest.fn(() => 'blob:mock');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = jest.fn();
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// jsdom does not implement scrollIntoView, but Mantine's combobox calls it
// on every highlight move — without this, any test that arrow-keys through
// a dropdown throws, which makes keyboard interaction untestable across the
// whole Select* family.
Element.prototype.scrollIntoView = jest.fn();

// Mock getComputedStyle for Mantine: blank out --mantine-* custom properties.
// Patch getPropertyValue on the real CSSStyleDeclaration rather than spreading
// it into a plain object — the named properties (display, visibility,
// opacity, ...) are prototype accessors, so a spread dropped them and every
// element looked `display: undefined`, which made jest-dom's toBeVisible()
// report hidden elements (e.g. a closed Mantine Collapse) as visible.
const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  const getPropertyValue = style.getPropertyValue.bind(style);
  style.getPropertyValue = (prop: string) => {
    if (prop.startsWith('--mantine')) {
      return '';
    }
    return getPropertyValue(prop);
  };
  return style;
};

// Keyboard input must not be paced by the wall clock.
//
// `userEvent.setup()` defaults to `delay: 0`, which awaits a real
// `setTimeout(0)` between keystrokes. On a loaded machine React's state flush
// for keystroke N can land *after* keystroke N+1 has been dispatched, so the
// next character is inserted against a stale value and selection — typing
// '#00FF' into Color produced '0#0000F'. The same pacing also made the suites
// wall-clock bound: Color went from 7.6s to 69s at load average 57, which is
// how four suites came to exceed Jest's 5s timeout in CI.
//
// `delay: null` dispatches a whole sequence synchronously inside one `act()`,
// so keystrokes cannot interleave with pending renders. It is set here rather
// than at the ~40 call sites because the failure is invisible when writing a
// test — it only appears under load — so a per-test opt-in would rot. An
// explicit `delay` at a call site still wins.
const { setup: userEventSetup } = userEvent;
userEvent.setup = (options = {}) => userEventSetup({ delay: null, ...options });

// `waitFor` / `findBy*` default to a 1s budget, which is a real-time budget:
// under parallel load a Mantine popover mount plus the state settle behind it
// can exceed it even though nothing is wrong. Give async utilities room, and
// keep the per-test ceiling well above the slowest legitimate suite (~1s per
// test unloaded) so a loaded machine reports real failures, not stopwatch ones.
configure({ asyncUtilTimeout: 5000 });
