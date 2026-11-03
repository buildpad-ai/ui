/**
 * Tests that prove the screenshot crop reads from the correct source region.
 *
 * Historical bug: passing `{ scale: dpr }` to snapdom — on top of snapdom's
 * own default `dpr: window.devicePixelRatio` — produced a canvas at
 * dpr² resolution, while the cropper only multiplied bounds by dpr¹. Result:
 * on Retina the crop landed at 1/dpr of the user's selected (x, y) and at
 * 1/dpr of the requested size.
 *
 * Strategy: jsdom has no canvas 2d implementation, so we don't render pixels.
 * Instead we mock snapdom + Canvas APIs and assert the (sx, sy, sw, sh) that
 * `drawImage` is called with. That is the math the bug was in.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- snapdom mock ------------------------------------------------------------

const snapdomCalls: Array<{ element: Element; options?: Record<string, unknown> }> = [];
let mockFullCanvas: HTMLCanvasElement;

vi.mock('@zumer/snapdom', () => ({
  snapdom: vi.fn(async (element: Element, options?: Record<string, unknown>) => {
    snapdomCalls.push({ element, options });
    return {
      toCanvas: async () => mockFullCanvas,
    };
  }),
}));

import { capturePageRegion as captureScreenshot } from '../src/screenshot/capture-page';

// --- helpers -----------------------------------------------------------------

interface DrawCall {
  source: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

interface Recording {
  draws: DrawCall[];
  outputCanvas: HTMLCanvasElement | null;
}

/**
 * Build a canvas sized exactly the way snapdom's default produces: device
 * pixels = cssDimension × dpr. (snapdom internally applies its own `dpr`
 * default, so the caller should not multiply by dpr again.)
 */
function buildFakeBodyCanvas(bodyCssW: number, bodyCssH: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = bodyCssW * dpr;
  c.height = bodyCssH * dpr;
  return c;
}

function setDpr(value: number): void {
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });
}

function setScroll(x: number, y: number): void {
  // jsdom's window.scrollTo is a no-op for the scroll position read by
  // scrollX/scrollY, so override the getters directly.
  Object.defineProperty(window, 'scrollX', { value: x, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
}

/**
 * Capture every drawImage(sx,sy,sw,sh,dx,dy,dw,dh) call and the canvas that
 * received it. Also stubs `toBlob` so captureScreenshot resolves.
 */
function recordCanvasOps(): Recording {
  const recording: Recording = { draws: [], outputCanvas: null };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    return {
      drawImage: (
        source: CanvasImageSource,
        sx: number,
        sy: number,
        sw: number,
        sh: number,
        dx: number,
        dy: number,
        dw: number,
        dh: number
      ) => {
        recording.outputCanvas = this;
        recording.draws.push({ source, sx, sy, sw, sh, dx, dy, dw, dh });
      },
    } as unknown as CanvasRenderingContext2D;
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback
  ) {
    cb(new Blob([], { type: 'image/png' }));
  });

  return recording;
}

// --- tests -------------------------------------------------------------------

describe('captureScreenshot crop math', () => {
  beforeEach(() => {
    snapdomCalls.length = 0;
    vi.restoreAllMocks();
    setScroll(0, 0);
  });

  it('does NOT pass scale:dpr to snapdom (regression guard)', async () => {
    setDpr(2);
    mockFullCanvas = buildFakeBodyCanvas(1000, 800, 2);
    recordCanvasOps();

    await captureScreenshot({ x: 0, y: 0, width: 10, height: 10 });

    expect(snapdomCalls).toHaveLength(1);
    // The bug was `{ scale: dpr }`. With dpr=2 that doubled snapdom's own dpr
    // application, producing a canvas at 4× CSS size while the crop math only
    // assumed 2×. Result: every selection landed at 1/dpr of its true position.
    expect(snapdomCalls[0].options?.scale).toBeUndefined();
  });

  it('crops at exactly bounds.x*dpr, bounds.y*dpr with bounds.width*dpr size (dpr=2)', async () => {
    setDpr(2);
    mockFullCanvas = buildFakeBodyCanvas(1000, 800, 2);
    const rec = recordCanvasOps();

    await captureScreenshot({ x: 100, y: 200, width: 300, height: 150 });

    expect(rec.draws).toHaveLength(1);
    const d = rec.draws[0];
    expect(d.sx).toBe(200); // 100 × 2
    expect(d.sy).toBe(400); // 200 × 2
    expect(d.sw).toBe(600); // 300 × 2
    expect(d.sh).toBe(300); // 150 × 2
    expect(rec.outputCanvas!.width).toBe(600);
    expect(rec.outputCanvas!.height).toBe(300);
  });

  it('crops at the requested location on dpr=3 (high-DPI)', async () => {
    setDpr(3);
    mockFullCanvas = buildFakeBodyCanvas(1000, 800, 3);
    const rec = recordCanvasOps();

    await captureScreenshot({ x: 400, y: 250, width: 100, height: 100 });

    const d = rec.draws[0];
    expect(d.sx).toBe(1200); // 400 × 3
    expect(d.sy).toBe(750); // 250 × 3
    expect(d.sw).toBe(300); // 100 × 3
    expect(d.sh).toBe(300); // 100 × 3
  });

  it('crops at bounds.x, bounds.y exactly on dpr=1', async () => {
    setDpr(1);
    mockFullCanvas = buildFakeBodyCanvas(1000, 800, 1);
    const rec = recordCanvasOps();

    await captureScreenshot({ x: 100, y: 100, width: 200, height: 200 });

    const d = rec.draws[0];
    expect(d.sx).toBe(100);
    expect(d.sy).toBe(100);
    expect(d.sw).toBe(200);
    expect(d.sh).toBe(200);
  });

  it('translates viewport-relative bounds into document coords using scrollY', async () => {
    setDpr(2);
    mockFullCanvas = buildFakeBodyCanvas(1000, 2000, 2);
    const rec = recordCanvasOps();

    setScroll(0, 500);
    await captureScreenshot({ x: 50, y: 100, width: 200, height: 200 });

    const d = rec.draws[0];
    // CSS y in document space = 100 + 500 = 600. Device px = 600 × 2 = 1200.
    expect(d.sy).toBe(1200);
    expect(d.sx).toBe(100); // 50 × 2 (scrollX is 0)
  });

  it('regression: with the OLD buggy call snapdom would have produced a canvas at dpr² — assert dpr factor in our crop is dpr¹ so the call to snapdom must omit scale:dpr', async () => {
    // This is a structural assertion: the crop multiplier is dpr (not dpr²),
    // so for the math to align, snapdom must be called WITHOUT scale:dpr.
    // We assert both together to prevent regressing one half of the contract.
    setDpr(2);
    mockFullCanvas = buildFakeBodyCanvas(1000, 800, 2);
    const rec = recordCanvasOps();

    await captureScreenshot({ x: 250, y: 250, width: 250, height: 250 });

    expect(snapdomCalls[0].options?.scale).toBeUndefined();
    const d = rec.draws[0];
    // crop multiplier visibly = dpr (=2), not dpr² (=4)
    expect(d.sx / 250).toBe(2);
    expect(d.sw / 250).toBe(2);
  });
});
