// Dev mode's palette: every type of widget, by section. A click adds one
// where there's room; dragging one onto the canvas puts it where it's let
// go (an outline of its size follows the pointer). The pointer is captured
// by the entry pressed, so the drag goes on over the canvas and comes back
// here as it ends. A finger swiping up or down scrolls the palette instead.

import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { cn, useTouch } from '@hyperpane/ui';
import { TYPES, type WidgetType } from '../../shared/index.ts';
import { PALETTE, REGISTRY } from '../widgets/registry.ts';

/** Where a dragged widget's top left is, from the pointer. */
export const GRAB = { x: 12, y: 12 };
const SLOP = 4;

interface PaletteDrag {
  type: WidgetType;
  x: number;
  y: number;
}

export function Palette({
  onAdd,
  onDrop,
  scale = 1,
  className,
}: {
  /** The canvas's scale, for the dragged outline's size. */
  scale?: number;
  onAdd(type: WidgetType): void;
  /** Let go at (x, y) in the window: the editor puts it on the canvas if
   * that's over it. */
  onDrop(type: WidgetType, x: number, y: number): void;
  className?: string;
}) {
  const hint = useTouch() ? 'Tap to add, or drag onto the canvas.' : 'Click to add, or drag onto the canvas.';
  const press = useRef<{ type: WidgetType; x0: number; y0: number; moved: boolean; pointer: number } | null>(null);
  const [ghost, setGhost] = useState<PaletteDrag | null>(null);

  const down = (e: ReactPointerEvent<HTMLButtonElement>, type: WidgetType) => {
    if (e.button !== 0) return;
    press.current = { type, x0: e.clientX, y0: e.clientY, moved: false, pointer: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p || p.pointer !== e.pointerId) return;
    if (!p.moved && Math.abs(e.clientX - p.x0) + Math.abs(e.clientY - p.y0) < SLOP) return;
    p.moved = true;
    setGhost({ type: p.type, x: e.clientX, y: e.clientY });
  };
  const up = (e: ReactPointerEvent, keep: boolean) => {
    const p = press.current;
    if (!p || p.pointer !== e.pointerId) return;
    press.current = null;
    setGhost(null);
    if (!keep) return;
    if (p.moved) onDrop(p.type, e.clientX, e.clientY);
    else onAdd(p.type);
  };

  return (
    <div
      className={cn(
        'flex w-[11.5rem] flex-none flex-col overflow-y-auto border-r border-[var(--node-border)] bg-[var(--node-header)] px-2.5 py-2.5',
        className,
      )}
    >
      {PALETTE.map((section) => (
        <div key={section.title} className="mb-3">
          <div className="px-0.5 pb-1.5 text-[10px] leading-4 font-semibold tracking-wider text-[var(--node-muted)] uppercase">{section.title}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {section.types.map((type) => {
              const entry = REGISTRY[type];
              const Icon = entry.icon;
              return (
                <button
                  key={type}
                  type="button"
                  title={`${entry.hint} ${hint}`}
                  className={cn(
                    'rounded-control flex h-14 min-w-0 cursor-grab touch-pan-y flex-col items-center justify-center gap-1.5 border border-[var(--node-border)] bg-[var(--node-bg)] px-1 text-2xs text-[var(--node-fg)]',
                    'transition-colors duration-100 hover:border-[color-mix(in_srgb,var(--node-accent)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--node-accent)_8%,var(--node-bg))] active:cursor-grabbing',
                    ghost?.type === type && 'border-[var(--node-accent)]',
                  )}
                  onPointerDown={(e) => down(e, type)}
                  onPointerMove={move}
                  onPointerUp={(e) => up(e, true)}
                  onPointerCancel={(e) => up(e, false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAdd(type);
                    }
                  }}
                >
                  <Icon className="size-4 flex-none text-[var(--node-muted)]" />
                  <span className="max-w-full truncate leading-3">{entry.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="m-0 mt-auto px-0.5 text-2xs leading-4 text-[var(--node-muted)]">{hint}</p>
      {ghost && <Ghost drag={ghost} scale={scale} />}
    </div>
  );
}

/** The widget's outline under the pointer while it's dragged. */
function Ghost({ drag, scale }: { drag: PaletteDrag; scale: number }) {
  const spec = TYPES[drag.type];
  const Icon = REGISTRY[drag.type].icon;
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-control pointer-events-none fixed z-50 flex items-start gap-1 border border-dashed border-[var(--node-accent)] p-1 text-2xs text-[var(--node-accent)]',
        'bg-[color-mix(in_srgb,var(--node-accent)_10%,transparent)]',
      )}
      style={{ left: drag.x - GRAB.x * scale, top: drag.y - GRAB.y * scale, width: spec.w * scale, height: spec.h * scale }}
    >
      <Icon className="size-3 flex-none" />
      {REGISTRY[drag.type].title}
    </div>
  );
}
