// Boxes on the panel's grid: moving and resizing snap to it, stay on the
// canvas and keep a least size; a new widget goes where nothing is. Pure,
// so the tests run it without a DOM.

import { GRID, MIN_SIZE } from '../../shared/index.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Which edges a resize handle moves: n, s, e, w and the corners. */
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const snap = (n: number, grid = GRID) => Math.round(n / grid) * grid;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** A box moved by (dx, dy), snapped to the grid, kept on the canvas. */
export function moveRect(start: Rect, dx: number, dy: number, canvas: Size, grid = GRID): Rect {
  return {
    ...start,
    x: clamp(snap(start.x + dx, grid), 0, canvas.width - start.w),
    y: clamp(snap(start.y + dy, grid), 0, canvas.height - start.h),
  };
}

/** A box resized by dragging a handle by (dx, dy): the edges it holds move
 * to the grid, the others stay, never smaller than the least size nor off
 * the canvas. */
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, canvas: Size, grid = GRID): Rect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  const min = Math.max(MIN_SIZE, grid);
  if (handle.includes('w')) left = clamp(snap(left + dx, grid), 0, right - min);
  if (handle.includes('e')) right = clamp(snap(right + dx, grid), left + min, canvas.width);
  if (handle.includes('n')) top = clamp(snap(top + dy, grid), 0, bottom - min);
  if (handle.includes('s')) bottom = clamp(snap(bottom + dy, grid), top + min, canvas.height);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** A box nudged by the arrow keys (1px, or a grid step with Shift), kept
 * on the canvas. */
export function nudgeRect(start: Rect, key: string, big: boolean, canvas: Size, grid = GRID): Rect {
  const step = big ? grid : 1;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[key] ?? [0, 0];
  return { ...start, x: clamp(start.x + d[0], 0, canvas.width - start.w), y: clamp(start.y + d[1], 0, canvas.height - start.h) };
}

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a box of this size fits first, reading the canvas as a page (left
 * to right, then down), a grid step from the others. Groups don't count:
 * things go in them. Else the top left, a step further for each widget
 * there already (so a new one never hides exactly under another). */
export function freeSpot(others: readonly (Rect & { type?: string })[], w: number, h: number, canvas: Size, grid = GRID): { x: number; y: number } {
  const solid = others.filter((o) => o.type !== 'group').map((o) => ({ x: o.x - grid, y: o.y - grid, w: o.w + 2 * grid, h: o.h + 2 * grid }));
  for (let y = grid; y + h <= canvas.height - grid; y += grid) {
    for (let x = grid; x + w <= canvas.width - grid; x += grid) {
      const box = { x, y, w, h };
      const hit = solid.find((o) => overlaps(box, o));
      if (!hit) return { x, y };
      // Past what it hit, rather than a step at a time.
      x = Math.max(x, snap(hit.x + hit.w - grid, grid));
    }
  }
  const n = others.length % 10;
  return { x: clamp(grid * (n + 1), 0, canvas.width - w), y: clamp(grid * (n + 1), 0, canvas.height - h) };
}

/** A copy's place: a grid step down and right of the original, on the
 * canvas. */
export function besideOf(r: Rect, canvas: Size, grid = GRID): { x: number; y: number } {
  return { x: clamp(r.x + 2 * grid, 0, canvas.width - r.w), y: clamp(r.y + 2 * grid, 0, canvas.height - r.h) };
}
