// Choices: a Checkbox and a Switch (on or off), a Select (a dropdown) and
// a Radio group (one of a few, all in view), and a Slider. A choice made
// runs the change script at once; a slider when it's let go.

import { Checkbox, Select, Switch } from '@hyperpane/ui';
import { ChevronsUpDown, CircleDot, SlidersHorizontal, SquareCheck, ToggleRight } from 'lucide-react';
import { TYPES } from '../../shared/index.ts';
import { Labeled, useCommit } from './Labeled.tsx';
import type { WidgetEntry, WidgetView } from './types.ts';

export const checkbox: WidgetEntry = {
  type: 'checkbox',
  title: 'Checkbox',
  hint: 'On or off, with its label beside it.',
  icon: SquareCheck,
  defaults: TYPES.checkbox,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'value', label: 'Checked at first' },
  ],
  render: ({ props, value, disabled, dev, change }) => (
    <div className="flex h-full w-full min-w-0 items-center">
      <Checkbox
        label={props.label}
        checked={value === true}
        disabled={disabled}
        tabIndex={dev ? -1 : undefined}
        className="text-xs"
        onCheckedChange={(on) => change(on, true)}
      />
    </div>
  ),
};

export const toggle: WidgetEntry = {
  type: 'switch',
  title: 'Switch',
  hint: 'A setting turned on or off.',
  icon: ToggleRight,
  defaults: TYPES.switch,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'value', label: 'On at first' },
  ],
  render: ({ props, value, disabled, dev, change }) => (
    <div className="flex h-full w-full min-w-0 items-center">
      <Switch
        label={props.label}
        checked={value === true}
        disabled={disabled}
        tabIndex={dev ? -1 : undefined}
        className="text-xs"
        onCheckedChange={(on) => change(on, true)}
      />
    </div>
  ),
};

export const select: WidgetEntry = {
  type: 'select',
  title: 'Select',
  hint: 'One of a list, from a dropdown.',
  icon: ChevronsUpDown,
  defaults: TYPES.select,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'options', label: 'Options' },
    { kind: 'value', label: 'Chosen at first' },
  ],
  render: ({ props, value, disabled, change }) => (
    <Labeled label={props.label}>
      {() => (
        <Select
          size="sm"
          className="w-full"
          options={(props.options ?? []).map((o) => ({ value: o, label: o }))}
          value={String(value ?? '')}
          placeholder="Choose"
          disabled={disabled}
          triggerLabel={props.label || undefined}
          onValueChange={(v) => change(v, true)}
        />
      )}
    </Labeled>
  ),
};

function RadioWidget({ widget, props, value, disabled, dev, change }: WidgetView) {
  return (
    <fieldset disabled={disabled} className="flex h-full w-full min-w-0 flex-col gap-1 overflow-hidden border-0 p-0 disabled:opacity-60">
      {props.label ? <legend className="mb-1 truncate p-0 text-2xs leading-4 font-medium text-[var(--node-muted)]">{props.label}</legend> : null}
      {(props.options ?? []).map((o) => (
        <label key={o} className="flex min-w-0 cursor-pointer items-center gap-2 text-xs">
          <input
            type="radio"
            name={`radio-${widget.id}`}
            value={o}
            checked={value === o}
            tabIndex={dev ? -1 : undefined}
            className="size-3.5 flex-none cursor-pointer accent-[var(--node-accent)]"
            onChange={() => change(o, true)}
          />
          <span className="truncate">{o}</span>
        </label>
      ))}
    </fieldset>
  );
}

export const radio: WidgetEntry = {
  type: 'radio',
  title: 'Radio',
  hint: 'One of a few choices, all in view.',
  icon: CircleDot,
  defaults: TYPES.radio,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'options', label: 'Options' },
    { kind: 'value', label: 'Chosen at first' },
  ],
  render: (v) => <RadioWidget {...v} />,
};

function SliderWidget({ props, value, disabled, dev, change, commit }: WidgetView) {
  const c = useCommit(value, commit);
  const n = typeof value === 'number' ? value : 0;
  return (
    <Labeled label={props.label}>
      {(id) => (
        <div className="flex h-7 items-center gap-2">
          <input
            id={id}
            type="range"
            min={props.min}
            max={props.max}
            step={props.step}
            value={n}
            disabled={disabled}
            tabIndex={dev ? -1 : undefined}
            className="h-4 min-w-0 flex-1 cursor-pointer accent-[var(--node-accent)] disabled:cursor-default disabled:opacity-50"
            onChange={(e) => change(e.target.valueAsNumber)}
            onFocus={c.onFocus}
            onPointerUp={c.enter}
            onKeyUp={c.enter}
            onBlur={c.onBlur}
          />
          <span className="w-10 flex-none text-right text-xs text-[var(--node-muted)] tabular-nums">{n}</span>
        </div>
      )}
    </Labeled>
  );
}

export const slider: WidgetEntry = {
  type: 'slider',
  title: 'Slider',
  hint: 'A number between a least and a most, dragged to.',
  icon: SlidersHorizontal,
  defaults: TYPES.slider,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'value', label: 'Default value' },
    { kind: 'number', prop: 'min', label: 'Min' },
    { kind: 'number', prop: 'max', label: 'Max' },
    { kind: 'number', prop: 'step', label: 'Step' },
  ],
  render: (v) => <SliderWidget {...v} />,
};
