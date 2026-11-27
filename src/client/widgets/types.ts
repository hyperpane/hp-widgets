// What the registry holds for each type of widget, in one place: its name
// and icon in the palette, its defaults (the shared ones, which the server
// normalizes with), how it's drawn, and the fields the inspector shows for
// it. A type's entry lives in the file of its kind (text.tsx, fields.tsx…);
// registry.ts puts them together.

import type { Icon as IconComponent } from '@hyperpane/icons';
import type { ReactNode } from 'react';
import type { TypeSpec, Value, Widget, WidgetProps, WidgetType } from '../../shared/index.ts';
import type { Overrides } from '../runtime/state.ts';

/** What drawing a widget gets. In Dev mode it's drawn as it will look but
 * inert (the editor's frame over it takes the pointer). */
export interface WidgetView {
  widget: Widget;
  /** Its props, with what scripts changed over them. */
  props: WidgetProps & Overrides;
  value: Value;
  dev: boolean;
  disabled: boolean;
  /** Its script is running (a button shows it). */
  busy: boolean;
  /** The user changed its value; `fire`: run its change script now (a
   * choice made), or not yet (a field still being typed in, which fires as
   * it's left: `commit`). */
  change(value: unknown, fire?: boolean): void;
  /** A field was left, or Enter pressed: its change script runs if its
   * value changed since it was entered. */
  commit(): void;
  click(): void;
}

/** A field of the inspector for a prop of the widget. */
export type FieldSpec =
  | { kind: 'text'; prop: 'label' | 'text' | 'placeholder'; label: string; multiline?: boolean }
  | { kind: 'number'; prop: 'min' | 'max' | 'step'; label: string }
  | { kind: 'variant'; label: string }
  | { kind: 'options'; label: string }
  /** Its default value, edited as its kind is (text, a number, on/off, one
   * of its options). */
  | { kind: 'value'; label: string };

export interface WidgetEntry {
  type: WidgetType;
  /** Its name in the palette and the inspector. */
  title: string;
  /** A line in the palette's tooltip. */
  hint: string;
  icon: IconComponent;
  defaults: TypeSpec;
  render(view: WidgetView): ReactNode;
  fields: FieldSpec[];
  /** What a variant is called in the inspector (`primary` → Primary). */
  variantLabels?: Record<string, string>;
}
