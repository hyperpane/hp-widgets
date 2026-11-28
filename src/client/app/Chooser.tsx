// A window with no panel yet: the project's panels to open one (kept
// current as any window adds, renames or deletes one), a new one, or one
// imported from an .hpw file.

import { useEffect, useState } from 'react';
import { formatAgo, useHost } from '@hyperpane/sdk/client';
import { Button, Empty, HeaderBar, IconTile, List, ListRow, Spinner, ToolButton, useMenu } from '@hyperpane/ui';
import { CircleAlert, Ellipsis, FileUp, LayoutDashboard, Plus } from '@hyperpane/icons';
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

  if (error)
    return (
      <Empty
        bordered={false}
        size="compact"
        className="h-full"
        icon={<CircleAlert className="text-[var(--rose)]" />}
        title="Couldn’t list the panels"
        description={error}
      />
    );

  const empty = panels?.length === 0;
  return (
    <div className="flex h-full flex-col text-[13px] leading-5 text-[var(--node-fg)]">
      <HeaderBar
        // Its title lines up with the rows' tiles; the buttons sit as far
        // from the end as from the top and bottom.
        className="ps-4 pe-2"
        icon={<LayoutDashboard />}
        title="Panels"
        meta={panels && panels.length > 0 ? panels.length : undefined}
        actions={
          // While there are none, the empty state below has these: one place for them.
          !empty && (
            <>
              <Button variant="ghost" size="sm" onClick={importer.open}>
                <FileUp variant="outline" /> Import .hpw
              </Button>
              <Button variant="default" tint="var(--node-accent)" size="sm" onClick={() => void create()}>
                <Plus variant="outline" /> New panel
              </Button>
            </>
          )
        }
      />
      {importer.element}
      {!panels ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[var(--node-muted)]">
          <Spinner size="xs" />
          Looking for panels
        </div>
      ) : empty ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <Empty
            bordered={false}
            icon={<LayoutDashboard />}
            title="No panels in this project yet"
            description="A panel is a tool of your own: buttons, fields and logs laid out on a grid, with scripts that run commands on the server."
            action={
              <>
                <Button variant="default" tint="var(--node-accent)" size="sm" onClick={() => void create()}>
                  <Plus variant="outline" /> New panel
                </Button>
                <Button variant="secondary" size="sm" onClick={importer.open}>
                  <FileUp variant="outline" /> Import .hpw
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <List role="list" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {panels.map((p) => (
            <ListRow
              key={p.id}
              size="tall"
              role="listitem"
              tabIndex={0}
              className="cursor-default"
              tile={<IconTile size="sm" icon={<LayoutDashboard />} />}
              title={p.name}
              description={`${p.widgets} widget${p.widgets === 1 ? '' : 's'}`}
              meta={formatAgo(p.updated)}
              actions={<ToolButton label={`More for ${p.name}`} icon={Ellipsis} iconVariant="outline" onClick={(e) => rowMenu(e, p)} />}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('[data-slot="list-row-actions"]')) onOpen(p.id);
              }}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onOpen(p.id);
                }
              }}
              onContextMenu={(e) => rowMenu(e, p)}
            />
          ))}
        </List>
      )}
      {menu.element}
    </div>
  );
}
