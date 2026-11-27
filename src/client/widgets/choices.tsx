// Choices: a Checkbox and a Switch (on or off), a Select (a dropdown) and
// a Radio group (one of a few, all in view), and a Slider. A choice made
// runs the change script at once; a slider when it's let go.

import { Checkbox, Radio, RadioGroup, Select, Switch } from '@hyperpane/ui';
import { ChevronsUpDown, CircleDot, SlidersHorizontal, SquareCheck, ToggleRight } from '@hyperpane/icons';
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
        className="text-[13px]"
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
        className="text-[13px]"
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

function RadioWidget({ widget, props, value, disabled, change }: WidgetView) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col gap-1 overflow-hidden">
      {props.label ? <span className="truncate text-xs leading-4 text-[var(--node-muted)]">{props.label}</span> : null}
      <RadioGroup
        name={`radio-${widget.id}`}
        label={props.label || widget.id}
        value={String(value ?? '')}
        disabled={disabled}
        onValueChange={(o) => change(o, true)}
        className="min-w-0 gap-1"
      >
        {(props.options ?? []).map((o) => (
          <Radio key={o} value={o} size="sm" label={o} className="min-w-0 gap-2 text-[13px] leading-5 touch:min-h-0" />
        ))}
      </RadioGroup>
    </div>
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
