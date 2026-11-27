// Fields to type in: an Input (a line), a Number, and a Textarea (lines).
// Their change script runs when the field is left (or Enter, in a line),
// with the value changed: not on every keystroke, which would start a run
// for each letter.

import { useEffect, useState } from 'react';
import { Input, Textarea } from '@hyperpane/ui';
import { Hash, TextAlignStart, TextCursorInput } from '@hyperpane/icons';
import { TYPES } from '../../shared/index.ts';
import { Labeled, useCommit } from './Labeled.tsx';
import type { WidgetEntry, WidgetView } from './types.ts';

function InputWidget({ props, value, disabled, dev, change, commit }: WidgetView) {
  const c = useCommit(value, commit);
  return (
    <Labeled label={props.label}>
      {(id) => (
        <Input
          id={id}
          size="sm"
          value={String(value ?? '')}
          placeholder={props.placeholder}
          disabled={disabled}
          tabIndex={dev ? -1 : undefined}
          spellCheck={false}
          onChange={(e) => change(e.target.value)}
          onFocus={c.onFocus}
          onBlur={c.onBlur}
          onKeyDown={(e) => e.key === 'Enter' && c.enter()}
        />
      )}
    </Labeled>
  );
}

function NumberWidget({ props, value, disabled, dev, change, commit }: WidgetView) {
  // What's typed, which may not be a number yet ("-", "1."): the value
  // follows once it is, and the field shows the value again when left.
  const [typed, setTyped] = useState(String(value ?? 0));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setTyped(String(value ?? 0));
  }, [value, editing]);
  const c = useCommit(value, commit);
  return (
    <Labeled label={props.label}>
      {(id) => (
        <Input
          id={id}
          size="sm"
          type="number"
          inputMode="decimal"
          className="tabular-nums"
          value={typed}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={disabled}
          tabIndex={dev ? -1 : undefined}
          onChange={(e) => {
            setTyped(e.target.value);
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) change(n);
          }}
          onFocus={() => {
            setEditing(true);
            c.onFocus();
          }}
          onBlur={() => {
            setEditing(false);
            c.onBlur();
          }}
          onKeyDown={(e) => e.key === 'Enter' && c.enter()}
        />
      )}
    </Labeled>
  );
}

function TextareaWidget({ props, value, disabled, dev, change, commit }: WidgetView) {
  const c = useCommit(value, commit);
  return (
    <Labeled label={props.label}>
      {(id) => (
        <Textarea
          id={id}
          size="sm"
          className="min-h-0 flex-1 font-mono text-xs"
          value={String(value ?? '')}
          placeholder={props.placeholder}
          disabled={disabled}
          tabIndex={dev ? -1 : undefined}
          spellCheck={false}
          onChange={(e) => change(e.target.value)}
          onFocus={c.onFocus}
          onBlur={c.onBlur}
        />
      )}
    </Labeled>
  );
}

const textFields = [
  { kind: 'text', prop: 'label', label: 'Label' },
  { kind: 'text', prop: 'placeholder', label: 'Placeholder' },
  { kind: 'value', label: 'Default value' },
] as const;

export const input: WidgetEntry = {
  type: 'input',
  title: 'Input',
  hint: 'A line of text to type. Its script runs when it’s left changed, or on Enter.',
  icon: TextCursorInput,
  defaults: TYPES.input,
  fields: [...textFields],
  render: (v) => <InputWidget {...v} />,
};

export const number: WidgetEntry = {
  type: 'number',
  title: 'Number',
  hint: 'A number, with a least and a most.',
  icon: Hash,
  defaults: TYPES.number,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'value', label: 'Default value' },
    { kind: 'number', prop: 'min', label: 'Min' },
    { kind: 'number', prop: 'max', label: 'Max' },
    { kind: 'number', prop: 'step', label: 'Step' },
  ],
  render: (v) => <NumberWidget {...v} />,
};

export const textarea: WidgetEntry = {
  type: 'textarea',
  title: 'Textarea',
  hint: 'Lines of text to type: a message, a list, a config.',
  icon: TextAlignStart,
  defaults: TYPES.textarea,
  fields: [...textFields],
  render: (v) => <TextareaWidget {...v} />,
};
