// Whether each widget shows and takes input, in View mode: its "Visible
// when" and "Enabled when" worked out against the values (src/shared/expr,
// no eval: the frame's CSP has none), unless a script said otherwise with
// ui.prop(id, 'hidden' | 'disabled', …). Pure.

import { holds, type Panel, type Scope } from '../../shared/index.ts';
import type { RunState } from './state.ts';

export interface Shown {
  visible: boolean;
  enabled: boolean;
}

/** Each widget's, by id. A group that's hidden or disabled takes the
 * widgets inside it along: a box around a form is how you turn it off. */
export function shownAll(panel: Panel, s: RunState): Record<string, Shown> {
  const scope = s.values as Scope;
  const out: Record<string, Shown> = {};
  for (const w of panel.widgets) {
    const o = s.overrides[w.id];
    out[w.id] = {
      visible: typeof o?.hidden === 'boolean' ? !o.hidden : holds(w.visibleWhen, scope),
      enabled: typeof o?.disabled === 'boolean' ? !o.disabled : holds(w.enabledWhen, scope),
    };
  }
  for (const g of panel.widgets) {
    if (g.type !== 'group') continue;
    const group = out[g.id];
    if (group.visible && group.enabled) continue;
    for (const w of panel.widgets) {
      if (w === g || w.type === 'group') continue;
      const inside = w.x >= g.x && w.y >= g.y && w.x + w.w <= g.x + g.w && w.y + w.h <= g.y + g.h;
      if (!inside) continue;
      out[w.id] = { visible: out[w.id].visible && group.visible, enabled: out[w.id].enabled && group.enabled };
    }
  }
  return out;
}
