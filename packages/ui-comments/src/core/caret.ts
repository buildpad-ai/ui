const COPIED = [
  'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
  'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize',
] as const;

/**
 * Where a character of a <textarea> is drawn, relative to its top-left corner (scroll accounted
 * for). Browser only: it measures a hidden mirror of the textarea.
 */
export function caretOffset(el: HTMLTextAreaElement, position: number): { top: number; left: number; height: number } {
  const computed = getComputedStyle(el);
  const mirror = document.createElement('div');
  const style = mirror.style as unknown as Record<string, string>;
  const from = computed as unknown as Record<string, string>;
  for (const prop of COPIED) style[prop] = from[prop];
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0';
  style.left = '-9999px';
  style.whiteSpace = 'pre-wrap';
  style.overflowWrap = 'break-word';
  style.overflow = 'hidden';
  document.body.appendChild(mirror);
  mirror.textContent = el.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = el.value.slice(position) || '.';
  mirror.appendChild(marker);
  const fontSize = parseFloat(computed.fontSize) || 14;
  const height = parseFloat(computed.lineHeight) || fontSize * 1.25;
  const top = marker.offsetTop + (parseFloat(computed.borderTopWidth) || 0) - el.scrollTop;
  const left = marker.offsetLeft + (parseFloat(computed.borderLeftWidth) || 0) - el.scrollLeft;
  document.body.removeChild(mirror);
  return { top, left, height };
}
