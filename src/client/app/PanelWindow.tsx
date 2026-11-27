// A window showing one panel: loaded and saved by usePanel, at work in
// View mode (always the mode a window opens in) or edited in Dev mode. Its
// values and running scripts (useRuntime) stay while the mode changes, so
// a tweak in Dev mode doesn't lose what was typed in View mode.

import { useEffect, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { Button, Empty, Spinner, useMenu } from '@hyperpane/ui';
import { CircleAlert } from '@hyperpane/icons';
import { hpwFileName, type Panel } from '../../shared/index.ts';
import { ViewCanvas } from '../canvas/ViewCanvas.tsx';
import { useRuntime } from '../runtime/useRuntime.ts';
import { DevMode } from './DevMode.tsx';
import { type Mode, PanelToolbar } from './PanelToolbar.tsx';
import { type PanelState, usePanel } from './usePanel.ts';
import { useImport } from './useImport.tsx';

const PLUGIN = 'widgets';

export function PanelWindow({ id, project, window, onOpen }: { id: string; project: string; window: number; onOpen(id: string | null): void }) {
  const state = usePanel(id, project, window);
  if (state.error) {
    return (
      <Empty
        bordered={false}
        size="compact"
        className="h-full"
        icon={<CircleAlert className="text-[var(--rose)]" />}
        title="Couldn’t open the panel"
        description={state.error}
        action={
          <Button variant="secondary" size="sm" onClick={() => onOpen(null)}>
            Choose another panel
          </Button>
        }
      />
    );
  }
  if (!state.panel)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-[13px] text-[var(--node-muted)]">
        <Spinner size="xs" />
        Opening the panel
      </div>
    );
  return <Loaded panel={state.panel} state={state} project={project} window={window} onOpen={onOpen} />;
}

function Loaded({
  panel,
  state,
  project,
  window,
  onOpen,
}: {
  panel: Panel;
  state: PanelState;
  project: string;
  window: number;
  onOpen(id: string | null): void;
}) {
  const host = useHost();
  const [mode, setMode] = useState<Mode>('view');
  const runtime = useRuntime(panel, { project, window, flush: state.flush });
  const menu = useMenu();
  const importer = useImport(project, (imported) => onOpen(imported));

  useEffect(() => host.win.setTitle(panel.name), [host, panel.name]);

  const call = <T,>(request: Record<string, unknown>) =>
    host.call<T>(PLUGIN, { project, ...request }).catch((e: Error) => {
      host.app.toast(e.message, { error: true });
      return null;
    });

  const exportIt = async () => {
    await state.flush();
    try {
      await host.app.saveStream(PLUGIN, { op: 'export', project, id: panel.id }, { name: hpwFileName(panel.name) });
    } catch (e) {
      host.app.toast(`Couldn’t export “${panel.name}”`, { description: (e as Error).message, error: true });
    }
  };

  const more = (e: React.MouseEvent) =>
    menu.open(e, [
      {
        label: 'Rename',
        run: () =>
          void host.ui.prompt({ title: 'Rename panel', label: 'Name', value: panel.name }).then(async (name) => {
            if (!name?.trim()) return;
            // Whatever is waiting first, so the rename isn't saved over.
            await state.flush();
            const renamed = await call<Panel>({ op: 'rename', id: panel.id, name: name.trim() });
            if (renamed) state.edit((p) => ({ ...p, name: renamed.name }), 'panel.name');
          }),
      },
      {
        label: 'Duplicate',
        run: () =>
          void state.flush().then(async () => {
            const copy = await call<Panel>({ op: 'duplicate', id: panel.id });
            if (copy) host.app.toast(`Made “${copy.name}”`);
          }),
      },
      { label: 'Export as .hpw', run: () => void exportIt() },
      { label: 'Import .hpw', run: importer.open },
      null,
      { label: 'Other panels', run: () => void state.flush().then(() => onOpen(null)) },
      null,
      {
        label: 'Delete panel',
        danger: true,
        run: () =>
          void host.ui
            .confirm({
              title: `Delete “${panel.name}”?`,
              message: 'Its widgets and scripts are deleted from the project.',
              confirm: 'Delete',
              destructive: true,
            })
            .then(async (yes) => {
              if (!yes) return;
              await state.flush();
              try {
                await host.call(PLUGIN, { op: 'delete', project, id: panel.id });
                onOpen(null);
              } catch (e) {
                host.app.toast(`Couldn’t delete “${panel.name}”`, { description: (e as Error).message, error: true });
              }
            }),
      },
    ]);

  return (
    <div className="flex h-full flex-col text-[13px] leading-5 text-[var(--node-fg)]">
      <PanelToolbar
        name={panel.name}
        mode={mode}
        onMode={(m) => {
          // Into View: what was edited is saved first, so a click runs it.
          if (m === 'view') void state.flush();
          setMode(m);
        }}
        state={state}
        running={runtime.busy.size}
        onStop={runtime.stop}
        onReset={runtime.reset}
        onExport={() => void exportIt()}
        onMenu={more}
      />
      {mode === 'dev' ? <DevMode state={state} /> : <ViewCanvas panel={panel} runtime={runtime} onEdit={() => setMode('dev')} />}
      {importer.element}
      {menu.element}
    </div>
  );
}
