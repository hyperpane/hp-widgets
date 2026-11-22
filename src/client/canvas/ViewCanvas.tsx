// View mode: the panel working, as the finished tool. Widgets take input,
// their values live in the window (runtime/), their conditions decide what
// shows and what's enabled, and their scripts run on the server.

import { useMemo } from 'react';
import { Empty, NodeButton, useCompact } from '@hyperpane/ui';
import { LayoutDashboard, Pencil } from 'lucide-react';
import type { Panel } from '../../shared/index.ts';
import { shownAll } from '../runtime/conditions.ts';
import { propsOf } from '../runtime/state.ts';
import type { Runtime } from '../runtime/useRuntime.ts';
import { useFit } from './useFit.ts';
import { boxStyle, drawOrder, WidgetBody } from './WidgetBody.tsx';

/** Room around the panel (less on a phone). */
const PAD = 16;
const PHONE_PAD = 8;

export function ViewCanvas({ panel, runtime, onEdit }: { panel: Panel; runtime: Runtime; onEdit(): void }) {
  const { state, busy } = runtime;
  const shown = useMemo(() => shownAll(panel, state), [panel, state]);
  const order = useMemo(() => drawOrder(panel.widgets), [panel.widgets]);
  // Narrower than the panel: scaled down a little to fit across (on a
  // phone, as far as half), then scrolled. Taller: scrolled.
  const compact = useCompact();
  const pad = compact ? PHONE_PAD : PAD;
  const { box, scale } = useFit(panel, { pad, least: compact ? 0.5 : 0.75, height: false });

  if (!panel.widgets.length) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Empty
          bordered={false}
          icon={<LayoutDashboard />}
          title="This panel is empty"
          description="Switch to Dev to lay out its widgets: buttons, fields, logs."
          action={
            <NodeButton variant="primary" onClick={onEdit}>
              <Pencil /> Open Dev mode
            </NodeButton>
          }
        />
      </div>
    );
  }

  return (
    <div ref={box} className="min-h-0 flex-1 overflow-auto" style={{ padding: pad }}>
      <div className="mx-auto" style={{ width: panel.width * scale, height: panel.height * scale }}>
        <div className="relative origin-top-left" style={{ width: panel.width, height: panel.height, transform: scale === 1 ? undefined : `scale(${scale})` }}>
          {order.map((w) => {
            const s = shown[w.id];
            if (!s?.visible) return null;
            return (
              <div key={w.id} data-fixed-size className="absolute" style={boxStyle(w)}>
                <WidgetBody
                  widget={w}
                  props={propsOf(w, state)}
                  value={state.values[w.id] ?? null}
                  dev={false}
                  disabled={!s.enabled}
                  busy={busy.has(w.id)}
                  change={(v, fire = false) => runtime.change(w, v, fire)}
                  commit={() => runtime.invoke(w, 'change', runtime.state.values[w.id] ?? null)}
                  click={() => runtime.invoke(w, 'click')}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
