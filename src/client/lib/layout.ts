// What the editor does to a panel's widgets: add one (where it's dropped,
// or where there's room), drag one (a group takes what's in it along),
// resize, nudge, copy, remove, and bring to the front or send to the back.
// Each returns the widgets anew and leaves the old list as it was, so the
// history keeps it. Pure, so the tests run it without a DOM.

import { GRID, newWidget, type Panel, TYPES, type Widget, type WidgetType } from '../../shared/index.ts';
import { copyId, newWidgetId } from './ids.ts';
import { besideOf, freeSpot, type Handle, moveRect, nudgeRect, type Rect, resizeRect, type Size } from './snap.ts';

const sizeOf = (p: Pick<Panel, 'width' | 'height'>): Size => ({ width: p.width, height: p.height });

/** The widgets wholly inside a group's box (not other groups). */
export function insideOf(group: Rect, widgets: readonly Widget[]): string[] {
  return widgets
    .filter((w) => w.type !== 'group' && w.x >= group.x && w.y >= group.y && w.x + w.w <= group.x + group.w && w.y + w.h <= group.y + group.h)
    .map((w) => w.id);
}

/** A new widget of a type: at `at` (its top left, where it was dropped),
 * or where there's room; kept on the canvas. */
export function addWidget(panel: Panel, type: WidgetType, at?: { x: number; y: number }): { widgets: Widget[]; id: string } {
  const spec = TYPES[type];
  const w = Math.min(spec.w, panel.width);
  const h = Math.min(spec.h, panel.height);
  const place = at ?? freeSpot(panel.widgets, w, h, sizeOf(panel));
  const widget = { ...newWidget(type, newWidgetId(type, panel.widgets), { x: 0, y: 0 }), w, h };
  const placed = { ...widget, ...moveRect({ x: 0, y: 0, w, h }, place.x, place.y, sizeOf(panel)) };
  // A group goes under what's there; anything else on top.
  return { widgets: type === 'group' ? [placed, ...panel.widgets] : [...panel.widgets, placed], id: placed.id };
}

/** A drag under way: what it started from (the widgets as they were), and
 * which handle (or the widget itself, to move it). */
export interface Gesture {
  id: string;
  handle: Handle | 'move';
  start: readonly Widget[];
}

/** The widgets as a drag by (dx, dy) leaves them. */
export function dragged(panel: Pick<Panel, 'width' | 'height'>, g: Gesture, dx: number, dy: number): Widget[] {
  const target = g.start.find((w) => w.id === g.id);
  if (!target) return [...g.start];
  const canvas = sizeOf(panel);
  if (g.handle !== 'move') {
    const r = resizeRect(target, g.handle, dx, dy, canvas);
    return g.start.map((w) => (w.id === g.id ? { ...w, ...r } : w));
  }
  const r = moveRect(target, dx, dy, canvas);
  const along = target.type === 'group' ? new Set(insideOf(target, g.start)) : new Set<string>();
  const mx = r.x - target.x;
  const my = r.y - target.y;
  return g.start.map((w) => {
    if (w.id === g.id) return { ...w, ...r };
    if (!along.has(w.id)) return w;
    // What's in a group moves with it, as far as it can.
    return { ...w, x: Math.min(Math.max(w.x + mx, 0), canvas.width - w.w), y: Math.min(Math.max(w.y + my, 0), canvas.height - w.h) };
  });
}

export function nudged(panel: Panel, id: string, key: string, big: boolean): Widget[] {
  const target = panel.widgets.find((w) => w.id === id);
  if (!target) return panel.widgets;
  const r = nudgeRect(target, key, big, sizeOf(panel));
  return dragged(panel, { id, handle: 'move', start: panel.widgets }, r.x - target.x, r.y - target.y).map((w) =>
    // dragged snaps to the grid; a 1px nudge mustn't.
    w.id === id ? { ...w, x: r.x, y: r.y } : w,
  );
}

/** A copy of a widget beside it, on top of the others. */
export function duplicated(panel: Panel, id: string): { widgets: Widget[]; id: string } | null {
  const of = panel.widgets.find((w) => w.id === id);
  if (!of) return null;
  const copy: Widget = { ...structuredClone(of), id: copyId(of, panel.widgets), ...besideOf(of, sizeOf(panel)) };
  return { widgets: [...panel.widgets, copy], id: copy.id };
}

export const removed = (widgets: readonly Widget[], id: string): Widget[] => widgets.filter((w) => w.id !== id);

/** To the front (drawn last) or the back (drawn first). */
export function restacked(widgets: readonly Widget[], id: string, to: 'front' | 'back'): Widget[] {
  const w = widgets.find((x) => x.id === id);
  if (!w) return [...widgets];
  const rest = widgets.filter((x) => x.id !== id);
  return to === 'front' ? [...rest, w] : [w, ...rest];
}

/** A widget's box changed by hand (the inspector's X, Y, W, H): snapped to
 * whole pixels and kept on the canvas. */
export function placed(panel: Panel, id: string, r: Partial<Rect>): Widget[] {
  return panel.widgets.map((w) => {
    if (w.id !== id) return w;
    const width = Math.round(Math.min(Math.max(r.w ?? w.w, GRID), panel.width));
    const height = Math.round(Math.min(Math.max(r.h ?? w.h, GRID), panel.height));
    return {
      ...w,
      w: width,
      h: height,
      x: Math.round(Math.min(Math.max(r.x ?? w.x, 0), panel.width - width)),
      y: Math.round(Math.min(Math.max(r.y ?? w.y, 0), panel.height - height)),
    };
  });
}

/** The canvas resized: never smaller than what's on it. */
export function canvasFits(panel: Panel): Size {
  return {
    width: Math.max(0, ...panel.widgets.map((w) => w.x + w.w)),
    height: Math.max(0, ...panel.widgets.map((w) => w.y + w.h)),
  };
}
