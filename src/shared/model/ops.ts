// A handler's run, between the window and the server part: what the window
// asks (`invoke`), and what the script does to the window as it runs, sent
// back as it happens (the `invoke` subscription's events), ending with how
// it went.

import type { PropName, Value } from './types.ts';

/** What the window sends to run a widget's script. */
export interface InvokeRequest {
  project: string;
  /** The window that asked: its runs stop when it closes. */
  window: number;
  panel: string;
  widget: string;
  /** What happened to the widget: clicked, or changed to `value`. */
  type: 'click' | 'change';
  value: Value;
  /** Every widget's value as the event happened. */
  values: Record<string, Value>;
}

/** What a script did, in order. */
export type Op =
  /** A widget's value (a Text's or Badge's text, a bar's progress). */
  | { type: 'set'; id: string; value: Value }
  /** One of its props, or `hidden` / `disabled`. */
  | { type: 'prop'; id: string; name: PropName; value: unknown }
  /** Lines added to a Log (one or more, `\n` between them). */
  | { type: 'log'; id: string; text: string }
  | { type: 'clear'; id: string }
  | { type: 'toast'; message: string; error?: boolean }
  /** The end: it returned, threw (`error`, with the line it was on), or was
   * stopped. */
  | { type: 'done'; ok: boolean; error?: string; cancelled?: boolean };

/** The names a script may give `ui.prop`. */
export const PROP_NAMES: readonly PropName[] = ['label', 'text', 'placeholder', 'options', 'value', 'min', 'max', 'step', 'variant', 'disabled', 'hidden'];

/** The lines a Log keeps; older ones go. */
export const LOG_LINES = 2000;
