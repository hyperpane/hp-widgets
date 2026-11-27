// Dev mode's inspector, at the right: the selected widget's, or the
// panel's when nothing is selected (a narrow window's sheet, it fills).
// A script is written in an editor of its own (ScriptField).

import { cn } from '@hyperpane/ui';
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
  className,
}: {
  panel: Panel;
  selected: string | null;
  edit: Edit;
  onSelect(id: string | null): void;
  onDelete(id: string): void;
  onDuplicate(id: string): void;
  className?: string;
}) {
  const widget = selected ? panel.widgets.find((w) => w.id === selected) : undefined;
  return (
    <aside aria-label="Inspector" className={cn('flex w-72 flex-none flex-col overflow-y-auto border-l border-[var(--hairline)]', className)}>
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
        />
      ) : (
        <PanelInspector panel={panel} edit={edit} onSelect={onSelect} />
      )}
    </aside>
  );
}

export type { Edit };
