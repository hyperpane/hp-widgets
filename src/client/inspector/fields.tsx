// The inspector's fields: a label over a control, as the app's forms have
// them, in the window's small sizes. Text goes into the panel as it's
// typed (one Undo step a run, src/client/lib/history.ts); a number or an
// id only once it's a good one, so a half-typed value never reaches the
// canvas.

import { type ReactNode, useEffect, useId, useState } from 'react';
import { Input, Label, Select, Switch, Textarea, cn } from '@hyperpane/ui';

export function Row({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children(id: string): ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs leading-4 font-normal text-[var(--node-muted)]">
        {label}
      </Label>
      {children(id)}
      {error ? (
        <p className="m-0 text-xs leading-4 text-[var(--rose)]">{error}</p>
      ) : hint ? (
        <p className="m-0 text-xs leading-4 text-[var(--node-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/** A section of the inspector under a small label (11px, uppercase, as
 * Git's lists have them); spacing between sections, no lines. */
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <div className="-me-1 flex h-7 items-center justify-between gap-2">
        <h3 className="m-0 text-[11px] leading-4 font-medium tracking-[0.06em] text-[var(--node-muted)] uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  mono?: boolean;
  multiline?: boolean;
  hint?: ReactNode;
}) {
  return (
    <Row label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <Textarea
            id={id}
            variant="secondary"
            size="sm"
            className={cn('min-h-14 text-[13px]', mono && 'font-mono text-xs')}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            variant="secondary"
            size="sm"
            className={cn('text-[13px]', mono && 'font-mono text-xs')}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Row>
  );
}

/** Text that only goes in once `check` finds nothing wrong with it (on
 * Enter, or as the field is left); until then it says what's wrong, and
 * leaving it puts the last good one back. */
export function CheckedField({
  label,
  value,
  check,
  onCommit,
  mono,
}: {
  label: string;
  value: string;
  check(v: string): string | null;
  onCommit(v: string): void;
  mono?: boolean;
}) {
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  const problem = typed === value ? null : check(typed);
  const commit = () => {
    if (typed === value) return;
    if (problem) setTyped(value);
    else onCommit(typed);
  };
  return (
    <Row label={label} error={problem}>
      {(id) => (
        <Input
          id={id}
          variant="secondary"
          size="sm"
          className={cn('text-[13px]', mono && 'font-mono text-xs')}
          value={typed}
          error={!!problem}
          spellCheck={false}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setTyped(value);
          }}
        />
      )}
    </Row>
  );
}

/** A number, going in as soon as what's typed is one. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [typed, setTyped] = useState(String(value));
  useEffect(() => setTyped(String(value)), [value]);
  return (
    <Row label={label}>
      {(id) => (
        <Input
          id={id}
          variant="secondary"
          size="sm"
          type="number"
          className="text-[13px] tabular-nums"
          value={typed}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setTyped(e.target.value);
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setTyped(String(value))}
        />
      )}
    </Row>
  );
}

export function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(v: string): void;
}) {
  return (
    <Row label={label}>
      {() => <Select variant="secondary" size="sm" className="w-full" options={options} value={value} triggerLabel={label} onValueChange={onChange} />}
    </Row>
  );
}

export function SwitchField({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <span className="text-[13px]">{label}</span>
      <Switch checked={value} label={label} hideLabel onCheckedChange={onChange} />
    </div>
  );
}

/** A list, a line each (a select's or radio group's options). Lines go in
 * as typed; empty ones are left out. */
export function LinesField({ label, value, onChange }: { label: string; value: string[]; onChange(v: string[]): void }) {
  const [typed, setTyped] = useState(value.join('\n'));
  useEffect(() => {
    // From outside (Undo, another window): shown as it is now.
    setTyped((t) => (sameLines(t, value) ? t : value.join('\n')));
  }, [value]);
  return (
    <Row label={label} hint="One a line.">
      {(id) => (
        <Textarea
          id={id}
          variant="secondary"
          size="sm"
          className="min-h-16 text-[13px]"
          value={typed}
          spellCheck={false}
          onChange={(e) => {
            setTyped(e.target.value);
            onChange(linesOf(e.target.value));
          }}
        />
      )}
    </Row>
  );
}

const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim() !== '');
const sameLines = (text: string, list: string[]) => JSON.stringify(linesOf(text)) === JSON.stringify(list);
