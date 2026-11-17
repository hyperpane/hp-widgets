// The .hpw file ("Hyperpane Widget"): one panel, to share or keep apart
// from a project. JSON, so it reads in a diff:
//
//   { "format": "hyperpane-widget", "version": 1, "panel": { "name", "width", "height", "widgets": [...] } }
//
// A panel's id isn't in it: an imported panel gets a fresh one in the
// project it goes into. Reading one is strict: the format and version
// must be these, and the panel is normalized (types it doesn't know left
// out, sizes clamped), with what changed said.

import { type Normalized, normalizePanel } from './model/normalize.ts';
import type { Panel } from './model/types.ts';

export const HPW_FORMAT = 'hyperpane-widget';
export const HPW_VERSION = 1;
/** The biggest .hpw read. */
export const HPW_MAX_BYTES = 5 * 1024 * 1024;

export interface HpwFile {
  format: typeof HPW_FORMAT;
  version: typeof HPW_VERSION;
  panel: Omit<Panel, 'id'>;
}

/** A panel as an .hpw file's text. */
export function toHpw(panel: Panel): string {
  const { id: _id, ...rest } = panel;
  const file: HpwFile = { format: HPW_FORMAT, version: HPW_VERSION, panel: rest };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** The panel in an .hpw file's text, normalized (its id empty). Throws an
 * Error whose message is for the user when it isn't one. */
export function fromHpw(text: string): Normalized {
  if (text.length > HPW_MAX_BYTES) throw new Error('This file is too big to be a panel (over 5 MB).');
  let file: unknown;
  try {
    // A byte order mark, which some editors write first, isn't JSON.
    file = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Error('This isn’t a .hpw file: it isn’t JSON.');
  }
  const o = (typeof file === 'object' && file !== null ? file : {}) as Record<string, unknown>;
  if (o.format !== HPW_FORMAT) throw new Error('This isn’t a .hpw file: its format isn’t “hyperpane-widget”.');
  if (o.version !== HPW_VERSION)
    throw new Error(`This .hpw file is version ${String(o.version)}; this Widgets reads version ${HPW_VERSION}. Update Widgets to open it.`);
  if (typeof o.panel !== 'object' || o.panel === null || Array.isArray(o.panel)) throw new Error('This .hpw file has no panel in it.');
  return normalizePanel(o.panel, { id: '' });
}

/** A file name for a panel: its name, without what file systems refuse. */
export function hpwFileName(name: string): string {
  const safe = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80);
  return `${safe || 'Panel'}.hpw`;
}
