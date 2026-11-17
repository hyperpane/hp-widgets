// The panel at work in View mode: its state (runtime/state.ts), the user's
// changes to it, and widgets' scripts run on the server part. A run is the
// `invoke` subscription: the script's ops come back as it goes and are
// applied as they come, so a Log fills while its command runs. A button
// is busy while its script runs; Stop ends every run of this window. The
// values go out at the `values` port as they change.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { type Op, type Panel, TYPES, type Value, type Widget } from '../../shared/index.ts';
import { applyOp, appendLines, follow, initialState, type RunState, setValue } from './state.ts';

const PLUGIN = 'widgets';

export interface Runtime {
  state: RunState;
  /** Widgets whose scripts are running. */
  busy: ReadonlySet<string>;
  /** The user changed a widget's value; `fire` runs its change script. */
  change(w: Widget, value: unknown, fire: boolean): void;
  /** Runs a widget's script (a button's click, a field's change). */
  invoke(w: Widget, type: 'click' | 'change', value?: Value): void;
  stop(): void;
  /** Every value back to its default. */
  reset(): void;
}

export function useRuntime(panel: Panel, o: { project: string; window: number; flush(): Promise<void> }): Runtime {
  const host = useHost();
  const [state, setState] = useState<RunState>(() => initialState(panel));
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const live = useRef({ state, panel, o });
  live.current = { state, panel, o };

  // The panel changed (Dev mode, another window): values follow it.
  const shown = useRef(panel);
  useEffect(() => {
    if (shown.current === panel) return;
    const before = shown.current;
    shown.current = panel;
    setState((s) => follow(s, before, panel));
  }, [panel]);

  const runs = useRef(new Set<() => void>());
  useEffect(() => {
    const all = runs.current;
    return () => {
      for (const cancel of all) cancel();
      all.clear();
    };
  }, []);

  const mark = useCallback((id: string, on: boolean) => {
    setBusy((b) => {
      if (b.has(id) === on) return b;
      const next = new Set(b);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** A run's failure, where the user looks: a toast, and the first Log. */
  const failed = useCallback(
    (w: Widget, message: string) => {
      host.app.toast(`${w.id}: ${message}`, { error: true });
      const log = live.current.panel.widgets.find((x) => x.type === 'log');
      if (log) setState((s) => ({ ...s, values: { ...s.values, [log.id]: appendLines(String(s.values[log.id] ?? ''), `✖ ${w.id}: ${message}`) } }));
    },
    [host],
  );

  const invoke = useCallback(
    (w: Widget, type: 'click' | 'change', value: Value = null) => {
      if (!TYPES[w.type].event || !w.script.trim()) return;
      // A second click while it runs isn't a second run.
      if (type === 'click' && busy.has(w.id)) return;
      mark(w.id, true);
      const { project, window, flush } = live.current.o;
      void (async () => {
        // What runs is what's saved: an edit still waiting to be saved goes first.
        await flush().catch(() => {});
        let cancel: (() => void) | null = null;
        let ended = false;
        const end = () => {
          if (ended) return;
          ended = true;
          if (cancel) runs.current.delete(cancel);
          mark(w.id, false);
        };
        cancel = host.subscribe<Op>(
          PLUGIN,
          // The values as the event happened: a change's own is in already.
          {
            op: 'invoke',
            project,
            window,
            panel: live.current.panel.id,
            widget: w.id,
            type,
            value,
            values: { ...live.current.state.values, ...(type === 'change' ? { [w.id]: value } : {}) },
          },
          (op) => {
            if (op.type === 'toast') host.app.toast(op.message, { error: op.error });
            else if (op.type === 'done') {
              if (op.error) failed(w, op.error);
              end();
            } else setState((s) => applyOp(s, op, live.current.panel));
          },
          {
            // Never again on its own: a server restart mustn't run a deploy twice.
            resume: false,
            onEnd: (error) => {
              if (error && !ended) failed(w, error);
              end();
            },
          },
        );
        if (!ended) runs.current.add(cancel);
      })();
    },
    [host, busy, mark, failed],
  );

  const change = useCallback(
    (w: Widget, value: unknown, fire: boolean) => {
      setState((s) => setValue(s, w, value));
      if (fire) invoke(w, 'change', setValue(live.current.state, w, value).values[w.id] ?? null);
    },
    [invoke],
  );

  const stop = useCallback(() => {
    const { project, window } = live.current.o;
    host.call(PLUGIN, { op: 'stop', project, window }).catch((e: Error) => host.app.toast(e.message, { error: true }));
  }, [host]);

  const reset = useCallback(() => setState(initialState(live.current.panel)), []);

  // Out at the port, a moment after they settle (not a value per keystroke).
  useEffect(() => {
    const t = setTimeout(() => host.ports.emit('values', state.values), 150);
    return () => clearTimeout(t);
  }, [host, state.values]);

  return { state, busy, change, invoke, stop, reset };
}
