// The panel at work in View mode: its state (runtime/state.ts), the user's
// changes to it, and scripts run on the server part: a widget's, and the
// panel's own (its Run). A run is the `invoke` subscription: the script's
// ops come back as it goes and are applied as they come, so a Log fills
// while its command runs. A button is busy while its script runs; Stop
// ends every run of this window. The values go out at the `values` port as
// they change.
//
// Its ports are the panel's: what comes in at an in-port is `inputs.<name>`
// to every script (and runs the panel, with Run when a value comes in);
// `output(name, value)` sends from an out-port. As a workflow's step
// (the Workflows plugin), it's run by `workflow.run` for its window, says
// so (`workflow.step`, again on `workflow.hello`) and says how a run went
// (`workflow.state`).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { type Op, type Panel, TYPES, type Value, type Widget } from '../../shared/index.ts';
import { applyOp, appendLines, follow, initialState, type RunState, setValue } from './state.ts';

const PLUGIN = 'widgets';
/** The panel's own run among the busy: not an id a widget can have. */
export const RUN = '#run';

export interface Runtime {
  state: RunState;
  /** Widgets whose scripts are running. */
  busy: ReadonlySet<string>;
  /** The user changed a widget's value; `fire` runs its change script. */
  change(w: Widget, value: unknown, fire: boolean): void;
  /** Runs a widget's script (a button's click, a field's change). */
  invoke(w: Widget, type: 'click' | 'change', value?: Value): void;
  /** Runs the panel's own script (its Run), with what's at its in-ports. */
  run(): void;
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
    (whose: string, message: string) => {
      host.app.toast(`${whose}: ${message}`, { error: true });
      const log = live.current.panel.widgets.find((x) => x.type === 'log');
      if (log) setState((s) => ({ ...s, values: { ...s.values, [log.id]: appendLines(String(s.values[log.id] ?? ''), `✖ ${whose}: ${message}`) } }));
    },
    [host],
  );

  /** The latest value at each in-port. */
  const inputs = useRef<Record<string, unknown>>({});

  /** Says how the panel's run went, to the Workflows plugin's button. */
  const tell = useCallback(
    (state: 'running' | 'done' | 'error') => {
      host.bus.publish('workflow.state', { window: live.current.o.window, state }).catch(() => {});
    },
    [host],
  );

  /** A script run: `key` busy until it ends; `whose` names it in a failure. */
  const start = useCallback(
    (key: string, whose: string, request: { widget?: string; type: 'click' | 'change' | 'run'; value: Value; values: Record<string, Value> }) => {
      mark(key, true);
      if (key === RUN) tell('running');
      const { project, window, flush } = live.current.o;
      void (async () => {
        // What runs is what's saved: an edit still waiting to be saved goes first.
        await flush().catch(() => {});
        let cancel: (() => void) | null = null;
        let ended = false;
        let error = false;
        const end = () => {
          if (ended) return;
          ended = true;
          if (cancel) runs.current.delete(cancel);
          mark(key, false);
          if (key === RUN) tell(error ? 'error' : 'done');
        };
        const fail = (message: string) => {
          error = true;
          failed(whose, message);
        };
        cancel = host.subscribe<Op>(
          PLUGIN,
          { op: 'invoke', project, window, panel: live.current.panel.id, ...request, inputs: inputs.current },
          (op) => {
            if (op.type === 'toast') host.app.toast(op.message, { error: op.error });
            else if (op.type === 'output') host.ports.emit(op.port, op.value);
            else if (op.type === 'done') {
              if (op.error) fail(op.error);
              end();
            } else setState((s) => applyOp(s, op, live.current.panel));
          },
          {
            // Never again on its own: a server restart mustn't run a deploy twice.
            resume: false,
            onEnd: (e) => {
              if (e && !ended) fail(e);
              end();
            },
          },
        );
        if (!ended) runs.current.add(cancel);
      })();
    },
    [host, mark, failed, tell],
  );

  const invoke = useCallback(
    (w: Widget, type: 'click' | 'change', value: Value = null) => {
      if (!TYPES[w.type].event || !w.script.trim()) return;
      // A second click while it runs isn't a second run.
      if (type === 'click' && busy.has(w.id)) return;
      // The values as the event happened: a change's own is in already.
      const values = { ...live.current.state.values, ...(type === 'change' ? { [w.id]: value } : {}) };
      start(w.id, w.id, { widget: w.id, type, value, values });
    },
    [busy, start],
  );

  const running = busy.has(RUN);
  const run = useCallback(() => {
    if (!live.current.panel.onRun.trim() || running) return;
    start(RUN, 'run', { type: 'run', value: null, values: live.current.state.values });
  }, [running, start]);
  const runLatest = useRef(run);
  runLatest.current = run;

  // Its ports: the panel's in- and out-ports beside `values` (its type's
  // own), as the panel changes.
  const ins = panel.inputs.join('\n');
  const outs = panel.outputs.join('\n');
  useEffect(() => {
    const named = (list: string) => (list ? list.split('\n') : []);
    if (!ins && !outs) {
      host.ports.set(null);
      return;
    }
    host.ports.set([
      ...named(ins).map((id) => ({ id, label: id, direction: 'in' as const, type: 'any' })),
      { id: 'values', label: 'Values', direction: 'out', type: 'json' },
      ...named(outs).map((id) => ({ id, label: id, direction: 'out' as const, type: 'any' })),
    ]);
  }, [host, ins, outs]);

  // What comes in at each in-port: kept for the scripts, and with Run when
  // a value comes in, the panel run with it.
  useEffect(() => {
    const names = ins ? ins.split('\n') : [];
    inputs.current = Object.fromEntries(names.map((n) => [n, host.ports.value(n) ?? null]));
    const offs = names.map((n) =>
      host.ports.onInput(n, (value) => {
        inputs.current = { ...inputs.current, [n]: value };
        if (live.current.panel.runOnInput) runLatest.current();
      }),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [host, ins]);

  // A workflow's step: run from the Workflows plugin's button.
  const runnable = !!panel.onRun.trim();
  useEffect(() => {
    const { window } = live.current.o;
    const announce = () => host.bus.publish('workflow.step', { window, runnable }).catch(() => {});
    announce();
    const offRun = host.bus.subscribe('workflow.run', (e) => {
      if ((e.data as { window?: unknown } | null)?.window === window) runLatest.current();
    });
    const offHello = host.bus.subscribe('workflow.hello', announce);
    return () => {
      offRun();
      offHello();
    };
  }, [host, runnable]);

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

  return { state, busy, change, invoke, run, stop, reset };
}
