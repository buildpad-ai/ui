/**
 * Region selector — drag a rectangle on the live page to choose a screenshot area.
 * Renders a transient fullscreen overlay over the page while the chat panel
 * is hidden.
 *
 * Ported from the get-feedback widget (src/widget/ui/region-selector.ts) by way of
 * the Buildpad Platform's Ask AI panel, so screenshots behave the same in all
 * three; keep them in step. Strings come in through `labels` (the `chat`
 * dictionary namespace), since this builds its DOM outside React.
 */

/** The selector's visible and accessible text. */
export interface RegionSelectorLabels {
  label: string;
  help: string;
}

/** A rectangle in viewport CSS pixels. */
export interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SIZE_PX = 10;
const Z_INDEX = 2147483647;

/**
 * Show a fullscreen drag-to-select overlay over the live page.
 *
 * Resolves with the selected region bounds in viewport CSS pixels, or `null` if the
 * user cancels (ESC, or click without drag, or selection smaller than the minimum).
 *
 * The overlay always tears itself down before the promise resolves.
 *
 * @param primaryColor CSS color used for the selection rectangle border.
 * @param labels The overlay's accessible name and its help line.
 */
export function selectRegion(primaryColor: string, labels: RegionSelectorLabels): Promise<RegionBounds | null> {
  return new Promise<RegionBounds | null>((resolve) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('aria-label', labels.label);
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: String(Z_INDEX),
      cursor: 'crosshair',
      userSelect: 'none',
      // Stop touch drags from scrolling the page while selecting.
      touchAction: 'none',
      // No background here — the dim mask comes from the selection's box-shadow,
      // so the page stays interactive-looking until the user starts dragging.
      // When no drag is active we still want a subtle hint of "selection mode":
      background: 'rgba(0, 0, 0, 0.25)',
    } as CSSStyleDeclaration);

    // Selection rectangle (created on mousedown, removed on cleanup)
    let selection: HTMLDivElement | null = null;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    const help = document.createElement('div');
    help.textContent = labels.help;
    Object.assign(help.style, {
      position: 'absolute',
      left: '50%',
      bottom: '24px',
      transform: 'translateX(-50%)',
      padding: '8px 14px',
      background: 'rgba(15, 23, 42, 0.85)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      fontWeight: '500',
      borderRadius: '999px',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    overlay.appendChild(help);

    function cleanup(): void {
      window.removeEventListener('keydown', onKeyDown, true);
      overlay.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function finish(bounds: RegionBounds | null): void {
      cleanup();
      resolve(bounds);
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(null);
      }
    }

    function ensureSelection(): HTMLDivElement {
      if (selection) return selection;
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        border: `2px solid ${primaryColor}`,
        background: 'transparent',
        // Hole-punch dim effect: huge box-shadow darkens everything outside.
        boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.35)',
        pointerEvents: 'none',
      } as CSSStyleDeclaration);
      overlay.appendChild(el);
      selection = el;
      // Once a selection rect exists, the overlay's own dim background would
      // double up with the box-shadow — clear it so only the shadow dims.
      overlay.style.background = 'transparent';
      return el;
    }

    function updateSelection(curX: number, curY: number): void {
      const el = ensureSelection();
      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const w = Math.abs(curX - startX);
      const h = Math.abs(curY - startY);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }

    function onPointerDown(e: PointerEvent): void {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      updateSelection(startX, startY);
    }

    function onPointerMove(e: PointerEvent): void {
      if (!dragging) return;
      updateSelection(e.clientX, e.clientY);
    }

    function onPointerCancel(): void {
      if (!dragging) return;
      dragging = false;
      finish(null);
    }

    function onPointerUp(e: PointerEvent): void {
      if (!dragging) return;
      dragging = false;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const width = Math.abs(e.clientX - startX);
      const height = Math.abs(e.clientY - startY);

      if (width < MIN_SIZE_PX || height < MIN_SIZE_PX) {
        finish(null);
        return;
      }
      finish({ x, y, width, height });
    }

    overlay.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    // Capture-phase listener so consumer keydown handlers don't swallow ESC first.
    window.addEventListener('keydown', onKeyDown, true);

    document.body.appendChild(overlay);
  });
}
