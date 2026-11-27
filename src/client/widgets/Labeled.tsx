// A field's label above it, as the app's forms have them, and what a
// field's change script waits for: being left (or Enter), with its value
// changed since it was entered, not every keystroke.

import { type ReactNode, useId, useRef } from 'react';
import { Label } from '@hyperpane/ui';
import type { Value } from '../../shared/index.ts';

export function Labeled({ label, children }: { label?: string; children(id: string): ReactNode }) {
  const id = useId();
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-1">
      {label ? (
        <Label htmlFor={id} className="truncate text-xs leading-4 font-normal text-[var(--node-muted)]">
          {label}
        </Label>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{children(id)}</div>
    </div>
  );
}

/** Focus and blur handlers that call `commit` when the field is left (or
 * `enter()` is called) with a value other than the one it was entered
 * with. */
export function useCommit(value: Value, commit: () => void) {
  const entered = useRef<Value>(value);
  const latest = useRef(value);
  latest.current = value;
  const done = () => {
    if (latest.current !== entered.current) {
      entered.current = latest.current;
      commit();
    }
  };
  return {
    onFocus: () => {
      entered.current = latest.current;
    },
    onBlur: done,
    enter: done,
  };
}
