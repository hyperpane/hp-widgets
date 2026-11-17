// The project's panels: a JSON file each in the plugin's storage in the
// project (`<project>/.hyperpane/widgets/<id>.json`), so a team that
// commits the project shares its panels. Every panel read or written is
// normalized, so whatever is in a file (an edit by hand, a merge) reaches
// the windows sound. Changes are told to those watching (the chooser's
// list, the other windows showing a panel).

import { EventEmitter } from 'node:events';
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { type Host, PluginError } from '@hyperpane/sdk/server';
import { emptyPanel, isPanelId, newPanelId, normalizePanel, type Panel, type PanelSummary, uniqueName } from '../../shared/index.ts';
import { readJson, writeAtomic } from './files.ts';

/** What a watcher hears: a panel saved (`by` the window that saved it, so
 * that one can skip its own), or deleted (`panel` null). */
export interface PanelChange {
  project: string;
  id: string;
  panel: Panel | null;
  by: number | null;
}

export class PanelStore {
  readonly #host: Host;
  readonly changes = new EventEmitter();

  constructor(host: Host) {
    this.#host = host;
    // A watcher per window; a busy canvas has many.
    this.changes.setMaxListeners(0);
  }

  async #dir(project: unknown): Promise<string> {
    if (typeof project !== 'string' || !project) throw new PluginError('Open a project to keep panels in it.');
    return this.#host.projectStorage(project);
  }

  async #file(project: unknown, id: unknown): Promise<string> {
    if (!isPanelId(id)) throw new PluginError('That isn’t a panel’s id.');
    return path.join(await this.#dir(project), `${id}.json`);
  }

  /** Every panel, by name. A file that isn't a panel is left out (and
   * logged), not the whole list. */
  async list(project: string): Promise<PanelSummary[]> {
    const dir = await this.#dir(project);
    const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.json') && isPanelId(n.slice(0, -5)));
    const out: PanelSummary[] = [];
    await Promise.all(
      names.map(async (n) => {
        const file = path.join(dir, n);
        try {
          const [raw, info] = await Promise.all([readJson(file), stat(file)]);
          if (raw === undefined) return;
          const { panel } = normalizePanel(raw, { id: n.slice(0, -5) });
          out.push({ id: panel.id, name: panel.name, widgets: panel.widgets.length, updated: info.mtimeMs });
        } catch (e) {
          this.#host.log(`Left ${n} out of the list: ${(e as Error).message}`);
        }
      }),
    );
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id));
  }

  async load(project: string, id: string): Promise<Panel> {
    const file = await this.#file(project, id);
    let raw: unknown;
    try {
      raw = await readJson(file);
    } catch (e) {
      if (e instanceof SyntaxError) throw new PluginError(`Couldn’t read the panel: ${id}.json isn’t JSON.`);
      throw e;
    }
    if (raw === undefined) throw new PluginError('This panel isn’t in the project any more: it may have been deleted.');
    return normalizePanel(raw, { id }).panel;
  }

  /** Writes a panel as it should be (normalized), and tells the watchers. */
  async save(project: string, panel: unknown, by: number | null = null): Promise<{ panel: Panel; warnings: string[] }> {
    const id = (panel as { id?: unknown } | null)?.id;
    const file = await this.#file(project, id);
    const { panel: sound, warnings } = normalizePanel(panel, { id: id as string });
    await writeAtomic(file, `${JSON.stringify(sound, null, 2)}\n`);
    this.#tell({ project, id: sound.id, panel: sound, by });
    return { panel: sound, warnings };
  }

  async #names(project: string, except?: string): Promise<string[]> {
    return (await this.list(project)).filter((p) => p.id !== except).map((p) => p.name);
  }

  /** A new, empty panel, named so no other is. */
  async create(project: string, name = 'Panel'): Promise<Panel> {
    const panel = emptyPanel(newPanelId(), uniqueName(String(name).slice(0, 100), await this.#names(project)));
    return (await this.save(project, panel)).panel;
  }

  async rename(project: string, id: string, name: string): Promise<Panel> {
    const panel = await this.load(project, id);
    panel.name = uniqueName(String(name ?? '').slice(0, 100), await this.#names(project, id));
    return (await this.save(project, panel)).panel;
  }

  /** A copy, beside it: "Deploy copy". */
  async duplicate(project: string, id: string): Promise<Panel> {
    const panel = await this.load(project, id);
    const copy = { ...panel, id: newPanelId(), name: uniqueName(`${panel.name} copy`, await this.#names(project)) };
    return (await this.save(project, copy)).panel;
  }

  /** Adds a panel from elsewhere (an .hpw file): a fresh id, and its name
   * made unique. */
  async add(project: string, panel: Panel): Promise<Panel> {
    const fresh = { ...panel, id: newPanelId(), name: uniqueName(panel.name, await this.#names(project)) };
    return (await this.save(project, fresh)).panel;
  }

  async remove(project: string, id: string): Promise<void> {
    await rm(await this.#file(project, id), { force: true });
    this.#tell({ project, id, panel: null, by: null });
  }

  #tell(change: PanelChange) {
    this.changes.emit(change.project, change);
  }
}
