// Names: a widget's id is what scripts (`ui.set('status', …)`) and
// conditions (`env == 'prod'`) call it, so it's an identifier, unique in
// its panel. A panel's id names its file, so it's kept to a safe few
// characters, never a path.

import type { Widget, WidgetType } from './types.ts';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** Words a condition reads as themselves, never as a widget. */
const RESERVED = new Set(['true', 'false', 'null', 'undefined', 'length']);
export const MAX_ID = 64;

/** Why a widget can't have this id, or null when it can. */
export function idProblem(id: string, others: readonly string[]): string | null {
  if (!id) return 'An id can’t be empty.';
  if (id.length > MAX_ID) return `An id is at most ${MAX_ID} characters.`;
  if (!IDENTIFIER.test(id)) return 'An id is letters, digits, _ and $, and doesn’t start with a digit.';
  if (RESERVED.has(id)) return `“${id}” means something else in a condition.`;
  if (others.includes(id)) return `Another widget is “${id}” already.`;
  return null;
}

export const isWidgetId = (id: unknown): id is string => typeof id === 'string' && idProblem(id, []) === null;

/** `base`, or `base2`, `base3`… whichever isn't taken. A base that isn't an
 * identifier is made one first (`Deploy now!` → `Deploy_now_`). */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let root = base.replace(/[^A-Za-z0-9_$]/g, '_').slice(0, MAX_ID - 4) || 'widget';
  if (/^[0-9]/.test(root)) root = `_${root}`;
  if (RESERVED.has(root)) root = `${root}_`;
  // A root that ends in digits (`button2` duplicated) counts on from there.
  const m = /^(.*?)(\d+)$/.exec(root);
  const stem = m?.[1] ? m[1] : root;
  let n = m?.[1] ? Number(m[2]) : 1;
  if (!set.has(root)) return root;
  for (;;) {
    n++;
    const id = `${stem}${n}`;
    if (!set.has(id)) return id;
  }
}

/** A new widget's id: its type and a number (`button1`, `button2`). */
export function newWidgetId(type: WidgetType, widgets: readonly Widget[]): string {
  return uniqueId(
    `${type}1`,
    widgets.map((w) => w.id),
  );
}

const PANEL_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const isPanelId = (id: unknown): id is string => typeof id === 'string' && PANEL_ID.test(id);

/** A new panel's id: the time and some randomness, in base 36. */
export function newPanelId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** `name`, or `name 2`, `name 3`… whichever no other panel has. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const set = new Set([...taken].map((n) => n.toLowerCase()));
  const base = name.trim() || 'Panel';
  if (!set.has(base.toLowerCase())) return base;
  const m = /^(.*?) (\d+)$/.exec(base);
  const stem = m ? m[1] : base;
  for (let n = m ? Number(m[2]) + 1 : 2; ; n++) {
    const candidate = `${stem} ${n}`;
    if (!set.has(candidate.toLowerCase())) return candidate;
  }
}
