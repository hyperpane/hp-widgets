// Widgets' values: what each holds at first (its default), and a value
// from anywhere (a script's `ui.set`, a field, a file) made the kind its
// widget holds, so a Number never holds "abc" and a Checkbox never "yes".

import { TYPES } from './defaults.ts';
import type { Value, ValueKind, Widget } from './types.ts';

/** `v` as a widget of this kind holds it (null: it holds none). */
export function coerce(kind: ValueKind, v: unknown, range?: { min?: number; max?: number }): Value {
  switch (kind) {
    case 'string':
    case 'log':
      return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    case 'number': {
      let n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'boolean' ? Number(v) : Number.NaN;
      if (!Number.isFinite(n)) n = 0;
      if (range?.min !== undefined && n < range.min) n = range.min;
      if (range?.max !== undefined && n > range.max) n = range.max;
      return n;
    }
    case 'boolean':
      return v === true || v === 'true' || v === 1;
    default:
      return null;
  }
}

/** The range a number widget keeps to: its min and max, and a progress
 * bar's 0 to 100. */
export function rangeOf(w: Widget): { min?: number; max?: number } {
  if (w.type === 'progress') return { min: 0, max: 100 };
  return { min: w.props.min, max: w.props.max };
}

/** What a widget holds as View mode starts. A Text's and a Badge's value
 * is what they say. */
export function initialValue(w: Widget): Value {
  const kind = TYPES[w.type].value;
  if (kind === 'none') return null;
  if (kind === 'log') return '';
  if (w.type === 'text' || w.type === 'badge') return coerce('string', w.props.text);
  return coerce(kind, w.props.value, rangeOf(w));
}

/** Every widget's first value, by id (those that hold one). */
export function initialValues(widgets: readonly Widget[]): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const w of widgets) if (TYPES[w.type].value !== 'none') out[w.id] = initialValue(w);
  return out;
}
