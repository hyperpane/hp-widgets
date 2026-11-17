// A panel at work in View mode: each widget's value (its default at first,
// then what the user and the scripts make it) and what scripts changed of
// its props (`ui.prop`), kept in the window only. What a script's ops do
// to it, and how it follows the panel when that changes in Dev mode. Pure,
// so the tests run it without a DOM.

import {
  coerce,
  initialValue,
  LOG_LINES,
  type Op,
  type Panel,
  type PropName,
  rangeOf,
  TYPES,
  type Value,
  type Widget,
  type WidgetProps,
} from '../../shared/index.ts';

/** What a script changed of a widget: its props, and hidden / disabled,
 * which win over its conditions once a script has said. */
export type Overrides = Partial<WidgetProps> & { hidden?: boolean; disabled?: boolean };

export interface RunState {
  values: Record<string, Value>;
  overrides: Record<string, Overrides>;
}

export function initialState(panel: Panel): RunState {
  const values: Record<string, Value> = {};
  for (const w of panel.widgets) if (TYPES[w.type].value !== 'none') values[w.id] = initialValue(w);
  return { values, overrides: {} };
}

/** A Log's text with lines added, keeping the last LOG_LINES. */
export function appendLines(text: string, add: string): string {
  const joined = text ? `${text}\n${add}` : add;
  let cut = joined.length;
  let lines = 0;
  // From the end, to the LOG_LINES-th line break: no split of the whole.
  while (cut > 0) {
    cut = joined.lastIndexOf('\n', cut - 1);
    if (cut < 0) return joined;
    if (++lines >= LOG_LINES) return joined.slice(cut + 1);
  }
  return joined;
}

/** A widget's props with what scripts changed over them. */
export function propsOf(w: Widget, s: RunState): WidgetProps & Overrides {
  const o = s.overrides[w.id];
  return o ? { ...w.props, ...o } : w.props;
}

/** The state after one of a script's ops (toasts and the end aren't
 * state: the window handles those). */
export function applyOp(s: RunState, op: Op, panel: Panel): RunState {
  const w = 'id' in op ? panel.widgets.find((x) => x.id === op.id) : undefined;
  if (!w) return s;
  switch (op.type) {
    case 'set':
      return { ...s, values: { ...s.values, [w.id]: op.value } };
    case 'log':
      return { ...s, values: { ...s.values, [w.id]: appendLines(String(s.values[w.id] ?? ''), op.text) } };
    case 'clear':
      return { ...s, values: { ...s.values, [w.id]: '' } };
    case 'prop':
      return { ...s, overrides: { ...s.overrides, [w.id]: { ...s.overrides[w.id], [op.name as PropName]: op.value } } };
    default:
      return s;
  }
}

/** The user changing a widget's value (typing, ticking, choosing). */
export function setValue(s: RunState, w: Widget, value: unknown): RunState {
  const kind = TYPES[w.type].value;
  if (kind === 'none') return s;
  const range = { ...rangeOf(w), ...pick(s.overrides[w.id]) };
  return { ...s, values: { ...s.values, [w.id]: coerce(kind, value, range) } };
}

const pick = (o: Overrides | undefined) => {
  const out: { min?: number; max?: number } = {};
  if (typeof o?.min === 'number') out.min = o.min;
  if (typeof o?.max === 'number') out.max = o.max;
  return out;
};

/** The state for a panel that changed (edited in Dev mode, or by another
 * window): values kept for the widgets still there as the same type, the
 * new ones' defaults, the gone ones dropped. A widget whose default changed
 * starts on the new one. */
export function follow(s: RunState, before: Panel | null, panel: Panel): RunState {
  const was = new Map((before?.widgets ?? []).map((w) => [w.id, w]));
  const values: Record<string, Value> = {};
  const overrides: Record<string, Overrides> = {};
  for (const w of panel.widgets) {
    if (TYPES[w.type].value === 'none' && !s.overrides[w.id]) continue;
    const old = was.get(w.id);
    const same = old && old.type === w.type && JSON.stringify(initialValue(old)) === JSON.stringify(initialValue(w));
    if (TYPES[w.type].value !== 'none') values[w.id] = same && Object.hasOwn(s.values, w.id) ? s.values[w.id] : initialValue(w);
    if (old && old.type === w.type && s.overrides[w.id]) overrides[w.id] = s.overrides[w.id];
  }
  return { values, overrides };
}
