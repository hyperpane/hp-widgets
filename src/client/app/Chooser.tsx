// A window with no panel yet: the project's panels to open one (kept
// current as any window adds, renames or deletes one), a new one, or one
// imported from an .hpw file.

import { useEffect, useState } from 'react';
import { formatAgo, useHost } from '@hyperpane/sdk/client';
import { Empty, NodeButton, NodeMessage, Toolbar, ToolbarSpacer, useMenu } from '@hyperpane/ui';
import { FileUp, LayoutDashboard, Plus } from 'lucide-react';
import type { Panel, PanelSummary } from '../../shared/index.ts';
import { useImport } from './useImport.tsx';

const PLUGIN = 'widgets';

export function Chooser({ project, onOpen }: { project: string; onOpen(id: string): void }) {
  const host = useHost();
  const [panels, setPanels] = useState<PanelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menu = useMenu();
  const importer = useImport(project, onOpen);

  useEffect(() => host.subscribe<PanelSummary[]>(PLUGIN, { op: 'panels', project }, setPanels, { onEnd: (e) => e && setError(e) }), [host, project]);

  const call = <T,>(request: Record<string, unknown>) =>
    host.call<T>(PLUGIN, { project, ...request }).catch((e: Error) => {
      host.app.toast(e.message, { error: true });
      return null;
    });

  const create = async () => {
    const p = await call<Panel>({ op: 'create', name: 'Panel' });
    if (p) onOpen(p.id);
  };

  const rowMenu = (e: React.MouseEvent, p: PanelSummary) =>
    menu.open(e, [
      { label: 'Open', run: () => onOpen(p.id) },
      { label: 'Duplicate', run: () => void call({ op: 'duplicate', id: p.id }) },
      {
        label: 'Rename',
        run: () =>
          void host.ui.prompt({ title: 'Rename panel', label: 'Name', value: p.name }).then((name) => {
            if (name?.trim()) void call({ op: 'rename', id: p.id, name: name.trim() });
          }),
      },
      null,
      {
        label: 'Delete',
        danger: true,
        run: () =>
          void host.ui
            .confirm({
              title: `Delete “${p.name}”?`,
              message: 'Its widgets and scripts are deleted from the project. Windows showing it close it.',
              confirm: 'Delete',
              destructive: true,
            })
            .then((yes) => yes && call({ op: 'delete', id: p.id })),
      },
    ]);

  if (error) return <NodeMessage error>{error}</NodeMessage>;

  return (
    <div className="flex h-full flex-col text-xs text-[var(--node-fg)]">
      <Toolbar>
        <span className="truncate px-1 font-medium">Panels</span>
        <ToolbarSpacer />
        <NodeButton variant="ghost" onClick={importer.open}>
          <FileUp /> Import .hpw
        </NodeButton>
        <NodeButton variant="primary" onClick={() => void create()}>
          <Plus /> New panel
        </NodeButton>
      </Toolbar>
      {importer.element}
      {!panels ? (
        <NodeMessage>Looking for panels</NodeMessage>
      ) : panels.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <Empty
            bordered={false}
            icon={<LayoutDashboard />}
            title="No panels in this project yet"
            description="A panel is a tool of your own: buttons, fields and logs laid out on a grid, with scripts that run commands on the server."
            action={
              <div className="flex gap-2">
                <NodeButton variant="primary" onClick={() => void create()}>
                  <Plus /> New panel
                </NodeButton>
                <NodeButton onClick={importer.open}>
                  <FileUp /> Import .hpw
                </NodeButton>
              </div>
            }
          />
        </div>
      ) : (
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1.5">
          {panels.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="rounded-chip flex h-9 w-full items-center gap-2.5 px-2 text-left hover:bg-[var(--node-hover)] touch:h-11"
                onClick={() => onOpen(p.id)}
                onContextMenu={(e) => rowMenu(e, p)}
              >
                <LayoutDashboard className="size-4 flex-none text-[var(--node-muted)]" />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="flex-none text-[var(--node-muted)] tabular-nums">
                  {p.widgets} widget{p.widgets === 1 ? '' : 's'} · {formatAgo(p.updated)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {menu.element}
    </div>
  );
}
