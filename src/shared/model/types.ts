// A panel and its widgets, as both parts and the .hpw file have them. A
// panel is a fixed-size canvas with widgets placed on it by pixel; each
// widget has an id (the name scripts and conditions use), a type, its box,
// the props its type takes, two conditions and the code of its handler.

/** Every kind of widget there is. Adding one means a line here, its
 * defaults in defaults.ts, and its entry in the client's registry. */
export const WIDGET_TYPES = [
  'text',
  'button',
  'input',
  'number',
  'textarea',
  'checkbox',
  'switch',
  'select',
  'radio',
  'slider',
  'progress',
  'badge',
  'log',
  'divider',
  'group',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/** What a widget's value is, if it has one: what `values[id]` holds, what
 * `ui.set` takes, and what a condition compares. */
export type ValueKind = 'string' | 'number' | 'boolean' | 'log' | 'none';

/** A value a widget can hold. */
export type Value = string | number | boolean | null;

/** The props a widget can have. Each type reads only those it takes (its
 * defaults say which); the others are dropped as a panel is normalized. */
export interface WidgetProps {
  /** A button's caption, a field's label above it, a checkbox's or
   * switch's beside it, a group's title. */
  label?: string;
  /** What a Text or a Badge says (their value, which scripts can set). */
  text?: string;
  placeholder?: string;
  /** A select's or radio group's choices, each as it's shown and kept. */
  options?: string[];
  /** The value it starts with in View mode. */
  value?: Value;
  min?: number;
  max?: number;
  step?: number;
  /** Its look: a Text's size, a Button's or Badge's color. */
  variant?: string;
}

/** The names `ui.prop(id, name, value)` may change, beside the props: hiding
 * and disabling it from a script. */
export type PropName = keyof WidgetProps | 'disabled' | 'hidden';

export interface Widget {
  /** Its name, unique in the panel: an identifier (`deploy`, `branchName`). */
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: WidgetProps;
  /** A condition (src/shared/expr); empty: always. */
  visibleWhen: string;
  enabledWhen: string;
  /** JavaScript run on the server when it's clicked (a button) or changed
   * (a field); empty: nothing runs. */
  script: string;
}

export interface Panel {
  /** Its file's name in the project's storage (`<id>.json`). */
  id: string;
  name: string;
  /** The canvas, in pixels. */
  width: number;
  height: number;
  /** In drawing order: later ones are on top (groups are drawn first). */
  widgets: Widget[];
}

/** A panel in the chooser's list. */
export interface PanelSummary {
  id: string;
  name: string;
  widgets: number;
  /** When its file last changed (ms). */
  updated: number;
}
