/**
 * Unit tests for the region-selector overlay.
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from 'vitest';
import { selectRegion } from '../src/screenshot/region-selector';

const LABELS = { label: 'Drag to select screenshot region', help: 'Drag to select · ESC to cancel' };

function findOverlay(): HTMLElement | null {
  // Overlay is the last fixed-position child of body with our crosshair cursor
  const els = Array.from(document.body.children) as HTMLElement[];
  return els.find((el) => el.style.cursor === 'crosshair') ?? null;
}

function mouseEvent(type: string, clientX: number, clientY: number, target: EventTarget): boolean {
  const ev = new MouseEvent(type, { clientX, clientY, button: 0, bubbles: true, cancelable: true });
  return target.dispatchEvent(ev);
}

describe('selectRegion', () => {
  afterEach(() => {
    // Belt-and-suspenders: tear down any lingering overlay between tests
    const overlay = findOverlay();
    if (overlay) overlay.remove();
  });

  it('renders a fullscreen overlay appended to document.body', () => {
    void selectRegion('#0066CC', LABELS);
    const overlay = findOverlay();
    expect(overlay).not.toBeNull();
    expect(overlay!.style.position).toBe('fixed');
    expect(overlay!.style.cursor).toBe('crosshair');
    // Cleanup so afterEach doesn't trip
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('resolves with bounds when user drags a rectangle larger than the minimum', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    const overlay = findOverlay()!;

    mouseEvent('pointerdown', 100, 200, overlay);
    mouseEvent('pointermove', 250, 400, window);
    mouseEvent('pointerup', 250, 400, window);

    const bounds = await promise;
    expect(bounds).toEqual({ x: 100, y: 200, width: 150, height: 200 });
  });

  it('normalizes a backwards drag (bottom-right to top-left)', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    const overlay = findOverlay()!;

    mouseEvent('pointerdown', 300, 400, overlay);
    mouseEvent('pointermove', 50, 100, window);
    mouseEvent('pointerup', 50, 100, window);

    const bounds = await promise;
    expect(bounds).toEqual({ x: 50, y: 100, width: 250, height: 300 });
  });

  it('resolves with null when ESC is pressed', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    expect(findOverlay()).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    const bounds = await promise;
    expect(bounds).toBeNull();
  });

  it('resolves with null when the drag is smaller than the minimum size', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    const overlay = findOverlay()!;

    mouseEvent('pointerdown', 100, 100, overlay);
    mouseEvent('pointermove', 105, 103, window);
    mouseEvent('pointerup', 105, 103, window);

    const bounds = await promise;
    expect(bounds).toBeNull();
  });

  it('resolves with null when the pointer gesture is cancelled', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    const overlay = findOverlay()!;

    mouseEvent('pointerdown', 100, 100, overlay);
    mouseEvent('pointercancel', 200, 200, window);

    const bounds = await promise;
    expect(bounds).toBeNull();
    expect(findOverlay()).toBeNull();
  });

  it('removes the overlay from the DOM after resolving', async () => {
    const promise = selectRegion('#0066CC', LABELS);
    expect(findOverlay()).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await promise;

    expect(findOverlay()).toBeNull();
  });

  it('uses the supplied primary color for the selection border', async () => {
    const promise = selectRegion('rgb(255, 0, 128)', LABELS);
    const overlay = findOverlay()!;

    mouseEvent('pointerdown', 100, 100, overlay);

    // The selection rect is appended on pointerdown
    const selection = Array.from(overlay.children).find(
      (el) => (el as HTMLElement).style.border?.includes('rgb(255, 0, 128)')
    ) as HTMLElement | undefined;
    expect(selection).toBeDefined();

    // Cleanup
    mouseEvent('pointerup', 100, 100, window);
    await promise;
  });
});
