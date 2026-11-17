// Dev mode: the palette at the left, the canvas in the middle, the
// inspector at the right, and the editor's keys: Delete or Backspace
// removes the selected widget, ⌘D copies it, the arrows nudge it (Shift: a
// grid step), Escape selects nothing, ⌘Z and ⇧⌘Z undo and redo. Keys typed
// into a script's editor stay its own.

import { type KeyboardEvent, useRef, useState } from 'react';
import { mod } from '@hyperpane/sdk/client';
import type { WidgetType } from '../../shared/index.ts';
import { DevCanvas, FIT_PAD } from '../canvas/DevCanvas.tsx';
import { useFit } from '../canvas/useFit.ts';
import { Inspector } from '../inspector/Inspector.tsx';
import { addWidget, duplicated, nudged, removed } from '../lib/layout.ts';
import { GRAB, Palette } from '../palette/Palette.tsx';
import type { PanelState } from './usePanel.ts';

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function DevMode({ state }: { state: PanelState }) {
  const panel = state.panel!;
  const { edit } = state;
  const [selected, setSelected] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  // Scaled down to fit the window whole, not below half (then it scrolls).
  const { box: fit, scale } = useFit(panel, { pad: FIT_PAD + 12, least: 0.5 });

  const select = (id: string | null) => {
    setSelected(id);
    // The editor's keys work from here on, wherever the focus was.
    if (id && !root.current?.contains(document.activeElement)) root.current?.focus({ preventScroll: true });
  };

  const add = (type: WidgetType, at?: { x: number; y: number }) => {
    let made = null as string | null;
    edit((p) => {
      const r = addWidget(p, type, at);
      made = r.id;
      return { ...p, widgets: r.widgets };
    });
    if (made) setSelected(made);
    root.current?.focus({ preventScroll: true });
  };

  const drop = (type: WidgetType, x: number, y: number) => {
    const r = surface.current?.getBoundingClientRect();
    if (!r || x < r.left || y < r.top || x > r.right || y > r.bottom) return;
    add(type, { x: (x - r.left) / scale - GRAB.x, y: (y - r.top) / scale - GRAB.y });
  };

  const remove = (id: string) => {
    edit((p) => ({ ...p, widgets: removed(p.widgets, id) }));
    setSelected(null);
  };

  const duplicate = (id: string) => {
    let made = null as string | null;
    edit((p) => {
      const r = duplicated(p, id);
      if (!r) return p;
      made = r.id;
      return { ...p, widgets: r.widgets };
    });
    if (made) setSelected(made);
  };

  const keys = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.cm-editor')) return;
    const typing = !!target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]');
    const key = e.key.toLowerCase();
    if (mod(e) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if (mod(e) && key === 'y') {
      e.preventDefault();
      state.redo();
      return;
    }
    if (typing) return;
    if (e.key === 'Escape' && selected) {
      e.preventDefault();
      setSelected(null);
      return;
    }
    if (!selected || !panel.widgets.some((w) => w.id === selected)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(selected);
    } else if (mod(e) && key === 'd') {
      e.preventDefault();
      duplicate(selected);
    } else if (ARROWS.has(e.key) && !mod(e) && !e.altKey) {
      e.preventDefault();
      edit((p) => ({ ...p, widgets: nudged(p, selected, e.key, e.shiftKey) }), `${selected}.nudge`);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the editor's keys (Delete, ⌘D, arrows, ⌘Z) for the canvas inside it; each also has a button.
    <div ref={root} tabIndex={-1} className="flex min-h-0 flex-1 outline-none" onKeyDown={keys}>
      <Palette onAdd={(t) => add(t)} onDrop={drop} scale={scale} />
      <DevCanvas panel={panel} selected={selected} onSelect={select} onCommit={(widgets) => edit((p) => ({ ...p, widgets }))} surface={surface} fit={fit} scale={scale} />
      <Inspector panel={panel} selected={selected} edit={edit} onSelect={select} onDelete={remove} onDuplicate={duplicate} wide={wide} onWide={setWide} />
    </div>
  );
}
