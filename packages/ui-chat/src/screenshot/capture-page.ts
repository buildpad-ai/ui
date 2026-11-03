/**
 * Screenshot capture using snapdom: renders the page itself, so there is no
 * screen-share prompt. (html2canvas 1.4.1 can't parse the modern CSS colour
 * functions Mantine emits.)
 *
 * Ported from the get-feedback widget (src/widget/ui/screenshot.ts) by way of the
 * Buildpad Platform's Ask AI panel; keep them in step.
 *
 * Reference: https://github.com/zumerlab/snapdom
 */

import { snapdom } from '@zumer/snapdom';
import type { RegionBounds } from './region-selector';

/**
 * Capture a screenshot of the current viewport, optionally cropped to a region.
 * Renders the document body to a canvas at device-pixel resolution and crops
 * to the requested region.
 *
 * @param bounds Optional rectangle (in viewport CSS pixels) to crop the result.
 *   When omitted, the entire visible viewport is returned.
 * @returns A PNG Blob, or null if capture fails.
 */
export async function capturePageRegion(bounds?: RegionBounds): Promise<Blob | null> {
  // DOM rasterization (snapdom, below) can't read cross-origin <iframe>
  // content — the browser blocks it for security. When the page has any
  // iframe (e.g. an embedded Figma/YouTube frame), try real pixel capture
  // via the Screen Capture API first, which sees actual rendered pixels.
  if (document.querySelector('iframe')) {
    const captured = await captureViaDisplayMedia(bounds);
    if (captured) return captured;
    // User cancelled the share picker, denied permission, or the API isn't
    // supported — fall through to the normal DOM capture below (the iframe
    // area will be blank, but the rest of the page is still captured).
  }

  try {
    const dpr = window.devicePixelRatio || 1;
    // snapdom already multiplies the output canvas by its `dpr` option (which
    // defaults to window.devicePixelRatio). Do NOT also pass `scale: dpr` —
    // that double-multiplies and makes our crop coordinates land at 1/dpr of
    // the intended position.
    // embedFonts (not in the widget): without the page's own web fonts the shot falls
    // back to a wider system font, and truncated labels lose their last letters.
    const capture = await snapdom(document.body, { embedFonts: true });
    const fullCanvas = await capture.toCanvas();

    // snapdom captures the entire <body>, not just the viewport. Translate the
    // viewport-relative `bounds` into document coordinates by adding the
    // current scroll offset. When no bounds are given, fall back to the
    // visible viewport so behavior matches the previous html2canvas-based
    // implementation.
    const cropCSS: RegionBounds = bounds
      ? {
          x: bounds.x + window.scrollX,
          y: bounds.y + window.scrollY,
          width: bounds.width,
          height: bounds.height,
        }
      : {
          x: window.scrollX,
          y: window.scrollY,
          width: window.innerWidth,
          height: window.innerHeight,
        };

    const outputCanvas = cropCanvas(fullCanvas, cropCSS, dpr);

    return await new Promise<Blob | null>((resolve) => {
      outputCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (error) {
    console.error('[assistant] Screenshot capture failed.', error);
    return null;
  }
}

/**
 * Capture the current tab's real rendered pixels via the Screen Capture API
 * (navigator.mediaDevices.getDisplayMedia), which — unlike DOM rasterization
 * — can see inside cross-origin iframes. Requires an explicit user gesture
 * (satisfied here since this only runs from the "take screenshot" button
 * click) and a secure context (HTTPS or localhost).
 *
 * `preferCurrentTab`/`displaySurface: 'browser'` are non-standard Chrome
 * hints that bias the browser's share picker toward "This Tab" — they're
 * not in the DOM lib types, hence the cast — and aren't guaranteed to be
 * honored. The crop below assumes the user picked the current tab; if they
 * picked a different tab/window/screen, the region will be mis-cropped.
 */
async function captureViaDisplayMedia(bounds?: RegionBounds): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
    } as DisplayMediaStreamOptions);

    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    if (video.readyState < 2) {
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });
    }

    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const ctx = frame.getContext('2d');
    if (!ctx || frame.width === 0 || frame.height === 0) return null;
    ctx.drawImage(video, 0, 0);

    const scaleX = video.videoWidth / window.innerWidth;
    const scaleY = video.videoHeight / window.innerHeight;
    const cropPx: RegionBounds = bounds
      ? {
          x: bounds.x * scaleX,
          y: bounds.y * scaleY,
          width: bounds.width * scaleX,
          height: bounds.height * scaleY,
        }
      : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };

    const outputCanvas = cropCanvas(frame, cropPx, 1);
    return await new Promise<Blob | null>((resolve) => {
      outputCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  } catch (error) {
    console.error('[assistant] Display-media screenshot capture failed.', error);
    return null;
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

/**
 * Crop a canvas to the given CSS-pixel bounds, scaling by devicePixelRatio
 * to convert from CSS coordinates to canvas-pixel coordinates.
 */
function cropCanvas(
  source: HTMLCanvasElement,
  bounds: RegionBounds,
  dpr: number
): HTMLCanvasElement {
  const sx = Math.max(0, Math.round(bounds.x * dpr));
  const sy = Math.max(0, Math.round(bounds.y * dpr));
  const sw = Math.max(1, Math.round(bounds.width * dpr));
  const sh = Math.max(1, Math.round(bounds.height * dpr));

  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;

  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}
