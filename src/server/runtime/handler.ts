// One run of a widget's script: the names it's given (values, event, ui,
// run, sleep, project, console), what each does to the window, sent as ops
// as it happens, and how it ends. A stopped run ends at once: its
// processes are killed, its timers cleared, and whatever it does after
// that (it may still be awaiting) throws and reaches no window.

import { format } from 'node:util';
import type { Host } from '@hyperpane/sdk/server';
import { coerce, LOG_LINES, type Op, type Panel, PROP_NAMES, type PropName, rangeOf, TYPES, type Value, type Widget } from '../../shared/index.ts';
import { folderFor, runCommand } from './processes.ts';
import { runScript, ScriptError, scriptError } from './sandbox.ts';

export interface HandlerRun {
  host: Host;
  project: { id: string; name: string; folder: string };
  panel: Panel;
  widget: Widget;
  event: { type: 'click' | 'change'; value: Value };
  values: Record<string, Value>;
  emit(op: Op): void;
  signal: AbortSignal;
}

export type Done = Extract<Op, { type: 'done' }>;

class Stopped extends Error {
  constructor() {
    super('The run was stopped.');
    this.name = 'Stopped';
  }
}

/** Runs the widget's script; resolves with the `done` op (never rejects). */
export async function runHandler(r: HandlerRun): Promise<Done> {
  const filename = `${r.panel.name}/${r.widget.id}.js`;
  const widgets = new Map(r.panel.widgets.map((w) => [w.id, w]));
  const firstLog = r.panel.widgets.find((w) => w.type === 'log')?.id ?? null;
  const current: Record<string, Value> = { ...r.values };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  // Over when it's stopped, and when it has ended: a command it started
  // and didn't wait for is killed then, and what it does later is dropped.
  const over = new AbortController();
  const stop = () => over.abort();
  r.signal.addEventListener('abort', stop, { once: true });
  if (r.signal.aborted) stop();

  const alive = () => {
    if (over.signal.aborted) throw new Stopped();
  };
  const emit = (op: Op) => {
    alive();
    r.emit(op);
  };
  const widget = (id: unknown, what: string): Widget => {
    const w = typeof id === 'string' ? widgets.get(id) : undefined;
    if (!w) throw new Error(`${what}: there’s no widget “${String(id)}” in this panel.`);
    return w;
  };
  const logWidget = (id: unknown, what: string): string => {
    if (id === undefined || id === null) {
      if (!firstLog) throw new Error(`${what}: this panel has no Log to write to.`);
      return firstLog;
    }
    const w = widget(id, what);
    if (w.type !== 'log') throw new Error(`${what}: “${w.id}” is a ${w.type}, not a Log.`);
    return w.id;
  };

  /** Lines into a Log, as the window keeps them (only the last LOG_LINES). */
  const log = (id: string, text: string) => {
    const lines = text.split('\n');
    const kept = lines.length > LOG_LINES ? lines.slice(-LOG_LINES) : lines;
    const before = typeof current[id] === 'string' && current[id] !== '' ? String(current[id]).split('\n') : [];
    current[id] = [...before, ...kept].slice(-LOG_LINES).join('\n');
    emit({ type: 'log', id, text: kept.join('\n') });
  };

  const set = (id: unknown, value: unknown) => {
    const w = widget(id, 'ui.set');
    const kind = TYPES[w.type].value;
    if (kind === 'none') throw new Error(`ui.set: a ${w.type} has no value (ui.prop('${w.id}', 'label', 'New label') changes its label)`);
    if (kind === 'log') {
      current[w.id] = '';
      emit({ type: 'clear', id: w.id });
      if (value !== '' && value !== null && value !== undefined) log(w.id, String(value));
      return;
    }
    const v = coerce(kind, value, rangeOf(w));
    current[w.id] = v;
    emit({ type: 'set', id: w.id, value: v });
  };

  const ui = Object.freeze({
    get: (id: unknown) => {
      const w = widget(id, 'ui.get');
      return Object.hasOwn(current, w.id) ? current[w.id] : null;
    },
    set,
    prop: (id: unknown, name: unknown, value: unknown) => {
      const w = widget(id, 'ui.prop');
      if (typeof name !== 'string' || !PROP_NAMES.includes(name as PropName))
        throw new Error(`ui.prop: “${String(name)}” isn’t a prop (${PROP_NAMES.join(', ')}).`);
      // The value of a field, a bar's progress, a Text's text: as ui.set.
      if (name === 'value' || (name === 'text' && (w.type === 'text' || w.type === 'badge'))) return set(w.id, value);
      let v: unknown = value;
      if (name === 'disabled' || name === 'hidden') v = !!value;
      else if (name === 'options') {
        if (!Array.isArray(value)) throw new Error('ui.prop: options are a list of text.');
        v = value.map((o) => String(o));
      } else if (name === 'min' || name === 'max' || name === 'step') v = coerce('number', value);
      else v = value === null || value === undefined ? '' : String(value);
      emit({ type: 'prop', id: w.id, name: name as PropName, value: v });
    },
    log: (...args: unknown[]) => {
      // ui.log(id, text…) writes to that Log; ui.log(text…), whose first
      // word isn't a Log's id, to the first one.
      const named = args.length > 1 && typeof args[0] === 'string' && widgets.get(args[0])?.type === 'log';
      const [id, ...rest] = named ? args : [null, ...args];
      log(logWidget(id, 'ui.log'), format(...rest));
    },
    clear: (id?: unknown) => {
      const at = logWidget(id, 'ui.clear');
      current[at] = '';
      emit({ type: 'clear', id: at });
    },
    toast: (message: unknown, o?: { error?: boolean }) => emit({ type: 'toast', message: String(message), error: !!o?.error }),
  });

  /** console.* goes to the first Log, else to the plugin's log. */
  const write = (...args: unknown[]) => {
    alive();
    if (firstLog) log(firstLog, format(...args));
    else r.host.log(`[${filename}]`, format(...args));
  };
  const console = Object.freeze({ log: write, info: write, warn: write, error: write, debug: write });

  const run = async (command: unknown, o: { log?: string | false | null; env?: Record<string, unknown>; cwd?: string } = {}) => {
    alive();
    if (typeof command !== 'string' || !command.trim()) throw new Error('run: give it a command line, as you’d type it in a terminal.');
    const into = o.log === false ? null : o.log === undefined || o.log === null ? firstLog : logWidget(o.log, 'run');
    const env = o.env && typeof o.env === 'object' ? Object.fromEntries(Object.entries(o.env).map(([k, v]) => [k, String(v)])) : undefined;
    const ran = await runCommand(r.host, {
      command,
      cwd: folderFor(r.project.folder, o.cwd),
      env,
      project: r.project.id,
      signal: over.signal,
      onLines: into ? (text) => !over.signal.aborted && log(into, text) : undefined,
    });
    alive();
    return { code: ran.code, output: ran.output };
  };

  const sleep = (ms: unknown) =>
    new Promise<void>((resolve, reject) => {
      if (over.signal.aborted) return reject(new Stopped());
      const t = setTimeout(
        () => {
          timers.delete(t);
          resolve();
        },
        Math.max(0, Number(ms) || 0),
      );
      timers.add(t);
    });

  // Timers a script sets go when the run does.
  const setTimeoutIn = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    alive();
    const t = setTimeout(() => {
      timers.delete(t);
      if (!over.signal.aborted) fn(...args);
    }, ms);
    timers.add(t);
    return t;
  };
  const setIntervalIn = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    alive();
    const t = setInterval(() => (over.signal.aborted ? clearInterval(t) : fn(...args)), ms);
    timers.add(t);
    return t;
  };
  const clear = (t: ReturnType<typeof setTimeout>) => {
    clearTimeout(t);
    timers.delete(t);
  };

  const globals = {
    values: Object.freeze({ ...r.values }),
    event: Object.freeze({ widget: r.widget.id, type: r.event.type, value: r.event.value }),
    ui,
    run,
    sleep,
    project: Object.freeze({ ...r.project }),
    console,
    setTimeout: setTimeoutIn,
    setInterval: setIntervalIn,
    clearTimeout: clear,
    clearInterval: clear,
    fetch: globalThis.fetch,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
  };

  const stopped = new Promise<Done>((resolve) => {
    if (r.signal.aborted) resolve({ type: 'done', ok: false, cancelled: true });
    r.signal.addEventListener('abort', () => resolve({ type: 'done', ok: false, cancelled: true }), { once: true });
  });
  const ran = runScript(r.widget.script, globals, filename).then(
    (): Done => ({ type: 'done', ok: true }),
    (e): Done => {
      if (r.signal.aborted || (e instanceof ScriptError && /^Stopped: /.test(e.message))) return { type: 'done', ok: false, cancelled: true };
      return { type: 'done', ok: false, error: scriptError(e, filename).message };
    },
  );
  try {
    return await Promise.race([ran, stopped]);
  } finally {
    r.signal.removeEventListener('abort', stop);
    stop();
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }
}
