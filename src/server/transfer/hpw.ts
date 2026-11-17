// Panels in and out of a project as .hpw files. Export answers with the
// file as a stream (a Blob in the reply), which the app writes where the
// person says (`app.saveStream`), straight from the server. Import takes
// the file's text, which the window read from the file the person picked,
// reads it strictly (src/shared/hpw.ts), and adds it as a new panel.

import { PluginError } from '@hyperpane/sdk/server';
import { fromHpw, hpwFileName, toHpw } from '../../shared/index.ts';
import type { PanelStore } from '../store/panels.ts';

export interface Exported {
  name: string;
  /** Its size, so the app's progress can say how far it is. */
  size: number;
  data: Blob;
}

export async function exportPanel(store: PanelStore, project: string, id: string): Promise<Exported> {
  const panel = await store.load(project, id);
  const data = new Blob([toHpw(panel)], { type: 'application/json' });
  return { name: hpwFileName(panel.name), size: data.size, data };
}

export interface Imported {
  id: string;
  name: string;
  /** What it changed or left out, for the user. */
  warnings: string[];
}

export async function importPanel(store: PanelStore, project: string, text: unknown): Promise<Imported> {
  if (typeof text !== 'string') throw new PluginError('There’s no file to import.');
  let read: ReturnType<typeof fromHpw>;
  try {
    read = fromHpw(text);
  } catch (e) {
    throw new PluginError((e as Error).message);
  }
  const panel = await store.add(project, read.panel);
  return { id: panel.id, name: panel.name, warnings: read.warnings };
}
