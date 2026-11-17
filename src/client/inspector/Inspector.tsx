// Dev mode's inspector, at the right: the selected widget's, or the
// panel's when nothing is selected. Wider on demand, for a script.

import type { Panel } from '../../shared/index.ts';
import { PanelInspector } from './PanelInspector.tsx';
import { type Edit, WidgetInspector } from './WidgetInspector.tsx';

export function Inspector({
  panel,
  selected,
  edit,
  onSelect,
  onDelete,
  onDuplicate,
  wide,
  onWide,
}: {
  panel: Panel;
  selected: string | null;
  edit: Edit;
  onSelect(id: string | null): void;
  onDelete(id: string): void;
  onDuplicate(id: string): void;
  wide: boolean;
  onWide(wide: boolean): void;
}) {
  const widget = selected ? panel.widgets.find((w) => w.id === selected) : undefined;
  return (
    <aside aria-label="Inspector" className={`flex flex-none flex-col overflow-y-auto border-l border-[var(--node-border)] ${wide ? 'w-[480px]' : 'w-72'}`}>
      {widget ? (
        <WidgetInspector
          // A widget of its own each: fields typed into don't carry over.
          key={widget.id}
          panel={panel}
          widget={widget}
          edit={edit}
          onRenamed={onSelect}
          onDelete={() => onDelete(widget.id)}
          onDuplicate={() => onDuplicate(widget.id)}
          wide={wide}
          onWide={onWide}
        />
      ) : (
        <PanelInspector panel={panel} edit={edit} onSelect={onSelect} />
      )}
    </aside>
  );
}

export type { Edit };
