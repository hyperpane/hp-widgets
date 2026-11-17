// The server part's calls, apart from main.ts so the tests can make it with
// a test host:
//
//   list, load, save, create, rename, duplicate, delete   the project's panels (store/)
//   import, export                                       .hpw files (transfer/)
//   invoke (a subscription), stop                        widgets' scripts (runtime/)
//   panels, watch (subscriptions)                        the list, and a panel, as they change

import { type Host, json, PluginError } from '@hyperpane/sdk/server';
import { TYPES, type Value } from '../shared/index.ts';
import { type Done, runHandler } from './runtime/handler.ts';
import { Runs } from './runtime/runs.ts';
import { type PanelChange, PanelStore } from './store/panels.ts';
import { exportPanel, importPanel } from './transfer/hpw.ts';

const windowOf = (w: unknown): number => (typeof w === 'number' && Number.isInteger(w) ? w : 0);

export const widgets = json((host: Host) => {
  const store = new PanelStore(host);
  const runs = new Runs();

  function projectInfo(project: unknown) {
    const p = typeof project === 'string' ? host.projects().find((x) => x.id === project) : undefined;
    if (!p) throw new PluginError('Open a project to run its panels.');
    return { id: p.id, name: p.name, folder: p.folder };
  }

  /** Until the subscription is cancelled. */
  const untilAborted = (signal: AbortSignal) => new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));

  return {
    calls: {
      list: ({ project }) => store.list(project),
      load: ({ project, id }) => store.load(project, id),
      save: async ({ project, panel, window }) => {
        const { panel: saved, warnings } = await store.save(project, panel, windowOf(window) || null);
        return { id: saved.id, warnings };
      },
      create: ({ project, name }) => store.create(project, typeof name === 'string' ? name : undefined),
      rename: ({ project, id, name }) => store.rename(project, id, name),
      duplicate: ({ project, id }) => store.duplicate(project, id),
      delete: async ({ project, id }) => {
        await store.remove(project, id);
        return null;
      },
      import: ({ project, text }) => importPanel(store, project, text),
      export: ({ project, id }) => exportPanel(store, project, id),
      stop: ({ project, window }) => runs.stop(String(project ?? ''), windowOf(window)),
    },

    subscriptions: {
      /** The list now, and again when a panel is added, saved or deleted. */
      panels: async ({ project }, out) => {
        out.emit(await store.list(project));
        const send = () =>
          void store.list(project).then(
            (l) => out.emit(l),
            () => {},
          );
        store.changes.on(project, send);
        await untilAborted(out.signal);
        store.changes.off(project, send);
      },

      /** A panel each time it's saved (by any window) or deleted. */
      watch: async ({ project, id }, out) => {
        if (typeof project !== 'string' || !project) throw new PluginError('Open a project to keep panels in it.');
        const send = (c: PanelChange) => c.id === id && out.emit({ panel: c.panel, by: c.by });
        store.changes.on(project, send);
        await untilAborted(out.signal);
        store.changes.off(project, send);
      },

      /** Runs a widget's script: what it does to the window as it goes,
       * then `done`. The saved panel's script, so what runs is what the
       * project has. */
      invoke: async (req, out) => {
        const project = projectInfo(req.project);
        const panel = await store.load(project.id, req.panel);
        const widget = panel.widgets.find((w) => w.id === req.widget);
        if (!widget) throw new PluginError(`There’s no widget “${String(req.widget)}” in this panel.`);
        if (!TYPES[widget.type].event || !widget.script.trim()) {
          out.emit({ type: 'done', ok: true } satisfies Done);
          return;
        }
        const run = runs.start(project.id, windowOf(req.window));
        // Stopped from the window (Stop), or the window gone (its
        // subscription cancelled): either ends it.
        const signal = AbortSignal.any([run.signal, out.signal]);
        try {
          const values = typeof req.values === 'object' && req.values !== null ? (req.values as Record<string, Value>) : {};
          const done = await runHandler({
            host,
            project,
            panel,
            widget,
            event: { type: req.type === 'change' ? 'change' : 'click', value: (req.value ?? null) as Value },
            values,
            emit: (op) => void out.emit(op),
            signal,
          });
          out.emit(done);
        } finally {
          run.end();
        }
      },
    },

    windowClosed: (project, window) => void runs.stop(project, window),
    projectOff: (project) => runs.stopAll(project),
    busy: () => runs.busy,
    shutdown: () => runs.stopAll(),
  };
});
