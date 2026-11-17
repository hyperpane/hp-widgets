// The inspector with nothing selected: the panel itself, its name and its
// canvas's size (never smaller than what's on it), and its widgets, a
// click away.

import { MAX_CANVAS, MIN_CANVAS, type Panel } from '../../shared/index.ts';
import { canvasFits } from '../lib/layout.ts';
import { REGISTRY } from '../widgets/registry.ts';
import { NumberField, Section, TextField } from './fields.tsx';
import type { Edit } from './WidgetInspector.tsx';

export function PanelInspector({ panel, edit, onSelect }: { panel: Panel; edit: Edit; onSelect(id: string): void }) {
  const fits = canvasFits(panel);
  const size = (k: 'width' | 'height', v: number) => {
    const least = Math.max(MIN_CANVAS[k], k === 'width' ? fits.width : fits.height);
    edit((p) => ({ ...p, [k]: Math.round(Math.min(Math.max(v, least), MAX_CANVAS)) }), `panel.${k}`);
  };
  return (
    <>
      <Section title="Panel">
        <TextField label="Name" value={panel.name} onChange={(name) => edit((p) => ({ ...p, name }), 'panel.name')} />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" value={panel.width} min={MIN_CANVAS.width} max={MAX_CANVAS} step={8} onChange={(v) => size('width', v)} />
          <NumberField label="Height" value={panel.height} min={MIN_CANVAS.height} max={MAX_CANVAS} step={8} onChange={(v) => size('height', v)} />
        </div>
      </Section>
      <Section title={`Widgets (${panel.widgets.length})`}>
        {panel.widgets.length === 0 ? (
          <p className="rounded-control m-0 border border-dashed border-[var(--node-border)] px-3 py-4 text-center text-2xs leading-4 text-[var(--node-muted)]">
            Nothing here yet. Click a widget in the palette to add it, or drag it onto the canvas.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {panel.widgets.map((w) => {
              const Icon = REGISTRY[w.type].icon;
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    className="rounded-control group/row flex h-7 w-full items-center gap-2 px-1 text-left text-xs hover:bg-[var(--node-hover)]"
                    onClick={() => onSelect(w.id)}
                  >
                    <span className="rounded-chip flex size-5 flex-none items-center justify-center border border-[var(--node-border)] bg-[var(--node-header)] text-[var(--node-muted)] group-hover/row:text-[var(--node-fg)]">
                      <Icon className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{w.id}</span>
                    <span className="flex-none text-2xs text-[var(--node-muted)]">{REGISTRY[w.type].title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
