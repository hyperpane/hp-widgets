// View mode's state (src/client/runtime): a script's ops applied, the
// user's changes kept to their kind, Logs keeping their last lines, values
// following the panel as it's edited, and conditions with what scripts
// said over them. No DOM.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shownAll } from '../../src/client/runtime/conditions.ts';
import { appendLines, applyOp, follow, initialState, propsOf, setValue } from '../../src/client/runtime/state.ts';
import { LOG_LINES, newWidget, type Panel } from '../../src/shared/index.ts';

function panel(): Panel {
  const env = newWidget('select', 'env', { x: 0, y: 0 });
  env.props.options = ['staging', 'prod'];
  env.props.value = 'staging';
  const confirm = newWidget('checkbox', 'confirm', { x: 0, y: 48 });
  const go = newWidget('button', 'go', { x: 0, y: 80 });
  go.enabledWhen = "env != 'prod' || confirm";
  const warn = newWidget('text', 'warn', { x: 0, y: 120 });
  warn.visibleWhen = "env == 'prod'";
  const count = newWidget('number', 'count', { x: 0, y: 160 });
  return {
    id: 'p',
    name: 'P',
    width: 400,
    height: 400,
    widgets: [env, confirm, go, warn, count, newWidget('log', 'out', { x: 0, y: 220 })],
    inputs: [],
    outputs: [],
    onRun: '',
    runOnInput: false,
  };
}

test('ops: set, prop, log, clear', () => {
  const p = panel();
  let s = initialState(p);
  assert.deepEqual(s.values, { env: 'staging', confirm: false, warn: 'Text', count: 0, out: '' });
  s = applyOp(s, { type: 'set', id: 'warn', value: 'Careful' }, p);
  s = applyOp(s, { type: 'log', id: 'out', text: 'one\ntwo' }, p);
  s = applyOp(s, { type: 'log', id: 'out', text: 'three' }, p);
  s = applyOp(s, { type: 'prop', id: 'go', name: 'label', value: 'Ship it' }, p);
  s = applyOp(s, { type: 'set', id: 'ghost', value: 1 }, p);
  assert.equal(s.values.warn, 'Careful');
  assert.equal(s.values.out, 'one\ntwo\nthree');
  assert.equal(propsOf(p.widgets[2], s).label, 'Ship it');
  assert.ok(!('ghost' in s.values));
  s = applyOp(s, { type: 'clear', id: 'out' }, p);
  assert.equal(s.values.out, '');
});

test('a Log keeps its last lines', () => {
  const many = Array.from({ length: LOG_LINES + 5 }, (_, i) => String(i)).join('\n');
  const kept = appendLines('', many).split('\n');
  assert.equal(kept.length, LOG_LINES);
  assert.equal(kept[0], '5');
  assert.equal(appendLines('a', 'b'), 'a\nb');
});

test('the user’s changes, kept to the widget’s kind and range', () => {
  const p = panel();
  const count = p.widgets[4];
  let s = setValue(initialState(p), count, '250');
  assert.equal(s.values.count, 100, 'the number’s max');
  s = setValue(s, p.widgets[1], true);
  assert.equal(s.values.confirm, true);
  s = setValue(s, p.widgets[2], 'x');
  assert.ok(!('go' in s.values), 'a button holds nothing');
});

test('conditions: worked out from the values; a script’s hidden/disabled wins', () => {
  const p = panel();
  let s = initialState(p);
  assert.deepEqual(shownAll(p, s).go, { visible: true, enabled: true });
  assert.equal(shownAll(p, s).warn.visible, false);
  s = setValue(s, p.widgets[0], 'prod');
  assert.deepEqual(shownAll(p, s).go, { visible: true, enabled: false });
  assert.equal(shownAll(p, s).warn.visible, true);
  s = setValue(s, p.widgets[1], true);
  assert.equal(shownAll(p, s).go.enabled, true);
  s = applyOp(s, { type: 'prop', id: 'go', name: 'disabled', value: true }, p);
  assert.equal(shownAll(p, s).go.enabled, false);
  s = applyOp(s, { type: 'prop', id: 'warn', name: 'hidden', value: true }, p);
  assert.equal(shownAll(p, s).warn.visible, false);
});

test('a hidden or disabled group takes what’s in it along', () => {
  const p = panel();
  const g = { ...newWidget('group', 'box', { x: 0, y: 0 }), w: 400, h: 112, enabledWhen: 'false' };
  p.widgets.unshift(g);
  const shown = shownAll(p, initialState(p));
  assert.equal(shown.env.enabled, false);
  assert.equal(shown.go.enabled, false);
  assert.equal(shown.warn.enabled, true, 'outside the box');
});

test('values follow the panel as it’s edited', () => {
  const before = panel();
  let s = setValue(initialState(before), before.widgets[0], 'prod');
  s = setValue(s, before.widgets[4], 7);
  const after: Panel = structuredClone(before);
  after.widgets = after.widgets.filter((w) => w.id !== 'confirm');
  after.widgets.push(newWidget('switch', 'dry', { x: 200, y: 0 }));
  after.widgets[3].props.value = 3; // count's default changed
  const next = follow(s, before, after);
  assert.equal(next.values.env, 'prod', 'kept');
  assert.equal(next.values.count, 3, 'a new default starts over');
  assert.equal(next.values.dry, false, 'a new widget, its default');
  assert.ok(!('confirm' in next.values), 'a gone widget, gone');
});
