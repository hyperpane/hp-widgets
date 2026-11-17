// The window's toolbar: View or Dev (View whenever a window opens), the
// panel's name, and what each mode needs: Undo and Redo and whether it's
// saved in Dev; Stop while scripts run, and Reset in View. Export and a
// menu (rename, duplicate, import, other panels, delete) in both.

import { keys } from '@hyperpane/sdk/client';
import { NodeButton, SegmentedControl, Toolbar, ToolbarSeparator, ToolbarSpacer, ToolButton } from '@hyperpane/ui';
import { Download, Ellipsis, LoaderCircle, Pencil, Play, Redo2, RotateCcw, Square, Undo2 } from 'lucide-react';
import type { PanelState } from './usePanel.ts';

export type Mode = 'view' | 'dev';

const SAVED: Record<PanelState['save'], string> = { saved: 'Saved', waiting: 'Edited', saving: 'Saving', failed: 'Not saved' };

export function PanelToolbar({
  name,
  mode,
  onMode,
  state,
  running,
  onStop,
  onReset,
  onExport,
  onMenu,
}: {
  name: string;
  mode: Mode;
  onMode(mode: Mode): void;
  state: PanelState;
  /** Scripts running now. */
  running: number;
  onStop(): void;
  onReset(): void;
  onExport(): void;
  onMenu(e: React.MouseEvent): void;
}) {
  return (
    <Toolbar>
      <SegmentedControl
        size="xs"
        label="Mode"
        value={mode}
        onValueChange={(v) => onMode(v as Mode)}
        options={[
          {
            value: 'view',
            label: (
              <>
                <Play className="size-3" /> View
              </>
            ),
          },
          {
            value: 'dev',
            label: (
              <>
                <Pencil className="size-3" /> Dev
              </>
            ),
          },
        ]}
      />
      {/* The window's title has the name; a second one here only if it's cut. */}
      {mode === 'dev' && (
        <span
          title={name}
          className={`ms-1 flex flex-none items-center gap-1.5 text-2xs ${state.save === 'failed' ? 'text-[var(--ansi-1)]' : 'text-[var(--node-muted)]'}`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${state.save === 'saved' ? 'bg-[var(--ansi-2)]' : state.save === 'failed' ? 'bg-[var(--ansi-1)]' : 'animate-pulse bg-[var(--ansi-3)]'}`}
          />
          {SAVED[state.save]}
        </span>
      )}
      {mode === 'view' && running > 0 && (
        <span className="ms-1 flex flex-none items-center gap-1.5 text-2xs text-[var(--node-muted)]">
          <LoaderCircle className="size-3 animate-spin" />
          {running === 1 ? 'Running' : `${running} running`}
        </span>
      )}
      <ToolbarSpacer />
      {mode === 'dev' ? (
        <>
          <ToolButton label={`Undo (${keys('⌘Z')})`} icon={Undo2} disabled={!state.canUndo} onClick={state.undo} />
          <ToolButton label={`Redo (${keys('⇧⌘Z')})`} icon={Redo2} disabled={!state.canRedo} onClick={state.redo} />
        </>
      ) : (
        <>
          {running > 0 && (
            <NodeButton variant="danger" onClick={onStop} title="Stop the scripts running in this window, and the commands they started">
              <Square /> Stop
            </NodeButton>
          )}
          <ToolButton label="Reset the values" icon={RotateCcw} onClick={onReset} />
        </>
      )}
      <ToolbarSeparator />
      <ToolButton label="Export as .hpw" icon={Download} onClick={onExport} />
      <ToolButton label="More" icon={Ellipsis} onClick={onMenu} />
    </Toolbar>
  );
}
