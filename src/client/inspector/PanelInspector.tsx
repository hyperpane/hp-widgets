// The inspector with nothing selected: the panel itself, its name and its
// canvas's size (never smaller than what's on it), its ports and what it
// does when it's run (a workflow's step), and its widgets, a click away.

import { LayoutDashboard } from '@hyperpane/icons';
import { EmptyNote, HeaderBar, IconTile, List, cn, styles } from '@hyperpane/ui';
import { MAX_CANVAS, MIN_CANVAS, type Panel } from '../../shared/index.ts';
import { canvasFits } from '../lib/layout.ts';
import { REGISTRY } from '../widgets/registry.ts';
import { LinesField, NumberField, Section, SwitchField, TextField } from './fields.tsx';
import { ScriptField } from './ScriptField.tsx';
import type { Edit } from './WidgetInspector.tsx';

const RUN_PLACEHOLDER =
  "// Runs on the server when the panel is run: its Run button, or a value\n// coming in. What's linked to its in-ports is in `inputs`.\nconst text = String(inputs.file ?? '');\nui.set('status', text.length + ' characters');\noutput('result', text.toUpperCase());";

export function PanelInspector({ panel, edit, onSelect }: { panel: Panel; edit: Edit; onSelect(id: string): void }) {
  const fits = canvasFits(panel);
  const size = (k: 'width' | 'height', v: number) => {
    const least = Math.max(MIN_CANVAS[k], k === 'width' ? fits.width : fits.height);
    edit((p) => ({ ...p, [k]: Math.round(Math.min(Math.max(v, least), MAX_CANVAS)) }), `panel.${k}`);
  };
  return (
    <>
      <HeaderBar
        className="sticky top-0 z-10 bg-[var(--node-bg)] px-4"
        icon={<IconTile size="xs" icon={<LayoutDashboard />} />}
        title="Panel"
        meta={`${panel.widgets.length} widget${panel.widgets.length === 1 ? '' : 's'}`}
      />
      <Section title="Panel">
        <TextField label="Name" value={panel.name} onChange={(name) => edit((p) => ({ ...p, name }), 'panel.name')} />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Width" value={panel.width} min={MIN_CANVAS.width} max={MAX_CANVAS} step={8} onChange={(v) => size('width', v)} />
          <NumberField label="Height" value={panel.height} min={MIN_CANVAS.height} max={MAX_CANVAS} step={8} onChange={(v) => size('height', v)} />
        </div>
      </Section>
      <Section title="Ports">
        <LinesField label="In" value={panel.inputs} onChange={(inputs) => edit((p) => ({ ...p, inputs: inputs.map((n) => n.trim()) }), 'panel.inputs')} />
        <LinesField label="Out" value={panel.outputs} onChange={(outputs) => edit((p) => ({ ...p, outputs: outputs.map((n) => n.trim()) }), 'panel.outputs')} />
        <p className="m-0 text-xs leading-[18px] text-[var(--node-muted)]">
          Link them in Nodes mode. A script reads what came in as <code className="font-mono text-[11px] text-[var(--node-fg)]">inputs.name</code> and
          sends with <code className="font-mono text-[11px] text-[var(--node-fg)]">output('name', value)</code>.
        </p>
      </Section>
      <Section title="On run">
        <ScriptField
          title={`${panel.name} · On run`}
          label="The panel’s script, run when it’s run"
          value={panel.onRun}
          placeholder={RUN_PLACEHOLDER}
          onChange={(onRun) => edit((p) => ({ ...p, onRun }), 'panel.onRun')}
        />
        <SwitchField
          label="Run when a value comes in"
          value={panel.runOnInput}
          onChange={(runOnInput) => edit((p) => ({ ...p, runOnInput }), 'panel.runOnInput')}
        />
      </Section>
      <Section title="Widgets" aside={panel.widgets.length > 0 && <span className="pe-1 text-xs text-[var(--node-muted)] tabular-nums">{panel.widgets.length}</span>}>
        {panel.widgets.length === 0 ? (
          <EmptyNote inset className="text-xs">
            Nothing here yet. Click a widget in the palette to add it, or drag it onto the canvas.
          </EmptyNote>
        ) : (
          <List className="-mx-2.5 px-0 py-0">
            {panel.widgets.map((w) => {
              const Icon = REGISTRY[w.type].icon;
              return (
                <button key={w.id} type="button" className={cn(styles.row.base, styles.row.compact, styles.focusRingInset, 'w-full text-start')} onClick={() => onSelect(w.id)}>
                    <Icon variant="outline" className="size-3.5 flex-none text-[var(--node-muted)] group-hover/row:text-[var(--node-fg)]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{w.id}</span>
                    <span className="flex-none text-xs text-[var(--node-muted)]">{REGISTRY[w.type].title}</span>
                </button>
              );
            })}
          </List>
        )}
      </Section>
    </>
  );
}
