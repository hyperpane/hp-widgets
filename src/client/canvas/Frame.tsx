// A widget in Dev mode: drawn as it will look but inert, inside a frame
// that takes the pointer: a press selects it and starts a move, the
// handles of the selected one resize it. Its id shows over it while it's
// selected, as scripts will call it.

import type { PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@hyperpane/ui';
import { initialValue, type Widget } from '../../shared/index.ts';
import { type Handle, HANDLES } from '../lib/snap.ts';
import { REGISTRY } from '../widgets/registry.ts';
import { boxStyle, WidgetBody } from './WidgetBody.tsx';

const HANDLE_PLACE: Record<Handle, string> = {
  nw: '-left-1 -top-1 cursor-nwse-resize',
  n: 'left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-1 -top-1 cursor-nesw-resize',
  e: '-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-right-1 -bottom-1 cursor-nwse-resize',
  s: 'left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize',
  sw: '-left-1 -bottom-1 cursor-nesw-resize',
  w: '-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
};

export function Frame({
  widget,
  selected,
  dragging,
  onPress,
}: {
  widget: Widget;
  selected: boolean;
  dragging: boolean;
  /** A press on it (`move`) or on one of its handles. */
  onPress(e: ReactPointerEvent, handle: Handle | 'move'): void;
}) {
  const Icon = REGISTRY[widget.type].icon;
  return (
    <div
      data-widget={widget.id}
      className={cn(
        'group/frame absolute cursor-move touch-none select-none',
        selected
          ? 'z-10 outline-2 outline-offset-1 outline-[var(--node-accent)]'
          : 'hover:outline-1 hover:outline-offset-1 hover:outline-[var(--node-input-hover)] hover:outline-dashed',
        dragging && 'opacity-90',
      )}
      style={boxStyle(widget)}
      onPointerDown={(e) => onPress(e, 'move')}
    >
      {/* Placed at a size: the kit's controls keep it with a finger too. */}
      <div data-fixed-size className="pointer-events-none h-full w-full">
        <WidgetBody
          widget={widget}
          props={widget.props}
          value={initialValue(widget)}
          dev
          disabled={false}
          busy={false}
          change={() => {}}
          commit={() => {}}
          click={() => {}}
        />
      </div>
      {selected && (
        <>
          <span className="rounded-chip pointer-events-none absolute -top-6 left-0 flex h-5 max-w-60 items-center gap-1 bg-[var(--node-accent)] px-1.5 font-mono text-[11px] leading-4 font-medium whitespace-nowrap text-white shadow-[var(--shadow-raised)]">
            <Icon variant="outline" className="size-3 flex-none" />
            <span className="truncate">{widget.id}</span>
            {dragging && (
              <span className="opacity-80 tabular-nums">
                {widget.x}, {widget.y} · {widget.w}×{widget.h}
              </span>
            )}
          </span>
          {HANDLES.map((h) => (
            <span
              key={h}
              aria-hidden
              className={cn(
                'absolute size-2 rounded-full border-[1.5px] border-[var(--node-accent)] bg-[var(--node-bg)] shadow-[var(--shadow-raised)]',
                // A finger's room around it, the handle drawn as it is.
                "touch:before:absolute touch:before:-inset-3 touch:before:content-['']",
                HANDLE_PLACE[h],
              )}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPress(e, h);
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
