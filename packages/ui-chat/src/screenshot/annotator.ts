/**
 * Screenshot annotator — draw pen strokes, lines, rectangles, arrows, and text
 * on top of a screenshot or image before it's attached to an Ask AI question.
 *
 * Renders a transient fullscreen overlay over the page (same pattern as
 * region-selector.ts).
 *
 * Ported from the get-feedback widget (src/widget/ui/annotator.ts) by way of the
 * Buildpad Platform's Ask AI panel, so screenshots behave the same in all three;
 * keep them in step. Strings come in through `labels` (the `chat` dictionary
 * namespace), since this builds its DOM outside React.
 */

const Z_INDEX = 2147483647;
const FIXED_PALETTE = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#18181b'];

/** Text annotation size in on-screen (CSS) pixels while annotating; drawn TEXT_SIZE * displayScale canvas px so it looks the same as when typed. */
const TEXT_SIZE = 36;

type ToolType = 'select' | 'pen' | 'line' | 'rect' | 'arrow' | 'text';

interface Shape {
  type: ToolType;
  color: string;
  points?: { x: number; y: number }[]; // pen
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number; // line, arrow
  x?: number;
  y?: number;
  w?: number;
  h?: number; // rect
  text?: string; // text
}

/** The annotator's visible and accessible text. `color` holds a `{color}` placeholder. */
export interface AnnotatorLabels {
  label: string;
  select: string;
  pen: string;
  line: string;
  rectangle: string;
  arrow: string;
  text: string;
  color: string;
  undo: string;
  undoTitle: string;
  clear: string;
  clearTitle: string;
  cancel: string;
  cancelTitle: string;
  done: string;
  doneTitle: string;
}

/**
 * Open the annotator over the given screenshot blob.
 * Resolves with the annotated PNG blob, or null if the user cancels.
 */
export function openAnnotator(blob: Blob, primaryColor: string, labels: AnnotatorLabels): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      buildEditor(img, objectUrl, primaryColor, labels, (result) => {
        URL.revokeObjectURL(objectUrl);
        resolve(result);
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

function buildEditor(
  img: HTMLImageElement,
  _imgUrl: string,
  primaryColor: string,
  labels: AnnotatorLabels,
  finish: (result: Blob | null) => void
): void {
  const shapes: Shape[] = [];
  let currentShape: Shape | null = null;
  let currentTool: ToolType = 'pen';
  let currentColor = FIXED_PALETTE[0];
  let drawing = false;
  let selectedIndex: number | null = null;
  let dragStart: { x: number; y: number } | null = null;
  let dragOrigin: Shape | null = null;

  const overlay = document.createElement('div');
  overlay.setAttribute('aria-label', labels.label);
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: String(Z_INDEX),
    background: 'rgba(15, 23, 42, 0.75)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as CSSStyleDeclaration);

  const style = document.createElement('style');
  style.textContent = getAnnotatorStyles(primaryColor);
  overlay.appendChild(style);

  // --- Toolbar ---
  const toolbar = document.createElement('div');
  toolbar.className = 'annotator-toolbar';

  const toolButtons: Partial<Record<ToolType, HTMLButtonElement>> = {};
  const tools: { type: ToolType; label: string; key: string; svg: string }[] = [
    { type: 'select', label: labels.select, key: 'V', svg: '<path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/>' },
    { type: 'pen', label: labels.pen, key: 'P', svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' },
    { type: 'line', label: labels.line, key: 'L', svg: '<line x1="5" y1="19" x2="19" y2="5"/>' },
    { type: 'rect', label: labels.rectangle, key: 'R', svg: '<rect x="4" y="6" width="16" height="12" rx="1"/>' },
    { type: 'arrow', label: labels.arrow, key: 'A', svg: '<line x1="5" y1="19" x2="19" y2="5"/><path d="M19 5v6M19 5h-6"/>' },
    { type: 'text', label: labels.text, key: 'T', svg: '<path d="M5 5h14M12 5v14"/>' },
  ];

  const toolGroup = document.createElement('div');
  toolGroup.className = 'annotator-tool-group';
  tools.forEach(({ type, label, key, svg }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'annotator-tool-btn';
    btn.setAttribute('aria-label', `${label} (${key})`);
    btn.title = `${label} (${key})`;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;
    btn.addEventListener('click', () => selectTool(type));
    toolGroup.appendChild(btn);
    toolButtons[type] = btn;
  });
  toolbar.appendChild(toolGroup);

  function selectTool(type: ToolType): void {
    currentTool = type;
    if (type !== 'select') {
      selectedIndex = null;
    }
    canvas.classList.toggle('annotator-select-cursor', type === 'select');
    updateToolButtons();
    render();
  }

  function updateToolButtons(): void {
    (Object.keys(toolButtons) as ToolType[]).forEach((t) => {
      toolButtons[t]?.classList.toggle('active', t === currentTool);
    });
  }
  updateToolButtons();

  // Color palette
  const paletteGroup = document.createElement('div');
  paletteGroup.className = 'annotator-palette-group';
  const swatches: HTMLButtonElement[] = [];
  FIXED_PALETTE.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'annotator-swatch';
    swatch.setAttribute('aria-label', labels.color.replace('{color}', color));
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      currentColor = color;
      updateSwatches();
    });
    paletteGroup.appendChild(swatch);
    swatches.push(swatch);
  });
  toolbar.appendChild(paletteGroup);

  function updateSwatches(): void {
    swatches.forEach((s, i) => {
      s.classList.toggle('active', FIXED_PALETTE[i] === currentColor);
    });
  }
  updateSwatches();

  // Undo / clear
  const actionGroup = document.createElement('div');
  actionGroup.className = 'annotator-action-group';

  const undoBtn = document.createElement('button');
  undoBtn.type = 'button';
  undoBtn.className = 'annotator-action-btn';
  undoBtn.textContent = labels.undo;
  undoBtn.title = labels.undoTitle;
  undoBtn.addEventListener('click', undo);
  actionGroup.appendChild(undoBtn);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'annotator-action-btn';
  clearBtn.textContent = labels.clear;
  clearBtn.title = labels.clearTitle;
  clearBtn.addEventListener('click', clearAll);
  actionGroup.appendChild(clearBtn);
  toolbar.appendChild(actionGroup);

  function undo(): void {
    shapes.pop();
    selectedIndex = null;
    render();
  }

  function clearAll(): void {
    shapes.length = 0;
    selectedIndex = null;
    render();
  }

  function deleteSelected(): void {
    if (selectedIndex === null) return;
    shapes.splice(selectedIndex, 1);
    selectedIndex = null;
    render();
  }

  // Cancel / Done
  const finishGroup = document.createElement('div');
  finishGroup.className = 'annotator-finish-group';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'annotator-cancel-btn';
  cancelBtn.textContent = labels.cancel;
  cancelBtn.title = labels.cancelTitle;
  cancelBtn.addEventListener('click', cancel);
  finishGroup.appendChild(cancelBtn);

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'annotator-done-btn';
  doneBtn.style.background = primaryColor;
  doneBtn.textContent = labels.done;
  doneBtn.title = labels.doneTitle;
  doneBtn.addEventListener('click', done);
  finishGroup.appendChild(doneBtn);
  toolbar.appendChild(finishGroup);

  function cancel(): void {
    cleanup();
    finish(null);
  }

  async function done(): Promise<void> {
    const result = await new Promise<Blob | null>((res) => {
      canvas.toBlob((b) => res(b), 'image/png');
    });
    cleanup();
    finish(result);
  }

  overlay.appendChild(toolbar);

  // --- Canvas stage ---
  const stage = document.createElement('div');
  stage.className = 'annotator-stage';

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  stage.appendChild(canvas);
  overlay.appendChild(stage);

  document.body.appendChild(overlay);

  // Fit canvas within available space via CSS while keeping pixel resolution.
  fitCanvasToStage();
  window.addEventListener('resize', fitCanvasToStage);

  function fitCanvasToStage(): void {
    const maxW = Math.min(window.innerWidth * 0.92, canvas.width);
    const maxH = Math.min(window.innerHeight * 0.78, canvas.height);
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
  }

  function displayScale(): number {
    const rect = canvas.getBoundingClientRect();
    return canvas.width / rect.width;
  }

  function toCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const s = displayScale();
    return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
  }

  function render(): void {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    shapes.forEach((s) => drawShape(ctx, s, displayScale()));
    if (currentShape) drawShape(ctx, currentShape, displayScale());
    if (selectedIndex !== null && shapes[selectedIndex]) {
      drawSelectionOutline(ctx, getShapeBounds(ctx, shapes[selectedIndex], displayScale()), displayScale());
    }
  }

  // --- Pointer handling ---
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const pt = toCanvasPoint(e);

    if (currentTool === 'select') {
      const hitIndex = findShapeAt(pt);
      selectedIndex = hitIndex;
      if (hitIndex !== null) {
        drawing = true;
        dragStart = pt;
        dragOrigin = cloneShape(shapes[hitIndex]);
        canvas.setPointerCapture(e.pointerId);
      }
      render();
      return;
    }

    if (currentTool === 'text') {
      // Prevent the browser's default focus handling (which runs on the
      // subsequent mouseup/click) from stealing focus back away from the
      // text input we're about to create and focus, which would otherwise
      // immediately blur it and discard the text before typing starts.
      e.preventDefault();
      openTextInput(pt);
      return;
    }

    drawing = true;
    canvas.setPointerCapture(e.pointerId);

    if (currentTool === 'pen') {
      currentShape = { type: 'pen', color: currentColor, points: [pt] };
    } else if (currentTool === 'rect') {
      currentShape = { type: 'rect', color: currentColor, x1: pt.x, y1: pt.y, x: pt.x, y: pt.y, w: 0, h: 0 };
    } else {
      currentShape = { type: currentTool, color: currentColor, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
    }
    render();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (currentTool === 'select') {
      if (!drawing || selectedIndex === null || !dragStart || !dragOrigin) return;
      const pt = toCanvasPoint(e);
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      shapes[selectedIndex] = translateShape(dragOrigin, dx, dy);
      render();
      return;
    }

    if (!drawing || !currentShape) return;
    const pt = toCanvasPoint(e);

    if (currentShape.type === 'pen') {
      currentShape.points!.push(pt);
    } else if (currentShape.type === 'rect') {
      const startX = currentShape.x!;
      const startY = currentShape.y!;
      currentShape.x = Math.min(startX, pt.x);
      currentShape.y = Math.min(startY, pt.y);
      currentShape.w = Math.abs(pt.x - startX);
      currentShape.h = Math.abs(pt.y - startY);
    } else {
      currentShape.x2 = pt.x;
      currentShape.y2 = pt.y;
    }
    render();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (currentTool === 'select') {
      if (!drawing) return;
      drawing = false;
      dragStart = null;
      dragOrigin = null;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }

    if (!drawing || !currentShape) return;
    drawing = false;
    canvas.releasePointerCapture(e.pointerId);
    shapes.push(currentShape);
    currentShape = null;
    render();
  });

  function openTextInput(pt: { x: number; y: number }): void {
    const rect = canvas.getBoundingClientRect();
    const s = displayScale();

    const input = document.createElement('div');
    input.contentEditable = 'true';
    input.className = 'annotator-text-input';
    input.style.left = `${rect.left + pt.x / s}px`;
    input.style.top = `${rect.top + pt.y / s}px`;
    input.style.color = currentColor;
    // Same on-screen size as the text will have once drawn (drawShape sizes text TEXT_SIZE * displayScale canvas px).
    input.style.fontSize = `${TEXT_SIZE}px`;
    document.body.appendChild(input);
    // Defer focus to the next frame — Safari in particular can still steal
    // focus back at pointerup even with preventDefault() on pointerdown if
    // focus() is called synchronously within the same pointerdown handler.
    requestAnimationFrame(() => input.focus());

    function commit(): void {
      const text = input.textContent?.trim() ?? '';
      input.remove();
      if (text) {
        shapes.push({ type: 'text', color: currentColor, x: pt.x, y: pt.y, text });
        render();
      }
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ke) => {
      // Stop propagation so the window-level tool/undo/done shortcuts below
      // don't fire while the user is typing text (e.g. typing "r" or "z").
      ke.stopPropagation();
      if (ke.key === 'Enter' && !ke.shiftKey) {
        ke.preventDefault();
        input.blur();
      } else if (ke.key === 'Escape') {
        input.textContent = '';
        input.blur();
      }
    });
  }

  // --- Keyboard shortcuts ---
  const TOOL_SHORTCUTS: Record<string, ToolType> = {
    v: 'select',
    p: 'pen',
    l: 'line',
    r: 'rect',
    a: 'arrow',
    t: 'text',
  };

  function onKeyDown(e: KeyboardEvent): void {
    // This listener runs in the capture phase (so Escape/undo/done work even
    // when focus is elsewhere), which means it sees the keydown before the
    // text input's own bubble-phase handler gets a chance to stopPropagation.
    // Ignore all shortcuts while the text-annotation input is focused so
    // typing isn't hijacked into switching tools.
    const target = e.target as HTMLElement | null;
    if (target?.classList.contains('annotator-text-input')) return;

    const isMeta = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }

    if (isMeta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      void done();
      return;
    }

    if (e.key === 'Backspace' && isMeta) {
      e.preventDefault();
      clearAll();
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && currentTool === 'select' && selectedIndex !== null) {
      e.preventDefault();
      deleteSelected();
      return;
    }

    const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
    if (tool && !isMeta) {
      e.preventDefault();
      selectTool(tool);
    }
  }
  // Capture phase so this always sees the key before other page listeners.
  window.addEventListener('keydown', onKeyDown, true);

  function findShapeAt(pt: { x: number; y: number }): number | null {
    if (!ctx) return null;
    const scale = displayScale();
    // Search topmost-first so overlapping shapes select the one drawn last.
    for (let i = shapes.length - 1; i >= 0; i--) {
      const b = getShapeBounds(ctx, shapes[i], scale);
      const pad = Math.max(8 * scale, 8);
      if (pt.x >= b.x - pad && pt.x <= b.x + b.w + pad && pt.y >= b.y - pad && pt.y <= b.y + b.h + pad) {
        return i;
      }
    }
    return null;
  }

  function cleanup(): void {
    window.removeEventListener('resize', fitCanvasToStage);
    window.removeEventListener('keydown', onKeyDown, true);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  render();
}

function cloneShape(s: Shape): Shape {
  return { ...s, points: s.points ? s.points.map((p) => ({ ...p })) : undefined };
}

function translateShape(s: Shape, dx: number, dy: number): Shape {
  const t = cloneShape(s);
  if (t.points) t.points = t.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (t.x1 !== undefined) t.x1 += dx;
  if (t.y1 !== undefined) t.y1 += dy;
  if (t.x2 !== undefined) t.x2 += dx;
  if (t.y2 !== undefined) t.y2 += dy;
  if (t.x !== undefined) t.x += dx;
  if (t.y !== undefined) t.y += dy;
  return t;
}

function getShapeBounds(ctx: CanvasRenderingContext2D, s: Shape, scale: number): { x: number; y: number; w: number; h: number } {
  switch (s.type) {
    case 'pen': {
      const pts = s.points || [];
      if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
    }
    case 'line':
    case 'arrow': {
      const minX = Math.min(s.x1!, s.x2!);
      const minY = Math.min(s.y1!, s.y2!);
      return { x: minX, y: minY, w: Math.abs(s.x2! - s.x1!), h: Math.abs(s.y2! - s.y1!) };
    }
    case 'rect':
      return { x: s.x!, y: s.y!, w: s.w!, h: s.h! };
    case 'text': {
      ctx.font = `${TEXT_SIZE * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const width = ctx.measureText(s.text || '').width;
      return { x: s.x!, y: s.y!, w: width, h: Math.round(TEXT_SIZE * scale * 1.2) };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  scale: number
): void {
  const pad = 6 * scale;
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([5 * scale, 4 * scale]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, scale: number): void {
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 3 * scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (s.type) {
    case 'pen': {
      const pts = s.points || [];
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }
    case 'line':
      ctx.beginPath();
      ctx.moveTo(s.x1!, s.y1!);
      ctx.lineTo(s.x2!, s.y2!);
      ctx.stroke();
      break;
    case 'rect':
      ctx.strokeRect(s.x!, s.y!, s.w!, s.h!);
      break;
    case 'arrow':
      drawArrow(ctx, s.x1!, s.y1!, s.x2!, s.y2!, scale);
      break;
    case 'text':
      ctx.font = `${TEXT_SIZE * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(s.text || '', s.x!, s.y!);
      break;
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  scale: number
): void {
  const headLength = 12 * scale;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

function getAnnotatorStyles(primaryColor: string): string {
  return `
    .annotator-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 16px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      margin-bottom: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .annotator-tool-group,
    .annotator-palette-group,
    .annotator-action-group,
    .annotator-finish-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .annotator-tool-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: #f4f4f5;
      color: #52525b;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .annotator-tool-btn:hover {
      background: #e4e4e7;
    }

    .annotator-tool-btn.active {
      background: ${primaryColor};
      color: #ffffff;
    }

    .annotator-swatch {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
    }

    .annotator-swatch.active {
      border-color: #18181b;
      transform: scale(1.15);
    }

    .annotator-action-btn {
      padding: 6px 12px;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      background: #ffffff;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    .annotator-action-btn:hover {
      background: #f4f4f5;
    }

    .annotator-cancel-btn {
      padding: 8px 16px;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      background: #ffffff;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .annotator-done-btn {
      padding: 8px 18px;
      border: none;
      border-radius: 6px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .annotator-stage {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .annotator-stage canvas {
      border-radius: 6px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      touch-action: none;
      cursor: crosshair;
    }

    .annotator-stage canvas.annotator-select-cursor {
      cursor: default;
    }

    .annotator-text-input {
      position: fixed;
      z-index: ${Z_INDEX};
      min-width: 20px;
      min-height: 1.2em;
      outline: 2px dashed rgba(255, 255, 255, 0.6);
      outline-offset: 2px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.2;
      white-space: pre;
      background: transparent;
    }
  `;
}
