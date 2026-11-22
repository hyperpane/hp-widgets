// The selected widget in the inspector: its id (the name scripts and
// conditions use), the props its type takes (the registry says which), its
// box, when it shows and when it takes input, and its script.

import { Copy, Trash } from 'lucide-react';
import { Input, ToolButton } from '@hyperpane/ui';
import { conditionProblem, type Panel, TYPES, type Value, type Widget, type WidgetProps } from '../../shared/index.ts';
import { renameIn, renameProblem } from '../lib/ids.ts';
import { placed } from '../lib/layout.ts';
import { type FieldSpec, REGISTRY } from '../widgets/registry.ts';
import { ScriptField } from './ScriptField.tsx';
import { CheckedField, ChoiceField, LinesField, NumberField, Row, Section, SwitchField, TextField } from './fields.tsx';

export type Edit = (change: (p: Panel) => Panel, key?: string | null) => void;

const PLACEHOLDER = {
  click:
    "// Runs on the server when it's clicked.\nui.set('status', 'Deploying');\nconst r = await run('npm run deploy');\nui.set('status', r.code === 0 ? 'Deployed' : 'Failed');",
  change: "// Runs on the server when it changes.\nui.log('Now ' + event.value);",
};

export function WidgetInspector({
  panel,
  widget,
  edit,
  onRenamed,
  onDelete,
  onDuplicate,
}: {
  panel: Panel;
  widget: Widget;
  edit: Edit;
  onRenamed(id: string): void;
  onDelete(): void;
  onDuplicate(): void;
}) {
  const entry = REGISTRY[widget.type];
  const spec = TYPES[widget.type];
  const id = widget.id;
  const Icon = entry.icon;

  const change = (fn: (w: Widget) => Widget, key: string | null) => edit((p) => ({ ...p, widgets: p.widgets.map((w) => (w.id === id ? fn(w) : w)) }), key);
  const setProp = <K extends keyof WidgetProps>(name: K, value: WidgetProps[K]) =>
    change((w) => {
      const props = { ...w.props, [name]: value };
      // A choice keeps to its options.
      if (name === 'options' && props.options && !props.options.includes(String(props.value))) props.value = props.options[0] ?? '';
      return { ...w, props };
    }, `${id}.${name}`);
  const withValues = panel.widgets.filter((w) => TYPES[w.type].value !== 'none').map((w) => w.id);

  return (
    <>
      <Section
        title={entry.title}
        aside={
          <span className="flex items-center gap-0.5">
            <ToolButton label="Duplicate (⌘D)" icon={Copy} onClick={onDuplicate} />
            <ToolButton label="Delete (⌫)" icon={Trash} onClick={onDelete} />
          </span>
        }
      >
        <div className="-mt-1 flex items-start gap-2 text-2xs leading-4 text-[var(--node-muted)]">
          <Icon className="size-3.5 flex-none" />
          <span>{entry.hint}</span>
        </div>
        <CheckedField
          label="Id"
          mono
          value={id}
          check={(v) => renameProblem(widget, v, panel.widgets)}
          onCommit={(to) => {
            edit((p) => ({ ...p, widgets: renameIn(p.widgets, id, to) }), null);
            onRenamed(to);
          }}
        />
        {entry.fields.map((f) => (
          <PropField key={`${f.kind}-${'prop' in f ? f.prop : ''}`} field={f} widget={widget} setProp={setProp} />
        ))}
      </Section>

      <Section title="Place">
        <div className="grid grid-cols-4 gap-2">
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <NumberField
              key={k}
              label={k.toUpperCase()}
              value={widget[k]}
              min={0}
              onChange={(v) => edit((p) => ({ ...p, widgets: placed(p, id, { [k]: v }) }), `${id}.${k}`)}
            />
          ))}
        </div>
      </Section>

      <Section title="When">
        <ConditionField
          label="Visible when"
          value={widget.visibleWhen}
          ids={withValues}
          onChange={(v) => change((w) => ({ ...w, visibleWhen: v }), `${id}.visible`)}
        />
        <ConditionField
          label="Enabled when"
          value={widget.enabledWhen}
          ids={withValues}
          onChange={(v) => change((w) => ({ ...w, enabledWhen: v }), `${id}.enabled`)}
        />
      </Section>

      {spec.event && (
        <Section title={spec.event === 'click' ? 'On click' : 'On change'}>
          <ScriptField
            title={`${id} · ${spec.event === 'click' ? 'On click' : 'On change'}`}
            label={`${id}’s script`}
            value={widget.script}
            placeholder={PLACEHOLDER[spec.event]}
            onChange={(v) => change((w) => ({ ...w, script: v }), `${id}.script`)}
          />
        </Section>
      )}
    </>
  );
}

function PropField({
  field,
  widget,
  setProp,
}: {
  field: FieldSpec;
  widget: Widget;
  setProp<K extends keyof WidgetProps>(name: K, value: WidgetProps[K]): void;
}) {
  const entry = REGISTRY[widget.type];
  const p = widget.props;
  switch (field.kind) {
    case 'text':
      return <TextField label={field.label} value={p[field.prop] ?? ''} multiline={field.multiline} onChange={(v) => setProp(field.prop, v)} />;
    case 'number':
      return <NumberField label={field.label} value={p[field.prop] ?? 0} onChange={(v) => setProp(field.prop, v)} />;
    case 'variant': {
      const variants = entry.defaults.variants ?? [];
      return (
        <ChoiceField
          label={field.label}
          value={p.variant ?? variants[0] ?? ''}
          options={variants.map((v) => ({ value: v, label: entry.variantLabels?.[v] ?? v }))}
          onChange={(v) => setProp('variant', v)}
        />
      );
    }
    case 'options':
      return <LinesField label={field.label} value={p.options ?? []} onChange={(v) => setProp('options', v)} />;
    case 'value':
      return <ValueField label={field.label} widget={widget} onChange={(v) => setProp('value', v)} />;
  }
}

/** A widget's default value, edited as its kind is. */
function ValueField({ label, widget, onChange }: { label: string; widget: Widget; onChange(v: Value): void }) {
  const p = widget.props;
  if (p.options)
    return <ChoiceField label={label} value={String(p.value ?? '')} options={p.options.map((o) => ({ value: o, label: o }))} onChange={onChange} />;
  switch (TYPES[widget.type].value) {
    case 'boolean':
      return <SwitchField label={label} value={p.value === true} onChange={onChange} />;
    case 'number':
      return (
        <NumberField
          label={label}
          value={typeof p.value === 'number' ? p.value : 0}
          min={widget.type === 'progress' ? 0 : p.min}
          max={widget.type === 'progress' ? 100 : p.max}
          step={p.step}
          onChange={onChange}
        />
      );
    default:
      return <TextField label={label} value={String(p.value ?? '')} multiline={widget.type === 'textarea'} onChange={onChange} />;
  }
}

function ConditionField({ label, value, ids, onChange }: { label: string; value: string; ids: string[]; onChange(v: string): void }) {
  const problem = conditionProblem(value, ids);
  return (
    <Row
      label={label}
      error={problem && `${problem} It counts as true until it’s fixed.`}
      hint={value ? undefined : 'Empty: always. Widgets by id, e.g. env == "prod" && confirm'}
    >
      {(id) => (
        <Input
          id={id}
          variant="secondary"
          size="sm"
          value={value}
          error={!!problem}
          spellCheck={false}
          placeholder="always"
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      )}
    </Row>
  );
}

/** What a script has, in a line each, under a fold. */
