// The panel a window shows: loaded from the server part, edited here, and
// saved a moment after each change (400ms after the last, so a drag or a
// word is one save), one save at a time. Undo and redo step through its
// edits (lib/history.ts). Another window saving it shows here, unless this
// one has an edit waiting; it being deleted says so.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { normalizePanel, type Panel } from '../../shared/index.ts';
import { emptyHistory, type History, record, redo as redoStep, undo as undoStep } from '../lib/history.ts';

const PLUGIN = 'widgets';
const SAVE_AFTER_MS = 400;

export type SaveState = 'saved' | 'waiting' | 'saving' | 'failed';

export interface PanelState {
  panel: Panel | null;
  error: string | null;
  save: SaveState;
  /** Changes the panel: one Undo step, or part of the last one when `key`
   * is the same and it's soon after (typing). */
  edit(change: (p: Panel) => Panel, key?: string | null): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Saves what's waiting now; resolves once it's saved. */
  flush(): Promise<void>;
}

export function usePanel(id: string, project: string, window: number): PanelState {
  const host = useHost();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('saved');
  const [history, setHistory] = useState<History<Panel>>(emptyHistory);
  const current = useRef<Panel | null>(null);
  const hist = useRef(history);
  hist.current = history;

  // What's waiting to be saved, its timer, and the save under way.
  const waiting = useRef<Panel | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  /** A panel as the server part sent it, sound here: one from an older part
   * lacks what's newer (its ports, its run). */
  const sound = (p: Panel) => normalizePanel(p, { id: p.id }).panel;

  useEffect(() => {
    let live = true;
    host.call<Panel>(PLUGIN, { op: 'load', project, id }).then(
      (raw) => {
        if (!live) return;
        const p = sound(raw);
        current.current = p;
        setPanel(p);
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [host, project, id]);

  // Saved by another window (or deleted).
  useEffect(
    () =>
      host.subscribe<{ panel: Panel | null; by: number | null }>(PLUGIN, { op: 'watch', project, id }, ({ panel: raw, by }) => {
        if (by === window) return;
        if (!raw) {
          setError('This panel was deleted.');
          return;
        }
        if (waiting.current) return;
        const p = sound(raw);
        current.current = p;
        setPanel(p);
      }),
    [host, project, id, window],
  );

  const send = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = waiting.current;
    if (!p) return saving.current;
    waiting.current = null;
    setSave('saving');
    saving.current = saving.current
      .then(() => host.call(PLUGIN, { op: 'save', project, panel: p, window }))
      .then(
        () => setSave(waiting.current ? 'waiting' : 'saved'),
        (e: Error) => {
          setSave('failed');
          host.app.toast(`Couldn’t save “${p.name}”`, { description: e.message, error: true });
        },
      );
    return saving.current;
  }, [host, project, window]);

  const schedule = useCallback(
    (p: Panel) => {
      waiting.current = p;
      setSave('waiting');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void send(), SAVE_AFTER_MS);
    },
    [send],
  );

  // An edit still waiting goes as the window goes.
  useEffect(() => () => void send(), [send]);

  const show = useCallback(
    (p: Panel) => {
      current.current = p;
      setPanel(p);
      schedule(p);
    },
    [schedule],
  );

  const edit = useCallback(
    (change: (p: Panel) => Panel, key: string | null = null) => {
      const before = current.current;
      if (!before) return;
      const after = change(before);
      if (after === before) return;
      setHistory(record(hist.current, before, key));
      show(after);
    },
    [show],
  );

  const undo = useCallback(() => {
    const now = current.current;
    if (!now) return;
    const [h, p] = undoStep(hist.current, now);
    if (!p) return;
    setHistory(h);
    show(p);
  }, [show]);

  const redo = useCallback(() => {
    const now = current.current;
    if (!now) return;
    const [h, p] = redoStep(hist.current, now);
    if (!p) return;
    setHistory(h);
    show(p);
  }, [show]);

  return { panel, error, save, edit, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0, flush: send };
}
