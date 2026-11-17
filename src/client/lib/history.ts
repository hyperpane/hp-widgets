// Undo and redo of a panel in Dev mode: each change keeps the panel as it
// was. Changes that come in a run (typing a label, one keystroke after
// another) share a key and make one step, so ⌘Z takes back the word, not
// the letter. Pure: the window keeps it in a ref.

export interface History<T> {
  past: T[];
  future: T[];
  /** The key of the change that made the newest step, and when. */
  last: { key: string; at: number } | null;
}

/** Steps kept. */
export const DEPTH = 200;
/** Changes with one key this close together are one step. */
export const MERGE_MS = 1000;

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], last: null });

/** The history after a change from `before`: a step more (or the same step,
 * when it's one of a run), and nothing to redo. */
export function record<T>(h: History<T>, before: T, key: string | null, now = Date.now()): History<T> {
  if (key && h.last && h.last.key === key && now - h.last.at < MERGE_MS && h.past.length) {
    return { past: h.past, future: [], last: { key, at: now } };
  }
  return { past: [...h.past, before].slice(-DEPTH), future: [], last: key ? { key, at: now } : null };
}

/** Back a step: the history, and what to show (null: nothing to undo). */
export function undo<T>(h: History<T>, current: T): [History<T>, T | null] {
  if (!h.past.length) return [h, null];
  const previous = h.past[h.past.length - 1];
  return [{ past: h.past.slice(0, -1), future: [current, ...h.future], last: null }, previous];
}

export function redo<T>(h: History<T>, current: T): [History<T>, T | null] {
  if (!h.future.length) return [h, null];
  const [next, ...rest] = h.future;
  return [{ past: [...h.past, current].slice(-DEPTH), future: rest, last: null }, next];
}
