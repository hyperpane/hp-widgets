// What a panel shows of its work: a Progress bar, a Log (a command's
// output, as it comes), a Divider, and a Group (a titled box, drawn under
// the widgets in it, which takes them along when it's hidden or disabled).

import { useLayoutEffect, useRef } from 'react';
import { Gauge, SeparatorHorizontal, SquareDashed, SquareTerminal } from 'lucide-react';
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
        <div className="flex items-center justify-between gap-2 text-2xs leading-4 text-[var(--node-muted)]">
          <span className="truncate font-medium">{props.label}</span>
          <span className={`flex-none tabular-nums ${done ? 'text-[var(--ansi-2)]' : ''}`}>{Math.round(n)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={props.label || 'Progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(n)}
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--node-fg)_10%,transparent)]"
        >
          <div
            className="absolute inset-y-0 start-0 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${n}%`, background: done ? 'var(--ansi-2)' : 'var(--node-accent)' }}
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
    <div className="rounded-surface flex h-full w-full min-w-0 flex-col overflow-hidden border border-[var(--node-border)] bg-[color-mix(in_srgb,var(--node-header)_70%,black)]">
      <div className="flex h-7 flex-none items-center gap-1.5 border-b border-[var(--node-border)] px-2.5 text-2xs leading-4 text-[var(--node-muted)]">
        <SquareTerminal className="size-3 flex-none" />
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
          className="m-0 min-h-0 flex-1 overflow-auto px-2.5 py-2 font-mono text-[11px] leading-[1.5] break-all whitespace-pre-wrap text-[var(--node-fg)] outline-none select-text"
        >
          {text}
        </pre>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-2xs text-[var(--node-muted)]">
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
        <div className={down ? 'h-full w-px bg-[var(--node-border)]' : 'h-px w-full bg-[var(--node-border)]'} />
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
    <div
      className={`rounded-surface relative h-full w-full border border-[var(--node-border)] bg-[color-mix(in_srgb,var(--node-fg)_2.5%,transparent)] ${disabled ? 'opacity-60' : ''}`}
    >
      {props.label ? (
        <span className="absolute top-1.5 left-3 max-w-[calc(100%-1.5rem)] truncate text-[10px] leading-4 font-semibold tracking-wider text-[var(--node-muted)] uppercase">
          {props.label}
        </span>
      ) : null}
    </div>
  ),
};
