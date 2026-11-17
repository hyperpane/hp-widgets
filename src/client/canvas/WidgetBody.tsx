// A widget drawn by its type's entry in the registry, at its place on the
// panel: the same in both modes, inert in Dev mode (the editor's frame
// takes the pointer there). Groups are drawn first, under everything,
// whatever their place in the list: they're boxes around the others.

import type { CSSProperties } from 'react';
import type { Widget } from '../../shared/index.ts';
import { REGISTRY, type WidgetView } from '../widgets/registry.ts';

/** The widgets in the order they're drawn: groups first, the rest as
 * listed (later ones on top). */
export function drawOrder<T extends Pick<Widget, 'type'>>(widgets: readonly T[]): T[] {
  return [...widgets.filter((w) => w.type === 'group'), ...widgets.filter((w) => w.type !== 'group')];
}

export const boxStyle = (r: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });

export function WidgetBody(view: WidgetView) {
  return <>{REGISTRY[view.widget.type].render(view)}</>;
}
