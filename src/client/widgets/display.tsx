// What a panel shows of its work: a Progress bar, a Log (a command's
// output, as it comes), a Divider, and a Group (a titled box, drawn under
// the widgets in it, which takes them along when it's hidden or disabled).

import { useLayoutEffect, useRef } from 'react';
import { Gauge, SeparatorHorizontal, SquareDashed, SquareTerminal } from '@hyperpane/icons';
import { TYPES } from '../../shared/index.ts';
import type { WidgetEntry, WidgetView } from './types.ts';

export const progress: WidgetEntry = {
  type: 'progress',
  title: 'Progress',
  hint: 'How far along, 0 to 100: ui.set(id, 40).',
  icon: Gauge,
  defaults: TYPES.progress,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'value', label: 'At first' },
  ],
  render: ({ props, value }) => {
    const n = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0;
    const done = n >= 100;
    return (
      <div className="flex h-full w-full min-w-0 flex-col justify-center gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs leading-4 text-[var(--node-muted)]">
          <span className="truncate">{props.label}</span>
          <span className={`flex-none font-medium tabular-nums ${done ? 'text-[var(--green)]' : 'text-[var(--node-fg)]'}`}>{Math.round(n)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={props.label || 'Progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(n)}
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--fill)]"
        >
          <div
            className="absolute inset-y-0 start-0 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${n}%`, background: done ? 'var(--green)' : 'var(--node-accent)' }}
          />
        </div>
      </div>
    );
  },
};

function LogWidget({ props, value, dev }: WidgetView) {
  const box = useRef<HTMLPreElement>(null);
  // Kept at the end as lines come, unless the user scrolled up to read.
  const stuck = useRef(true);
  const text = String(value ?? '');
  const lines = text ? text.replace(/\n$/, '').split('\n').length : 0;
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    // A sunken well (a step darker than the window in dark themes, a touch
    // greyer in light ones), not a black box pasted on; its head and its
    // lines told apart by the space between them, not a rule.
    <div className="rounded-card flex h-full w-full min-w-0 flex-col overflow-hidden bg-[var(--surface-sunken)]">
      <div className="flex h-8 flex-none items-center gap-2 px-3 text-xs leading-4 text-[var(--node-muted)]">
        <SquareTerminal variant="outline" className="size-3.5 flex-none" />
        <span className="min-w-0 flex-1 truncate font-medium">{props.label || 'Output'}</span>
        {lines > 0 && (
          <span className="flex-none tabular-nums">
            {lines} {lines === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>
      {text ? (
        <pre
          ref={box}
          tabIndex={dev ? -1 : 0}
          onScroll={(e) => {
            const el = e.currentTarget;
            stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 16;
          }}
          className="m-0 min-h-0 flex-1 overflow-auto px-3 pt-1 pb-2 font-mono text-[11px] leading-[1.6] break-all whitespace-pre-wrap text-[var(--node-fg)] outline-none select-text"
        >
          {text}
        </pre>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 pb-8 text-center text-xs text-[var(--node-muted)]">
          {dev ? 'Output shows here: commands’ lines and ui.log' : 'No output yet'}
        </div>
      )}
    </div>
  );
}

export const log: WidgetEntry = {
  type: 'log',
  title: 'Log',
  hint: 'Output: commands’ lines as they come, and ui.log. Scrolls along.',
  icon: SquareTerminal,
  defaults: TYPES.log,
  fields: [{ kind: 'text', prop: 'label', label: 'Label' }],
  render: (v) => <LogWidget {...v} />,
};

export const divider: WidgetEntry = {
  type: 'divider',
  title: 'Divider',
  hint: 'A line between parts: across, or down when it’s taller than wide.',
  icon: SeparatorHorizontal,
  defaults: TYPES.divider,
  fields: [],
  render: ({ widget }) => {
    const down = widget.h > widget.w;
    return (
      <div className={down ? 'flex h-full w-full justify-center' : 'flex h-full w-full flex-col justify-center'}>
        <div className={down ? 'h-full w-px bg-[var(--hairline-strong)]' : 'h-px w-full bg-[var(--hairline-strong)]'} />
      </div>
    );
  },
};

export const group: WidgetEntry = {
  type: 'group',
  title: 'Group',
  hint: 'A titled box around widgets. Hiding or disabling it does the same to them.',
  icon: SquareDashed,
  defaults: TYPES.group,
  fields: [{ kind: 'text', prop: 'label', label: 'Title' }],
  render: ({ props, disabled }) => (
    // A flat card: the fill sets it off in light and dark alike (a raised
    // ground is the window's own white in light, so it vanished there).
    <div className={`relative h-full w-full rounded-surface bg-[var(--fill)] ${disabled ? 'opacity-60' : ''}`}>
      {props.label ? (
        <span className="absolute top-2.5 left-4 max-w-[calc(100%-2rem)] truncate text-[11px] leading-4 font-medium tracking-[0.06em] text-[var(--node-muted)] uppercase">
          {props.label}
        </span>
      ) : null}
    </div>
  ),
};
