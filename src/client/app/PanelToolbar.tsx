// The window's top bar (44px, as the Git window's): View or Dev (View
// whenever a window opens), and what each mode needs: Undo and Redo and
// whether it's saved in Dev; Stop while scripts run, and Reset in View.
// Export and a menu (rename, duplicate, import, other panels, delete) in
// both; narrow, Export is in the menu only. Every control here is 28px and
// every icon outlined, so the bar has one height and one weight.

import { keys } from '@hyperpane/sdk/client';
import { Button, Dot, HeaderBar, SegmentedControl, ToolbarSeparator, ToolButton } from '@hyperpane/ui';
import { Download, Ellipsis, Pencil, Play, Redo2, RotateCcw, Square, Undo2 } from '@hyperpane/icons';
import type { PanelState } from './usePanel.ts';

export type Mode = 'view' | 'dev';

const SAVED: Record<PanelState['save'], string> = { saved: 'Saved', waiting: 'Edited', saving: 'Saving', failed: 'Not saved' };
const SAVED_COLOR: Record<PanelState['save'], string> = {
  saved: 'var(--green)',
  waiting: 'var(--amber)',
  saving: 'var(--amber)',
  failed: 'var(--rose)',
};

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
    <HeaderBar className="gap-2 px-2">
      <SegmentedControl
        size="sm"
        label="Mode"
        value={mode}
        onValueChange={(v) => onMode(v as Mode)}
        options={[
          {
            value: 'view',
            label: (
              <>
                <Play variant="outline" className="size-3.5" /> View
              </>
            ),
          },
          {
            value: 'dev',
            label: (
              <>
                <Pencil variant="outline" className="size-3.5" /> Dev
              </>
            ),
          },
        ]}
      />
      {/* The window's title has the name; a second one here only if it's cut. */}
      {mode === 'dev' && (
        <span
          title={`${name}: ${SAVED[state.save].toLowerCase()}`}
          className={`ms-1 flex flex-none items-center gap-1.5 text-xs ${state.save === 'failed' ? 'text-[var(--rose)]' : 'text-[var(--node-muted)]'}`}
        >
          <Dot color={SAVED_COLOR[state.save]} pulse={state.save === 'saving'} />
          {SAVED[state.save]}
        </span>
      )}
      {mode === 'view' && running > 0 && (
        <span className="ms-1 flex flex-none items-center gap-1.5 text-xs text-[var(--node-muted)]">
          <Dot color="var(--green)" pulse />
          {running === 1 ? 'Running' : `${running} running`}
        </span>
      )}
      <span className="min-w-0 flex-1" />
      <span className="flex flex-none items-center gap-1">
        {mode === 'dev' ? (
          <>
            <ToolButton label={`Undo (${keys('⌘Z')})`} icon={Undo2} iconVariant="outline" disabled={!state.canUndo} onClick={state.undo} />
            <ToolButton label={`Redo (${keys('⇧⌘Z')})`} icon={Redo2} iconVariant="outline" disabled={!state.canRedo} onClick={state.redo} />
          </>
        ) : (
          <>
            {running > 0 && (
              <Button
                variant="secondary"
                color="destructive"
                size="sm"
                onClick={onStop}
                title="Stop the scripts running in this window, and the commands they started"
              >
                <Square variant="outline" /> Stop
              </Button>
            )}
            <ToolButton label="Reset the values" icon={RotateCcw} iconVariant="outline" onClick={onReset} />
          </>
        )}
        <span className="contents max-sm:hidden">
          <ToolbarSeparator className="mx-1" />
          <ToolButton label="Export as .hpw" icon={Download} iconVariant="outline" onClick={onExport} />
        </span>
        <ToolButton label="More" icon={Ellipsis} iconVariant="outline" onClick={onMenu} />
      </span>
    </HeaderBar>
  );
}
