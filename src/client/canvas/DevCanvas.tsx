// Dev mode's canvas: the panel's surface on its 8px grid, each widget in a
// frame. A press selects; dragging moves (a group takes what's in it
// along) or, from a handle, resizes, snapping to the grid; a press on the
// empty grid selects nothing. While a drag goes on, the widgets are drawn
// where it puts them; it becomes one change (one Undo step, one save) as
// it ends.

import { type PointerEvent as ReactPointerEvent, type Ref, useRef, useState } from 'react';
import type { Panel, Widget } from '../../shared/index.ts';
import { dragged, type Gesture } from '../lib/layout.ts';
import type { Handle } from '../lib/snap.ts';
import { Frame } from './Frame.tsx';
import { drawOrder } from './WidgetBody.tsx';

/** The grid: a dot every 16px (two snaps), on the panel's own color. */
const GRID_STYLE = {
  backgroundColor: 'var(--node-bg)',
  backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--node-fg) 13%, transparent) 1px, transparent 1.2px)',
  backgroundSize: '16px 16px',
  backgroundPosition: '-8px -8px',
};

/** How far the pointer goes before a press is a drag. */
const SLOP = 3;

/** Room around the canvas (the size below it included). */
export const FIT_PAD = 28;

export function DevCanvas({
  panel,
  selected,
  onSelect,
  onCommit,
  surface,
  fit,
  scale,
  children,
}: {
  /** Where the canvas fits (useFit's box), and how much it's scaled down. */
  fit(el: HTMLDivElement | null): void;
  scale: number;
  panel: Panel;
  selected: string | null;
  onSelect(id: string | null): void;
  /** A drag's end: the widgets as it left them. */
  onCommit(widgets: Widget[]): void;
  surface: Ref<HTMLDivElement>;
  /** Drawn over the widgets (the palette's drop preview). */
  children?: React.ReactNode;
}) {
  const [live, setLive] = useState<Widget[] | null>(null);
  const gesture = useRef<{ g: Gesture; x0: number; y0: number; moved: boolean; pointer: number } | null>(null);
  const widgets = live ?? panel.widgets;

  const press = (e: ReactPointerEvent, w: Widget, handle: Handle | 'move') => {
    if (e.button !== 0) return;
    e.preventDefault();
    onSelect(w.id);
    gesture.current = { g: { id: w.id, handle, start: panel.widgets }, x0: e.clientX, y0: e.clientY, moved: false, pointer: e.pointerId };
    // The surface follows the pointer from here, wherever it goes.
    (e.currentTarget.closest('[data-surface]') as HTMLElement | null)?.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent) => {
    const at = gesture.current;
    if (!at || e.pointerId !== at.pointer) return;
    // The pointer moves on the screen; the widgets on the unscaled panel.
    const dx = (e.clientX - at.x0) / scale;
    const dy = (e.clientY - at.y0) / scale;
    if (!at.moved && Math.abs(dx) + Math.abs(dy) < SLOP) return;
    at.moved = true;
    setLive(dragged(panel, at.g, dx, dy));
  };

  const end = (e: ReactPointerEvent, keep: boolean) => {
    const at = gesture.current;
    if (!at || e.pointerId !== at.pointer) return;
    gesture.current = null;
    if (keep && at.moved && live) onCommit(live);
    setLive(null);
  };

  return (
    // The canvas a step off the window's color, the panel on it in the window's own.
    <div ref={fit} className="flex min-h-0 min-w-0 flex-1 overflow-auto bg-[color-mix(in_srgb,var(--node-bg),var(--node-fg)_4%)]" style={{ padding: FIT_PAD }}>
      <div className="m-auto flex flex-none flex-col items-center gap-2">
        <div style={{ width: panel.width * scale, height: panel.height * scale }}>
          <div
            ref={surface}
            data-surface
            className="rounded-surface relative origin-top-left shadow-[var(--shadow-card)] ring-1 ring-[var(--hairline-strong)]"
            style={{ width: panel.width, height: panel.height, transform: scale === 1 ? undefined : `scale(${scale})`, ...GRID_STYLE }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget && e.button === 0) onSelect(null);
            }}
            onPointerMove={move}
            onPointerUp={(e) => end(e, true)}
            onPointerCancel={(e) => end(e, false)}
            onLostPointerCapture={(e) => end(e, true)}
          >
            {drawOrder(widgets).map((w) => (
              <Frame
                key={w.id}
                widget={w}
                selected={w.id === selected}
                dragging={!!live && w.id === gesture.current?.g.id}
                onPress={(e, h) => press(e, w, h)}
              />
            ))}
            {children}
          </div>
        </div>
        <div className="flex h-5 items-center text-xs leading-4 text-[var(--node-muted)] tabular-nums">
          {panel.width} × {panel.height}
          {scale < 1 && ` · ${Math.round(scale * 100)}%`}
        </div>
      </div>
    </div>
  );
}
