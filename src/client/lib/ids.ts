// Widgets' ids as the editor makes them: a new one's (`button1`), a copy's
// (`deploy2`), and an id typed in the inspector, checked against the
// others. The rules are the shared ones (src/shared/model/ids.ts), which the
// server applies too.

import { idProblem, newWidgetId, uniqueId, type Widget } from '../../shared/index.ts';

export { newWidgetId };

/** A copy's id: the original's, counted on. */
export const copyId = (of: Widget, widgets: readonly Widget[]) =>
  uniqueId(
    of.id,
    widgets.map((w) => w.id),
  );

/** Why `id` can't be this widget's new id, or null. */
export const renameProblem = (widget: Widget, id: string, widgets: readonly Widget[]) =>
  idProblem(
    id,
    widgets.filter((w) => w !== widget).map((w) => w.id),
  );

/** A widget's id changed, and every condition that named it with it (a
 * script's `ui.set('old', …)` is text the editor can't follow: those are
 * the user's to change). */
export function renameIn(widgets: readonly Widget[], from: string, to: string): Widget[] {
  const word = new RegExp(`(?<![A-Za-z0-9_$.'"])${from.replace(/\$/g, '\\$')}(?![A-Za-z0-9_$'"])`, 'g');
  return widgets.map((w) => ({
    ...w,
    id: w.id === from ? to : w.id,
    visibleWhen: w.visibleWhen.replace(word, to),
    enabledWhen: w.enabledWhen.replace(word, to),
  }));
}
