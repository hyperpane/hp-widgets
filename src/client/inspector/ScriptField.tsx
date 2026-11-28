// A script in the inspector: its first lines, quiet, and Edit code, which
// opens it over the whole window, an editor to write in (CodeField, with
// what a script can use beside it). What's typed goes into the panel as
// it's typed, as before; Done or Escape goes back to the panel.
//
// A native <dialog>, shown modal: it's in the page's top layer, over the
// inspector's sheet in a narrow window (one too), which nothing else is.

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Code2 } from '@hyperpane/icons';
import { Button, HeaderBar } from '@hyperpane/ui';
import { useBackPage } from '../app/back.ts';
import { CodeField } from './CodeField.tsx';

/** How many of its lines the inspector shows. */
const PREVIEW_LINES = 6;

export function ScriptField({
  title,
  label,
  value,
  placeholder,
  onChange,
}: {
  /** What it's for: `deploy · On click`. */
  title: string;
  /** The editor's name, for a screen reader. */
  label: string;
  value: string;
  placeholder: string;
  onChange(v: string): void;
}) {
  const [open, setOpen] = useState(false);
  const lines = value.split('\n');
  const more = lines.length - PREVIEW_LINES;
  return (
    <div className="flex flex-col gap-2">
      {value.trim() ? (
        <pre className="rounded-control m-0 overflow-hidden bg-[var(--fill)] px-3 py-2.5 font-mono text-[11px] leading-4 whitespace-pre text-[var(--node-fg)]">
          {lines.slice(0, PREVIEW_LINES).join('\n')}
          {more > 0 && <span className="block pt-1 text-[var(--node-muted)]">{more === 1 ? '1 more line' : `${more} more lines`}</span>}
        </pre>
      ) : (
        <p className="rounded-control m-0 bg-[var(--fill)] px-3 py-3 text-center text-xs text-[var(--node-muted)]">
          No code yet: nothing runs.
        </p>
      )}
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Code2 variant="outline" /> Edit code
      </Button>
      {open && <CodePage title={title} label={label} value={value} placeholder={placeholder} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The editor over the whole window: a bar (back to the panel, what it is,
 * Done), the code, and what a script can use at its side (below it in a
 * narrow window, closed). */
function CodePage({
  title,
  label,
  value,
  placeholder,
  onChange,
  onClose,
}: {
  title: string;
  label: string;
  value: string;
  placeholder: string;
  onChange(v: string): void;
  onClose(): void;
}) {
  const page = useRef<HTMLDialogElement>(null);
  useBackPage(onClose);
  useEffect(() => {
    const el = page.current;
    if (!el) return;
    el.showModal();
    // The code takes the keys at once.
    el.querySelector<HTMLElement>('.cm-content')?.focus();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={page}
      aria-label={title}
      // Escape: back to the panel (the dialog's own cancel, which would
      // close it behind React's back).
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-dvw max-w-none flex-col border-0 bg-[var(--node-bg,var(--background))] p-0 text-[var(--node-fg,var(--foreground))] backdrop:bg-transparent"
    >
      <HeaderBar className="gap-2 px-2">
        <Button variant="ghost" size="sm" className="ps-1.5" onClick={onClose} aria-label="Back to the panel">
          <ChevronLeft variant="outline" /> Panel
        </Button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <div className="truncate text-[13px] font-medium">{title}</div>
          <div className="truncate text-xs text-[var(--node-muted)] max-sm:hidden">JavaScript, run on the server. Saved as you type.</div>
        </div>
        <Button variant="default" tint="var(--node-accent)" size="sm" onClick={onClose}>
          Done
        </Button>
      </HeaderBar>
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <CodeField label={label} value={value} placeholder={placeholder} onChange={onChange} fontSize={13} className="min-h-0 flex-1 rounded-none border-0" />
        <aside className="w-80 flex-none overflow-y-auto border-l border-[var(--hairline)] bg-[var(--surface-sunken)] p-4 max-md:max-h-[40%] max-md:w-auto max-md:border-t max-md:border-l-0">
          <ScriptHelp open />
        </aside>
      </div>
    </dialog>
  );
}

/** What a script is given, in a list to open. */
export function ScriptHelp({ open }: { open?: boolean }) {
  const items: [string, string][] = [
    ['values', 'every widget’s value as it happened: values.branch'],
    ['inputs', 'the latest value at each of the panel’s in-ports: inputs.file'],
    ['output(port, value)', 'sends a value from one of the panel’s out-ports, along its links'],
    ['event', '{ widget, type, value }: what happened (type run: the panel was run)'],
    ['ui.get(id) / ui.set(id, value)', 'a value now; a field’s, a Text’s or Badge’s text, a bar’s progress'],
    ['ui.prop(id, name, value)', 'label, text, options, variant, placeholder, min, max, step, disabled, hidden'],
    ['ui.log([id,] text) / ui.clear([id])', 'lines in a Log (the first, unless named)'],
    ['ui.toast(message, { error })', 'a toast in the app'],
    [
      'await run(command, { log, env, cwd })',
      'a shell command in the project’s folder: { code, output }; its lines in the first Log, or log: id, or log: false',
    ],
    ['await sleep(ms)', 'a pause'],
    ['project', '{ id, name, folder }'],
    ['console.log, fetch, setTimeout', 'as in Node; console goes to the first Log'],
  ];
  return (
    <details open={open} className="text-xs leading-[18px] text-[var(--node-muted)]">
      <summary className="cursor-pointer text-[11px] leading-4 font-medium tracking-[0.06em] text-[var(--node-muted)] uppercase select-none">What a script can use</summary>
      <p className="mt-2 mb-4">The body of an async function, run in Node on the server, with:</p>
      <dl className="m-0 flex flex-col gap-3">
        {items.map(([name, what]) => (
          <div key={name}>
            <dt className="font-mono text-[11px] text-[var(--node-fg)]">{name}</dt>
            <dd className="m-0">{what}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
