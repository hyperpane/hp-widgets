// What each type of widget is made with and may hold: its size when it's
// added, its props and their first values, the kind of value it has, and
// the event its script runs on. The server normalizes with these (a saved
// or imported panel keeps only what its types take), and the client's
// registry builds on them.

import type { ValueKind, WidgetProps, WidgetType } from './types.ts';

export interface TypeSpec {
  /** Its size when it's added. */
  w: number;
  h: number;
  /** The props it takes, with the values a new one has. */
  props: WidgetProps;
  value: ValueKind;
  /** What runs its script: a click (a button), a change (a field), or
   * nothing (it only shows). */
  event: 'click' | 'change' | null;
  /** The looks `variant` may name, the first the default. */
  variants?: readonly string[];
}

export const TEXT_VARIANTS = ['body', 'heading', 'title', 'muted', 'mono'] as const;
export const BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
export const BADGE_VARIANTS = ['neutral', 'green', 'amber', 'rose', 'blue', 'violet'] as const;

export const TYPES: Record<WidgetType, TypeSpec> = {
  text: { w: 160, h: 24, props: { text: 'Text', variant: 'body' }, value: 'string', event: null, variants: TEXT_VARIANTS },
  button: { w: 112, h: 32, props: { label: 'Button', variant: 'primary' }, value: 'none', event: 'click', variants: BUTTON_VARIANTS },
  input: { w: 200, h: 48, props: { label: 'Input', placeholder: '', value: '' }, value: 'string', event: 'change' },
  number: { w: 120, h: 48, props: { label: 'Number', value: 0, min: 0, max: 100, step: 1 }, value: 'number', event: 'change' },
  textarea: { w: 240, h: 104, props: { label: 'Text', placeholder: '', value: '' }, value: 'string', event: 'change' },
  checkbox: { w: 160, h: 24, props: { label: 'Checkbox', value: false }, value: 'boolean', event: 'change' },
  switch: { w: 160, h: 24, props: { label: 'Switch', value: false }, value: 'boolean', event: 'change' },
  select: { w: 200, h: 48, props: { label: 'Select', options: ['One', 'Two', 'Three'], value: 'One' }, value: 'string', event: 'change' },
  radio: { w: 160, h: 88, props: { label: 'Choice', options: ['One', 'Two', 'Three'], value: 'One' }, value: 'string', event: 'change' },
  slider: { w: 200, h: 48, props: { label: 'Slider', value: 50, min: 0, max: 100, step: 1 }, value: 'number', event: 'change' },
  progress: { w: 200, h: 32, props: { label: '', value: 0 }, value: 'number', event: null },
  badge: { w: 88, h: 24, props: { text: 'Ready', variant: 'neutral' }, value: 'string', event: null, variants: BADGE_VARIANTS },
  log: { w: 400, h: 160, props: { label: '' }, value: 'log', event: null },
  divider: { w: 240, h: 16, props: {}, value: 'none', event: null },
  group: { w: 320, h: 200, props: { label: 'Group' }, value: 'none', event: null },
};

/** The props each type takes, by name. */
export const propsOf = (type: WidgetType) => Object.keys(TYPES[type].props) as (keyof WidgetProps)[];

/** The smallest a widget may be, and the largest a panel. */
export const MIN_SIZE = 8;
export const MAX_CANVAS = 4000;
/** A new panel's canvas. */
export const CANVAS = { width: 864, height: 528 };
/** The grid widgets snap to. */
export const GRID = 8;
/** How many widgets a panel may have, and how long a script or text may be. */
export const MAX_WIDGETS = 500;
export const MAX_SCRIPT = 100_000;
export const MAX_TEXT = 10_000;
export const MAX_OPTIONS = 200;
