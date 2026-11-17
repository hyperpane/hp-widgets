// Every type of widget, by type, in the palette's order: the one place the
// editor, the inspector and View mode look a type up.

import type { WidgetType } from '../../shared/index.ts';
import { button } from './buttons.tsx';
import { checkbox, radio, select, slider, toggle } from './choices.tsx';
import { divider, group, log, progress } from './display.tsx';
import { input, number, textarea } from './fields.tsx';
import { badge, text } from './text.tsx';
import type { WidgetEntry } from './types.ts';

export const REGISTRY: Record<WidgetType, WidgetEntry> = {
  text,
  button,
  input,
  number,
  textarea,
  checkbox,
  switch: toggle,
  select,
  radio,
  slider,
  progress,
  badge,
  log,
  divider,
  group,
};

/** The palette's sections, each a few types. */
export const PALETTE: { title: string; types: WidgetType[] }[] = [
  { title: 'Basic', types: ['text', 'button', 'badge', 'divider', 'group'] },
  { title: 'Input', types: ['input', 'number', 'textarea', 'select', 'radio', 'checkbox', 'switch', 'slider'] },
  { title: 'Output', types: ['log', 'progress'] },
];

export type { FieldSpec, WidgetEntry, WidgetView } from './types.ts';
