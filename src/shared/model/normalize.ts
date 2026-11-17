// A panel from anywhere (a save from a window, a file on disk, an imported
// .hpw) made into one both parts can trust: every field the type it should
// be, sizes within the canvas, ids unique identifiers, only the props each
// type takes, and nothing else. What had to change is said, a line each,
// so an import can tell the user what it dropped.

import { CANVAS, GRID, MAX_CANVAS, MAX_OPTIONS, MAX_SCRIPT, MAX_TEXT, MAX_WIDGETS, MIN_SIZE, propsOf, TYPES } from './defaults.ts';
import { idProblem, uniqueId } from './ids.ts';
import type { Panel, Widget, WidgetProps, WidgetType } from './types.ts';
import { WIDGET_TYPES } from './types.ts';
import { coerce } from './values.ts';

/** The smallest canvas. */
export const MIN_CANVAS = { width: 160, height: 120 };
const MAX_NAME = 100;
const MAX_CONDITION = 2000;
const MAX_OPTION = 200;

export interface Normalized {
  panel: Panel;
  /** What it changed or left out, for the user. */
  warnings: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isType = (v: unknown): v is WidgetType => typeof v === 'string' && (WIDGET_TYPES as readonly string[]).includes(v);

function number(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** A widget's props: those its type takes, each of its kind, the others
 * dropped. */
function props(type: WidgetType, raw: unknown): WidgetProps {
  const spec = TYPES[type];
  const given = isObject(raw) ? raw : {};
  const out: WidgetProps = {};
  for (const key of propsOf(type)) {
    const v = key in given ? given[key] : spec.props[key];
    switch (key) {
      case 'label':
      case 'text':
      case 'placeholder':
        out[key] = typeof v === 'string' ? v.slice(0, MAX_TEXT) : typeof v === 'number' ? String(v) : (spec.props[key] ?? '');
        break;
      case 'variant':
        out.variant = typeof v === 'string' && spec.variants?.includes(v) ? v : spec.variants?.[0];
        break;
      case 'options':
        out.options = Array.isArray(v)
          ? v
              .filter((o) => typeof o === 'string' || typeof o === 'number')
              .map((o) => String(o).slice(0, MAX_OPTION))
              .slice(0, MAX_OPTIONS)
          : [...(spec.props.options ?? [])];
        break;
      case 'min':
      case 'max':
      case 'step':
        out[key] = number(v, spec.props[key] ?? 0);
        break;
      case 'value':
        break;
    }
  }
  if (out.min !== undefined && out.max !== undefined && out.min > out.max) [out.min, out.max] = [out.max, out.min];
  if (out.step !== undefined && !(out.step > 0)) out.step = spec.props.step ?? 1;
  if ('value' in spec.props) {
    const v = 'value' in given ? given.value : spec.props.value;
    const range = type === 'progress' ? { min: 0, max: 100 } : { min: out.min, max: out.max };
    out.value = coerce(spec.value, v, range);
    // A choice starts on one of its options (or none, with none to choose).
    if (out.options && !out.options.includes(String(out.value))) out.value = out.options[0] ?? '';
  }
  return out;
}

/** A panel as it should be, and what was changed to make it so. `id` is
 * the one it's kept under (a file's name wins over what it says inside). */
export function normalizePanel(raw: unknown, o: { id?: string } = {}): Normalized {
  const warnings: string[] = [];
  const given = isObject(raw) ? raw : {};
  if (!isObject(raw)) warnings.push('The panel wasn’t an object: it’s empty now.');

  const name = text(given.name, MAX_NAME).trim() || 'Panel';
  const width = Math.round(clamp(number(given.width, CANVAS.width), MIN_CANVAS.width, MAX_CANVAS));
  const height = Math.round(clamp(number(given.height, CANVAS.height), MIN_CANVAS.height, MAX_CANVAS));
  if (given.width !== undefined && width !== given.width) warnings.push(`The canvas’s width is ${width} now.`);
  if (given.height !== undefined && height !== given.height) warnings.push(`The canvas’s height is ${height} now.`);

  const list = Array.isArray(given.widgets) ? given.widgets : [];
  if (given.widgets !== undefined && !Array.isArray(given.widgets)) warnings.push('Its widgets weren’t a list: left out.');
  if (list.length > MAX_WIDGETS) warnings.push(`Only the first ${MAX_WIDGETS} widgets were kept, of ${list.length}.`);

  const widgets: Widget[] = [];
  const taken: string[] = [];
  for (const [i, item] of list.slice(0, MAX_WIDGETS).entries()) {
    if (!isObject(item)) {
      warnings.push(`Left out widget ${i + 1}: it isn’t an object.`);
      continue;
    }
    const type = item.type;
    const shownId = typeof item.id === 'string' && item.id ? `“${item.id.slice(0, 40)}”` : String(i + 1);
    if (!isType(type)) {
      warnings.push(`Left out widget ${shownId}: there’s no widget type “${String(type).slice(0, 40)}”.`);
      continue;
    }
    let id = typeof item.id === 'string' ? item.id : '';
    if (idProblem(id, taken)) {
      const fresh = uniqueId(id || `${type}1`, taken);
      if (id) warnings.push(`Widget “${id.slice(0, 40)}” is “${fresh}” now: ${idProblem(id, taken)}`);
      id = fresh;
    }
    taken.push(id);

    const spec = TYPES[type];
    const w = Math.round(clamp(number(item.w, spec.w), MIN_SIZE, width));
    const h = Math.round(clamp(number(item.h, spec.h), MIN_SIZE, height));
    const x = Math.round(clamp(number(item.x, 0), 0, width - w));
    const y = Math.round(clamp(number(item.y, 0), 0, height - h));
    if (item.w !== undefined && (w !== item.w || h !== item.h || x !== item.x || y !== item.y)) {
      // Rounding alone isn't worth a word; moving it in or shrinking it is.
      const moved = Math.abs(w - number(item.w, w)) + Math.abs(h - number(item.h, h)) + Math.abs(x - number(item.x, x)) + Math.abs(y - number(item.y, y));
      if (moved >= 1) warnings.push(`Widget “${id}” was moved or resized to fit the canvas.`);
    }

    widgets.push({
      id,
      type,
      x,
      y,
      w,
      h,
      props: props(type, item.props),
      visibleWhen: text(item.visibleWhen, MAX_CONDITION),
      enabledWhen: text(item.enabledWhen, MAX_CONDITION),
      script: spec.event ? text(item.script, MAX_SCRIPT) : '',
    });
  }

  return { panel: { id: o.id ?? (typeof given.id === 'string' ? given.id : ''), name, width, height, widgets }, warnings };
}

/** A new, empty panel. */
export function emptyPanel(id: string, name: string): Panel {
  return { id, name, width: CANVAS.width, height: CANVAS.height, widgets: [] };
}

/** A new widget of a type, at a place, with its defaults. */
export function newWidget(type: WidgetType, id: string, at: { x: number; y: number }): Widget {
  const spec = TYPES[type];
  return {
    id,
    type,
    x: Math.round(at.x / GRID) * GRID,
    y: Math.round(at.y / GRID) * GRID,
    w: spec.w,
    h: spec.h,
    props: structuredClone(spec.props),
    visibleWhen: '',
    enabledWhen: '',
    script: '',
  };
}
